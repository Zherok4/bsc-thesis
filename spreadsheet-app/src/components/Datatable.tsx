import { HotTable, type HotTableRef } from '@handsontable/react-wrapper';
import { memo, useCallback, useImperativeHandle, useRef, useMemo, useEffect } from 'react';
import { registerAllModules } from 'handsontable/registry';
import { HyperFormula } from 'hyperformula';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';

registerAllModules();

const DEFAULT_COL_WIDTH : number = 110;
const HIGHLIGHT_CLASS = 'cell-highlight';

interface HighlightRange {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
    sheetName: string;
}

interface DatatableProps {
    onCellSelect: (value: string, row: number, col: number) => void;
    hfInstance : (HyperFormula);
    activeSheetName : string;
    sheetsVersion?: number;
    ref?: React.Ref<DatatableHandle>;
}
export interface DatatableHandle {
    updateCell: (newValue: string, row: number, col: number) => void;
    selectCell: (row: number, col: number) => void;
    loadData: (data: (string | number | null)[][]) => void;
    scrollToCell: (row: number, col: number) => void;
    highlightCells: (startRow: number, startCol: number, endRow: number, endCol: number, sheet?: string) => void;
    clearHighlight: () => void;
}

const Datatable = ({onCellSelect, hfInstance, activeSheetName, sheetsVersion, ref} : DatatableProps) => {
    const hotTableRefsMap = useRef<Map<string, HotTableRef | null>>(new Map());
    const currentHighlight = useRef<HighlightRange | null>(null);

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
            if (hotInstance) {
                hotInstance.scrollViewportTo({row, col, verticalSnap: 'top', horizontalSnap: 'start'});
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
    }), [activeSheetName]);

    // TODO: Write documentation
    const createAfterSelectionHandler = useCallback((sheetName: string) => {
        return (
            startRow: number,
            startColumn: number,
            _endRow: number,
            _endCol: number
        ) => {
            if (sheetName !== activeSheetName) return;

            const hotTableRef = hotTableRefsMap.current.get(activeSheetName);
            const hotInstance = hotTableRef?.hotInstance;
            if (!hotInstance) return;

            const rawValue = hotInstance.getSourceDataAtCell(startRow, startColumn);
            const displayValue = rawValue === null || rawValue === undefined ? '' : String(rawValue);
            onCellSelect(displayValue, startRow, startColumn)
        }}
    , [onCellSelect, activeSheetName]);

    // TODO: Write documentation
    // afterEdit hook ==> also an Edit can change current Value State
    return (sheetNames.map((sheetName: string) => (
        <div 
            key = {sheetName}
            className="hottable-container"
            style = {{
                display: sheetName === activeSheetName ? 'block' : 'none',
            }}
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
                licenseKey="non-commercial-and-evaluation"
                outsideClickDeselects={false}
                // HOOKS / EVENTS
                afterSelection={createAfterSelectionHandler(sheetName)}
        />
        </div>
    )));
}

export default memo(Datatable)