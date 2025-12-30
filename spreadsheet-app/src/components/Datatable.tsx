import { HotTable, type HotTableRef } from '@handsontable/react-wrapper';
import { memo, useCallback, useImperativeHandle, useRef, useMemo, useEffect, type JSX } from 'react';
import { registerAllModules } from 'handsontable/registry';
import { HyperFormula } from 'hyperformula';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';
import './Datatable.css';

registerAllModules();

const DEFAULT_COL_WIDTH : number = 110;
const HIGHLIGHT_CLASS = 'cell-highlight';
const VIEWED_CELL_CLASS = 'cell-viewed';

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
    /** HyperFormula instance for formula calculations */
    hfInstance: HyperFormula;
    /** Name of the currently active sheet */
    activeSheetName: string;
    /** Version counter to trigger re-renders when sheets change */
    sheetsVersion?: number;
    /** Ref for imperative handle access */
    ref?: React.Ref<DatatableHandle>;
}

/**
 * Imperative handle interface for controlling the Datatable externally
 */
export interface DatatableHandle {
    /** Update a cell's value at the specified position */
    updateCell: (newValue: string, row: number, col: number) => void;
    /** Select a cell at the specified position */
    selectCell: (row: number, col: number) => void;
    /** Load data into the active sheet */
    loadData: (data: (string | number | null)[][]) => void;
    /** Scroll the viewport to show a specific cell */
    scrollToCell: (row: number, col: number) => void;
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
const Datatable = ({onCellSelect, hfInstance, activeSheetName, sheetsVersion, ref}: DatatableProps): JSX.Element[] => {
    const hotTableRefsMap = useRef<Map<string, HotTableRef | null>>(new Map());
    const currentHighlight = useRef<HighlightRange | null>(null);
    const currentViewedCell = useRef<ViewedCell | null>(null);

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
            const hotTableRef = hotTableRefsMap.current.get(activeSheetName);
            const hotInstance = hotTableRef?.hotInstance;
            if (hotInstance) {
                hotInstance.setDataAtCell(row, col, newValue)
            }
        },
        selectCell: (row: number, col: number) => {
            const hotTableRef = hotTableRefsMap.current.get(activeSheetName);
            const hotInstance = hotTableRef?.hotInstance;
            if (hotInstance) {
                hotInstance.selectCell(row, col);
            }
        },
        loadData: (data: (string | number | null)[][]) => {
            const hotTableRef = hotTableRefsMap.current.get(activeSheetName);
            const hotInstance = hotTableRef?.hotInstance;
            if (hotInstance) {
                hotInstance.loadData(data);
            }
        },
        scrollToCell: (row: number, col: number) => {
            const hotTableRef = hotTableRefsMap.current.get(activeSheetName);
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

    const createAfterSelectionHandler = useCallback((sheetName: string): (startRow: number, startColumn: number, _endRow: number, _endCol: number) => void => {
        return (
            startRow: number,
            startColumn: number,
            _endRow: number,
            _endCol: number
        ): void => {
            if (sheetName !== activeSheetName) return;

            const hotTableRef = hotTableRefsMap.current.get(activeSheetName);
            const hotInstance = hotTableRef?.hotInstance;
            if (!hotInstance) return;

            const rawValue = hotInstance.getSourceDataAtCell(startRow, startColumn);
            const displayValue = rawValue === null || rawValue === undefined ? '' : String(rawValue);
            onCellSelect(displayValue, startRow, startColumn)
        }}
    , [onCellSelect, activeSheetName]);

    // TODO: afterEdit hook ==> also an Edit can change current Value State
    return (sheetNames.map((sheetName: string) => (
        <div
            key={sheetName}
            className={`hottable-container ${sheetName === activeSheetName ? 'sheet-visible' : 'sheet-hidden'}`}
        >
            <HotTable
                ref = {(el) => {
                    if (el) {
                        hotTableRefsMap.current.set(sheetName, el);
                    }}
                }
                themeName="ht-theme-main"
                width="100%"
                height= "100%"
                rowHeaders={true}
                colHeaders={true}
                colWidths={DEFAULT_COL_WIDTH}
                autoWrapRow={true}
                autoWrapCol={true}
                formulas={{
                    engine: hfInstance,
                    sheetName: sheetName,
                }}
                minCols = {100}
                contextMenu={true}
                // AutoRow / Column ==> lead to critical error ==> to prevent this we have to fix that ever sheet has same dimensions
                //autoRowSize={true}
                //autoColumnSize={true}
                licenseKey="non-commercial-and-evaluation"
                outsideClickDeselects={false}
                // HOOKS / EVENTS
                afterSelection={createAfterSelectionHandler(sheetName)}
        />
        </div>
    )));
}

export default memo(Datatable)