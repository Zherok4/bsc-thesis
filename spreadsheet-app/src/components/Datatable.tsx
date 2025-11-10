import { HotTable, type HotTableRef } from '@handsontable/react-wrapper';
import { useRef } from 'react';
import { registerAllModules } from 'handsontable/registry';
import Handsontable from 'handsontable';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';

registerAllModules();

const ROWS : number = 100;
const COLS : number = 26;
const INIT_DATA = Array(ROWS).fill(null).map(() => Array(COLS).fill(null));

interface DatatableProps {
    onCellSelect: (value: string) => void
}

const Datatable = ({onCellSelect} : DatatableProps) => {
    const hotTableRef = useRef<HotTableRef>(null);

    const handleAfterSelection = (row: number, column: number, row2: number, column2: number) => {
        const hotInstance = hotTableRef.current?.hotInstance;
        const cellValue = hotInstance?.getDataAtCell(row, column);
        onCellSelect(cellValue !== null ? String(cellValue) : '')
    };

    return (
        <HotTable
        ref = {hotTableRef}
        themeName="ht-theme-main"
        data={INIT_DATA}
        width="100%"
        height= "auto"
        rowHeaders={true}
        colHeaders={true}
        colWidths={110}
        autoWrapRow={true}
        autoWrapCol={true}
        contextMenu={true}
        licenseKey="non-commercial-and-evaluation"
        // HOOKS
        afterSelection={handleAfterSelection}

    />
    );
}

export default Datatable