import './TopBar.css';
import { useRef } from 'react';
import type { Sheet } from './SheetTabs';
import ExcelJS from 'exceljs';

interface TopBarProps {
    onImport: (sheetsAsJavascriptArrays: {[key: string]: (ExcelJS.CellValue)[][]}) => void;
}

// TODO: Convert so that it uses HyperFormula Engine
const TopBar = ({ onImport } : TopBarProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const readXlsxWorkbookFromFile = async (file: File) => {
        const workbook = new ExcelJS.Workbook();
        const arrayBuffer = await file.arrayBuffer();
        await workbook.xlsx.load(arrayBuffer);

        return workbook;
    }

    const convertXlsxWorkbookToJavascriptArrays = (workbook: ExcelJS.Workbook) => {
        const workbookData: {[key: string]: (ExcelJS.CellValue)[][]} = {};

        workbook.eachSheet((worksheet: ExcelJS.Worksheet) => {
            const sheetDimensions: ExcelJS.Range = worksheet.dimensions;
            const sheetData: any[] = [];

            for (let rowNum: number = sheetDimensions.top; rowNum <= sheetDimensions.bottom; rowNum++) {
                const rowData: any[] = []

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

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    const handleButtonClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="top-bar">
            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                style={{ display: 'none' }}
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
