import './TopBar.css';
import { useRef, type JSX } from 'react';
import ExcelJS from 'exceljs';

/**
 * Props for the TopBar component
 */
interface TopBarProps {
    /** Callback invoked when an Excel file is successfully imported */
    onImport: (sheetsAsJavascriptArrays: {[key: string]: (ExcelJS.CellValue)[][]}) => void;
}

/**
 * Top navigation bar component with file import functionality.
 * Allows users to import Excel files (.xlsx, .xls) into the spreadsheet.
 *
 * @param props - Component props
 * @param props.onImport - Callback to handle imported spreadsheet data
 */
// TODO: Convert so that it uses HyperFormula Engine
const TopBar = ({ onImport } : TopBarProps): JSX.Element => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const readXlsxWorkbookFromFile = async (file: File): Promise<ExcelJS.Workbook> => {
        const workbook = new ExcelJS.Workbook();
        const arrayBuffer = await file.arrayBuffer();
        await workbook.xlsx.load(arrayBuffer);

        return workbook;
    }

    const convertXlsxWorkbookToJavascriptArrays = (workbook: ExcelJS.Workbook): {[key: string]: (ExcelJS.CellValue)[][]} => {
        const workbookData: {[key: string]: (ExcelJS.CellValue)[][]} = {};

        workbook.eachSheet((worksheet: ExcelJS.Worksheet) => {
            const sheetDimensions: ExcelJS.Range = worksheet.dimensions;
            const sheetData: ExcelJS.CellValue[][] = [];

            for (let rowNum: number = sheetDimensions.top; rowNum <= sheetDimensions.bottom; rowNum++) {
                const rowData: ExcelJS.CellValue[] = []

                for (let colNum = sheetDimensions.left; colNum <= sheetDimensions.right; colNum++) {
                    const cell: ExcelJS.Cell = worksheet.getCell(rowNum, colNum)

                    const cellData: ExcelJS.CellValue = cell.formula ? `=${cell.formula}` : cell.value;
                    rowData.push(cellData); 
                }

                sheetData.push(rowData);
            }

            workbookData[worksheet.name] = sheetData;
        })

        return workbookData;
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const xlsxWorkbook = await readXlsxWorkbookFromFile(file);
            const sheetsAsJavascriptArrays = convertXlsxWorkbookToJavascriptArrays(xlsxWorkbook);
            onImport(sheetsAsJavascriptArrays)
        } catch(error) {
            alert('Failed to import file. Please make sure it is a valid Excel file.');
            console.error('Import error:', error);
        }
    }

    const handleButtonClick = (): void => {
        fileInputRef.current?.click();
    };

    return (
        <div className="top-bar">
            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="top-bar__hidden-input"
            />
            <button
                className="top-bar__import-button"
                onClick={handleButtonClick}
            >
                Import File
            </button>
        </div>
    );
}

export default TopBar;
