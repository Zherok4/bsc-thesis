import { HotTable } from '@handsontable/react-wrapper';

const ROWS : number = 100;
const COLS : number = 26;
const INIT_DATA = Array(ROWS).fill(null).map(() => Array(COLS).fill(null));

const Datatable = () => {
    return (
        <HotTable
        themeName="ht-theme-main"
        data={INIT_DATA}
        width="100%"
        height= "100vh"
        rowHeaders={true}
        colHeaders={true}
        colWidths={100}
        autoWrapRow={true}
        autoWrapCol={true}
        licenseKey="non-commercial-and-evaluation"
    />
    );
}

export default Datatable