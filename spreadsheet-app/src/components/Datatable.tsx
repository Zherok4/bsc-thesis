import { HotTable, type HotTableRef } from '@handsontable/react-wrapper';
import { memo, useCallback, useImperativeHandle, useRef, useMemo, useEffect, type JSX } from 'react';
import { registerAllModules } from 'handsontable/registry';
import { HyperFormula } from 'hyperformula';
import type { MergeCellSettings, SheetStyleData } from './TopBar';
import { createLogger } from '../utils/logger';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';
import './Datatable.css';

/**
 * Represents the current viewport state of the spreadsheet
 */
export interface ViewportInfo {
    firstVisibleRow: number;
    lastVisibleRow: number;
    firstVisibleCol: number;
    lastVisibleCol: number;
    totalRows: number;
    totalCols: number;
}

const log = createLogger('Datatable');

registerAllModules();

const DEFAULT_COL_WIDTH: number = 110;
const HIGHLIGHT_CLASS = 'cell-highlight';
const VIEWED_CELL_CLASS = 'cell-viewed';
const SCROLL_HIDE_DELAY_MS = 800;

/**
 * Represents a range of highlighted cells
 */
interface HighlightRange {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
    sheetName: string;
}

/**
 * Represents the cell currently being viewed in the graph
 */
interface ViewedCell {
    row: number;
    col: number;
    sheetName: string;
}

/**
 * Props for the Datatable component
 */
interface DatatableProps {
    /** Callback invoked when a cell is selected */
    onCellSelect: (value: string, row: number, col: number) => void;
    /** Callback invoked when a range is selected (including single cell as 1x1 range) */
    onRangeSelect?: (startRow: number, startCol: number, endRow: number, endCol: number) => void;
    /** HyperFormula instance for formula calculations */
    hfInstance: HyperFormula;
    /** Name of the currently active sheet */
    activeSheetName: string;
    /** Version counter to trigger re-renders when sheets change */
    sheetsVersion?: number;
    /** Merge cell settings per sheet */
    sheetMergeData?: { [key: string]: MergeCellSettings[] };
    /** Cell style data per sheet */
    sheetStyleData?: { [key: string]: SheetStyleData };
    /** Ref for imperative handle access */
    ref?: React.Ref<DatatableHandle>;
    /** Callback invoked when the viewport changes during scrolling */
    onViewportChange?: (viewport: ViewportInfo, isScrolling: boolean) => void;
}

/**
 * Imperative handle interface for controlling the Datatable externally
 */
export interface DatatableHandle {
    /** Update a cell's value at the specified position */
    updateCell: (newValue: string, row: number, col: number) => void;
    /** Select a cell at the specified position */
    selectCell: (row: number, col: number) => void;
    /** Deselect any selected cells (prevents keyboard events from affecting spreadsheet) */
    deselectCell: () => void;
    /** Load data into the active sheet */
    loadData: (data: (string | number | null)[][]) => void;
    /** Scroll the viewport to show a specific cell, optionally on a specific sheet */
    scrollToCell: (row: number, col: number, sheet?: string) => void;
    /** Highlight a range of cells, optionally on a specific sheet */
    highlightCells: (startRow: number, startCol: number, endRow: number, endCol: number, sheet?: string) => void;
    /** Clear all cell highlights */
    clearHighlight: () => void;
    /** Set the viewed cell highlight (dotted border) for the cell being displayed in the graph */
    setViewedCellHighlight: (row: number, col: number, sheet: string) => void;
    /** Clear the viewed cell highlight */
    clearViewedCellHighlight: () => void;
}

/**
 * Spreadsheet data table component using Handsontable.
 * Renders multiple sheets with formula support via HyperFormula.
 * Exposes imperative methods for external control of cell selection and highlighting.
 *
 * @param props - Component props
 * @param props.onCellSelect - Handler for cell selection events
 * @param props.hfInstance - HyperFormula instance for calculations
 * @param props.activeSheetName - Currently active sheet name
 * @param props.sheetsVersion - Version counter for sheet updates
 * @param props.ref - Imperative handle ref
 */
const Datatable = ({onCellSelect, onRangeSelect, hfInstance, activeSheetName, sheetsVersion, sheetMergeData, sheetStyleData, ref, onViewportChange}: DatatableProps): JSX.Element[] => {
    const hotTableRefsMap = useRef<Map<string, HotTableRef | null>>(new Map());
    const currentHighlight = useRef<HighlightRange | null>(null);
    const currentViewedCell = useRef<ViewedCell | null>(null);
    const scrollTimeoutRef = useRef<number | null>(null);

    const sheetNames = useMemo(() => {
        return hfInstance.getSheetNames();
    }, [hfInstance, sheetsVersion]);

    useEffect(() => {
        const currentSheetNames = hfInstance.getSheetNames();
        const currentRefKeys = Array.from(hotTableRefsMap.current.keys());
        currentRefKeys.forEach(sheetName => {
            if (!currentSheetNames.includes(sheetName)) {
                hotTableRefsMap.current.delete(sheetName);
            }
        });
    }, [hfInstance, sheetNames])

    /** Re-apply viewed cell highlight when switching back to the sheet containing it */
    useEffect(() => {
        const viewed = currentViewedCell.current;
        if (!viewed || viewed.sheetName !== activeSheetName) return;

        // Small delay to ensure Handsontable has rendered
        const timeoutId = setTimeout(() => {
            const hotTableRef = hotTableRefsMap.current.get(viewed.sheetName);
            const hotInstance = hotTableRef?.hotInstance;
            if (hotInstance) {
                const existingMeta = hotInstance.getCellMeta(viewed.row, viewed.col).className;
                const existingClass = typeof existingMeta === 'string' ? existingMeta : '';
                if (!existingClass.includes(VIEWED_CELL_CLASS)) {
                    const newClass = existingClass ? `${existingClass} ${VIEWED_CELL_CLASS}` : VIEWED_CELL_CLASS;
                    hotInstance.setCellMeta(viewed.row, viewed.col, 'className', newClass);
                    hotInstance.render();
                }
            }
        }, 50);

        return () => clearTimeout(timeoutId);
    }, [activeSheetName]);

    useImperativeHandle(ref, () => ({
        updateCell: (newValue: string, row: number, col: number) => {
            log.debug(`updateCell called: row=${row}, col=${col}, sheet=${activeSheetName}`);
            const hotTableRef = hotTableRefsMap.current.get(activeSheetName);
            const hotInstance = hotTableRef?.hotInstance;
            if (hotInstance) {
                hotInstance.setDataAtCell(row, col, newValue);
            } else {
                log.warn(`No hotInstance found for sheet: ${activeSheetName}`);
            }
        },
        selectCell: (row: number, col: number) => {
            const hotTableRef = hotTableRefsMap.current.get(activeSheetName);
            const hotInstance = hotTableRef?.hotInstance;
            if (hotInstance) {
                hotInstance.selectCell(row, col);
            }
        },
        deselectCell: () => {
            const hotTableRef = hotTableRefsMap.current.get(activeSheetName);
            const hotInstance = hotTableRef?.hotInstance;
            if (hotInstance) {
                hotInstance.deselectCell();
            }
        },
        loadData: (data: (string | number | null)[][]) => {
            const hotTableRef = hotTableRefsMap.current.get(activeSheetName);
            const hotInstance = hotTableRef?.hotInstance;
            if (hotInstance) {
                hotInstance.loadData(data);
            }
        },
        scrollToCell: (row: number, col: number, sheet?: string) => {
            const targetSheet = sheet ?? activeSheetName;
            const hotTableRef = hotTableRefsMap.current.get(targetSheet);
            const hotInstance = hotTableRef?.hotInstance;
            // using heuristic that most of the time the important semantic naming is at top of a range / cell scroll one column and row back

            if (hotInstance) {
                const targetRow = Math.max(0, row - 1);
                const targetCol = Math.max(0, col - 1);
                hotInstance.scrollViewportTo({row: targetRow, col: targetCol, verticalSnap: 'top', horizontalSnap: 'start'});
            }
        },
        highlightCells: (startRow: number, startCol: number, endRow: number, endCol: number, sheet?: string) => {
            const targetSheet = sheet ?? activeSheetName;
            const highlight = currentHighlight.current;

            /** first clear all the previous highlights */
            if (highlight) {
                const hotTableRef = hotTableRefsMap.current.get(highlight.sheetName);
                const hotInstance = hotTableRef?.hotInstance;
                if (hotInstance) {
                    for (let row = highlight.startRow; row <= highlight.endRow; row++) {
                        for (let col = highlight.startCol; col <= highlight.endCol; col++) {
                            hotInstance.setCellMeta(row, col, 'className', '');
                        }
                    }
                    hotInstance.render();
                }
            }

            const hotTableRef = hotTableRefsMap.current.get(targetSheet);
            const hotInstance = hotTableRef?.hotInstance;

            if (hotInstance) {
                for (let row = startRow; row <= endRow; row++) {
                    for (let col = startCol; col <= endCol; col++) {
                        hotInstance.setCellMeta(row, col, 'className', HIGHLIGHT_CLASS);
                    }
                }
                hotInstance.render();
                currentHighlight.current = {
                    startRow,
                    startCol,
                    endRow,
                    endCol,
                    sheetName: targetSheet,
                };
            }
        },
        clearHighlight: () => {
            const highlight = currentHighlight.current;
            if (!highlight) return;

            const hotTableRef = hotTableRefsMap.current.get(highlight.sheetName);
            const hotInstance = hotTableRef?.hotInstance;
            if (hotInstance) {
                for (let row = highlight.startRow; row <= highlight.endRow; row++) {
                    for (let col = highlight.startCol; col <= highlight.endCol; col++) {
                        hotInstance.setCellMeta(row, col, 'className', '');
                    }
                }
                hotInstance.render();
            }
            currentHighlight.current = null;
        },
        setViewedCellHighlight: (row: number, col: number, sheet: string) => {
            // First clear the previous viewed cell highlight
            const prevViewed = currentViewedCell.current;
            if (prevViewed) {
                const prevHotTableRef = hotTableRefsMap.current.get(prevViewed.sheetName);
                const prevHotInstance = prevHotTableRef?.hotInstance;
                if (prevHotInstance) {
                    const existingMeta = prevHotInstance.getCellMeta(prevViewed.row, prevViewed.col).className;
                    const existingClass = typeof existingMeta === 'string' ? existingMeta : '';
                    const newClass = existingClass.replace(VIEWED_CELL_CLASS, '').trim();
                    prevHotInstance.setCellMeta(prevViewed.row, prevViewed.col, 'className', newClass);
                    prevHotInstance.render();
                }
            }

            // Set the new viewed cell highlight
            const hotTableRef = hotTableRefsMap.current.get(sheet);
            const hotInstance = hotTableRef?.hotInstance;
            if (hotInstance) {
                const existingMeta = hotInstance.getCellMeta(row, col).className;
                const existingClass = typeof existingMeta === 'string' ? existingMeta : '';
                const newClass = existingClass ? `${existingClass} ${VIEWED_CELL_CLASS}` : VIEWED_CELL_CLASS;
                hotInstance.setCellMeta(row, col, 'className', newClass);
                hotInstance.render();
                currentViewedCell.current = { row, col, sheetName: sheet };
            }
        },
        clearViewedCellHighlight: () => {
            const viewed = currentViewedCell.current;
            if (!viewed) return;

            const hotTableRef = hotTableRefsMap.current.get(viewed.sheetName);
            const hotInstance = hotTableRef?.hotInstance;
            if (hotInstance) {
                const existingMeta = hotInstance.getCellMeta(viewed.row, viewed.col).className;
                const existingClass = typeof existingMeta === 'string' ? existingMeta : '';
                const newClass = existingClass.replace(VIEWED_CELL_CLASS, '').trim();
                hotInstance.setCellMeta(viewed.row, viewed.col, 'className', newClass);
                hotInstance.render();
            }
            currentViewedCell.current = null;
        },
    }), [activeSheetName]);

    /**
     * Creates a cells callback for applying font styles from imported XLSX data
     */
    const createCellsCallback = useCallback((sheetName: string) => {
        const styles = sheetStyleData?.[sheetName];
        if (!styles || Object.keys(styles).length === 0) {
            return undefined;
        }

        return (row: number, col: number): { className?: string } => {
            const cellStyle = styles[`${row},${col}`];
            if (!cellStyle) return {};

            const classes: string[] = [];
            if (cellStyle.bold) classes.push('cell-bold');
            if (cellStyle.italic) classes.push('cell-italic');
            if (cellStyle.underline) classes.push('cell-underline');
            if (cellStyle.strikethrough) classes.push('cell-strikethrough');

            return classes.length > 0 ? { className: classes.join(' ') } : {};
        };
    }, [sheetStyleData]);

    const createAfterSelectionHandler = useCallback((sheetName: string): (startRow: number, startColumn: number, endRow: number, endCol: number) => void => {
        return (
            startRow: number,
            startColumn: number,
            endRow: number,
            endCol: number
        ): void => {
            if (sheetName !== activeSheetName) return;

            const hotTableRef = hotTableRefsMap.current.get(activeSheetName);
            const hotInstance = hotTableRef?.hotInstance;
            if (!hotInstance) return;

            const rawValue = hotInstance.getSourceDataAtCell(startRow, startColumn);
            const displayValue = rawValue === null || rawValue === undefined ? '' : String(rawValue);
            onCellSelect(displayValue, startRow, startColumn);

            // Report range selection (including single cell as 1x1 range)
            if (onRangeSelect) {
                onRangeSelect(startRow, startColumn, endRow, endCol);
            }
        };
    }, [onCellSelect, onRangeSelect, activeSheetName]);

    /**
     * Creates an afterChange handler to log all cell changes for debugging
     */
    const createAfterChangeHandler = useCallback((sheetName: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (changes: any[] | null, source: string): void => {
            if (!changes) return;
            log.debug(`Cell changes detected on ${sheetName} (source: ${source})`, changes);
        };
    }, []);

    /**
     * Handles scroll events by calculating viewport info and notifying parent
     */
    const handleScroll = useCallback((sheetName: string): void => {
        if (sheetName !== activeSheetName || !onViewportChange) return;

        const hotTableRef = hotTableRefsMap.current.get(sheetName);
        const hotInstance = hotTableRef?.hotInstance;
        if (!hotInstance) return;

        const viewport: ViewportInfo = {
            firstVisibleRow: hotInstance.getFirstPartiallyVisibleRow() ?? 0,
            lastVisibleRow: hotInstance.getLastPartiallyVisibleRow() ?? 0,
            firstVisibleCol: hotInstance.getFirstPartiallyVisibleColumn() ?? 0,
            lastVisibleCol: hotInstance.getLastPartiallyVisibleColumn() ?? 0,
            totalRows: hotInstance.countRows(),
            totalCols: hotInstance.countCols(),
        };

        onViewportChange(viewport, true);

        if (scrollTimeoutRef.current !== null) {
            window.clearTimeout(scrollTimeoutRef.current);
        }
        scrollTimeoutRef.current = window.setTimeout(() => {
            onViewportChange(viewport, false);
        }, SCROLL_HIDE_DELAY_MS);
    }, [activeSheetName, onViewportChange]);

    /**
     * Creates scroll handlers for horizontal and vertical scroll events
     */
    const createScrollHandler = useCallback((sheetName: string) => {
        return (): void => {
            handleScroll(sheetName);
        };
    }, [handleScroll]);

    // TODO: afterEdit hook ==> also an Edit can change current Value State
    return sheetNames.map((sheetName: string) => (
        <div
            key={sheetName}
            className={`hottable-container ${sheetName === activeSheetName ? 'sheet-visible' : 'sheet-hidden'}`}
        >
            <HotTable
                ref={(el) => {
                    if (el) {
                        hotTableRefsMap.current.set(sheetName, el);
                    }
                }}
                themeName="ht-theme-main"
                width="100%"
                height="100%"
                rowHeaders={true}
                colHeaders={true}
                colWidths={DEFAULT_COL_WIDTH}
                autoWrapRow={true}
                autoWrapCol={true}
                formulas={{
                    engine: hfInstance,
                    sheetName: sheetName,
                }}
                mergeCells={sheetMergeData?.[sheetName] ?? false}
                cells={createCellsCallback(sheetName)}
                contextMenu={true}
                /*
                 * AutoRow / Column ==> lead to critical error
                 * ==> to prevent this we have to fix that every sheet has same dimensions or
                 * make the datatable remount on every sheet change (because if we do not remount them they still get rendered in the background)
                 * and if then a hfInstance does not have correct dimensions with one of the hiddensheets ==> crashes
                 */
                licenseKey="non-commercial-and-evaluation"
                outsideClickDeselects={false}
                // HOOKS / EVENTS
                afterSelection={createAfterSelectionHandler(sheetName)}
                afterChange={createAfterChangeHandler(sheetName)}
                afterScrollHorizontally={createScrollHandler(sheetName)}
                afterScrollVertically={createScrollHandler(sheetName)}
            />
        </div>
    ));
}

export default memo(Datatable)