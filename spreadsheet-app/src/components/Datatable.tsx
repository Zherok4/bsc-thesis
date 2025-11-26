import { HotTable, type HotTableRef } from '@handsontable/react-wrapper';
import { memo, useCallback, useImperativeHandle, useRef } from 'react';
import { registerAllModules } from 'handsontable/registry';
import { HyperFormula } from 'hyperformula';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';

registerAllModules();

const DEFAULT_COL_WIDTH : number = 110;

interface DatatableProps {
    onCellSelect: (value: string, row: number, col: number) => void;
    hfInstance : (HyperFormula);
    ref?: React.Ref<DatatableHandle>;
}
export interface DatatableHandle {
    updateCell: (newValue: string, row: number, col: number) => void;
    selectCell: (row: number, col: number) => void;
    loadData: (data: (string | number | null)[][]) => void;
    switchSheet: (sheetName : string) => void;
}

const Datatable = ({onCellSelect, hfInstance, ref} : DatatableProps) => {
    const hotTableRef = useRef<HotTableRef>(null);

    useImperativeHandle(ref, () => ({
        updateCell: (newValue: string, row: number, col: number) => {
            const hotInstance = hotTableRef.current?.hotInstance;
            if (hotInstance) {
                hotInstance.setDataAtCell(row, col, newValue)
            }
        },
        selectCell: (row: number, col: number) => {
            const hotInstance = hotTableRef.current?.hotInstance;
            if (hotInstance) {
                hotInstance.selectCell(row, col);
            }
        },
        loadData: (data: (string | number | null)[][]) => {
            const hotInstance = hotTableRef.current?.hotInstance;
            if (hotInstance) {
                hotInstance.loadData(data);
            }
        },
        switchSheet: (sheetName : string) => {
            const hotInstance = hotTableRef.current?.hotInstance;
            if (hotInstance) {
                hotInstance.getPlugin('formulas').switchSheet(sheetName);
            }
        }
    }), []);

    // TODO: Write documentation
    const handleAfterSelection = useCallback((
        startRow: number,
        startColumn: number,
        endRow: number,
        endCol: number
        ) => {
            const hotInstance = hotTableRef.current?.hotInstance;
            if (!hotInstance) return;
            const rawValue = hotInstance.getSourceDataAtCell(startRow, startColumn);
            const displayValue = rawValue === null || rawValue === undefined ? '' : String(rawValue);
            onCellSelect(displayValue, startRow, startColumn)
        }
    , [onCellSelect]);

    // TODO: Write documentation
    // afterEdit hook ==> also an Edit can change current Value State
    return (
        <HotTable
        ref = {hotTableRef}
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
            sheetName: 'defaultSheet',
        }}
        contextMenu={true}
        licenseKey="non-commercial-and-evaluation"
        outsideClickDeselects={false}
        // HOOKS / EVENTS
        afterSelection={handleAfterSelection}
    />
    );
}

export default memo(Datatable)