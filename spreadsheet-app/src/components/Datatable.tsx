import { HotTable, type HotTableRef } from '@handsontable/react-wrapper';
import { memo, useCallback, useImperativeHandle, useRef, useMemo, useEffect } from 'react';
import { registerAllModules } from 'handsontable/registry';
import { HyperFormula } from 'hyperformula';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';

registerAllModules();

const DEFAULT_COL_WIDTH : number = 110;

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
}

const Datatable = ({onCellSelect, hfInstance, activeSheetName, sheetsVersion, ref} : DatatableProps) => {
    const hotTableRefsMap = useRef<Map<string, HotTableRef | null>>(new Map());

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
        }
    }), [activeSheetName]);

    // TODO: Write documentation
    const createAfterSelectionHandler = useCallback((sheetName: string) => {
        return (
            startRow: number,
            startColumn: number,
            endRow: number,
            endCol: number
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