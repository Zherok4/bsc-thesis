import './TopBar.css';
import { useRef, type JSX } from 'react';
import ExcelJS from 'exceljs';

/**
 * Represents a single merged cell region in Handsontable format
 */
export interface MergeCellSettings {
    row: number;
    col: number;
    rowspan: number;
    colspan: number;
}

/**
 * Represents font styling for a cell
 */
export interface CellStyle {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
}

/**
 * Maps cell coordinates to their styles using "row,col" string keys
 */
export type SheetStyleData = { [cellKey: string]: CellStyle };

/**
 * Import result containing sheet data, merge information, and cell styles
 */
export interface ImportResult {
    sheetData: { [key: string]: (ExcelJS.CellValue)[][] };
    mergeData: { [key: string]: MergeCellSettings[] };
    styleData: { [key: string]: SheetStyleData };
}

/**
 * Props for the TopBar component
 */
interface TopBarProps {
    /** Callback invoked when an Excel file is successfully imported */
    onImport: (result: ImportResult) => void;
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

    /**
     * Parses an Excel-style merge range string (e.g., "A1:C3") into Handsontable merge settings.
     * Adjusts coordinates based on sheet dimensions offset.
     */
    const parseMergeRange = (mergeRange: string, offsetRow: number, offsetCol: number): MergeCellSettings | null => {
        const match = mergeRange.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
        if (!match) return null;

        const startCol = columnLetterToIndex(match[1]);
        const startRow = parseInt(match[2], 10) - 1;
        const endCol = columnLetterToIndex(match[3]);
        const endRow = parseInt(match[4], 10) - 1;

        return {
            row: startRow - offsetRow,
            col: startCol - offsetCol,
            rowspan: endRow - startRow + 1,
            colspan: endCol - startCol + 1,
        };
    };

    /**
     * Converts Excel column letter(s) to zero-based index (e.g., "A" -> 0, "Z" -> 25, "AA" -> 26)
     */
    const columnLetterToIndex = (letters: string): number => {
        let index = 0;
        for (let i = 0; i < letters.length; i++) {
            index = index * 26 + (letters.charCodeAt(i) - 64);
        }
        return index - 1;
    };

    /**
     * Extracts font style from an ExcelJS cell if it has any styling
     */
    const extractCellStyle = (cell: ExcelJS.Cell): CellStyle | null => {
        const font = cell.font;
        if (!font) return null;

        const style: CellStyle = {};
        let hasStyle = false;

        if (font.bold) {
            style.bold = true;
            hasStyle = true;
        }
        if (font.italic) {
            style.italic = true;
            hasStyle = true;
        }
        if (font.underline) {
            style.underline = true;
            hasStyle = true;
        }
        if (font.strike) {
            style.strikethrough = true;
            hasStyle = true;
        }

        return hasStyle ? style : null;
    };

    /**
     * Appends an empty buffer column to all rows for expansion.
     */
    const appendBufferColumn = (data: ExcelJS.CellValue[][]): ExcelJS.CellValue[][] => {
        return data.map(row => [...row, '']);
    };

    const convertXlsxWorkbookToImportResult = (workbook: ExcelJS.Workbook): ImportResult => {
        const sheetData: { [key: string]: (ExcelJS.CellValue)[][] } = {};
        const mergeData: { [key: string]: MergeCellSettings[] } = {};
        const styleData: { [key: string]: SheetStyleData } = {};

        workbook.eachSheet((worksheet: ExcelJS.Worksheet) => {
            const sheetDimensions: ExcelJS.Range = worksheet.dimensions;
            const data: ExcelJS.CellValue[][] = [];
            const styles: SheetStyleData = {};

            const offsetRow = sheetDimensions.top - 1;
            const offsetCol = sheetDimensions.left - 1;
            const numRows = sheetDimensions.bottom - sheetDimensions.top + 1;
            const numCols = sheetDimensions.right - sheetDimensions.left + 1;

            for (let rowNum: number = sheetDimensions.top; rowNum <= sheetDimensions.bottom; rowNum++) {
                const rowData: ExcelJS.CellValue[] = []
                const adjustedRow = rowNum - sheetDimensions.top;

                for (let colNum = sheetDimensions.left; colNum <= sheetDimensions.right; colNum++) {
                    const cell: ExcelJS.Cell = worksheet.getCell(rowNum, colNum);
                    const adjustedCol = colNum - sheetDimensions.left;

                    const cellData: ExcelJS.CellValue = cell.formula ? `=${cell.formula}` : cell.value;
                    rowData.push(cellData);

                    // Extract cell style if present
                    const cellStyle = extractCellStyle(cell);
                    if (cellStyle) {
                        styles[`${adjustedRow},${adjustedCol}`] = cellStyle;
                    }
                }

                data.push(rowData);
            }

            sheetData[worksheet.name] = appendBufferColumn(data);
            styleData[worksheet.name] = styles;

            // Extract merge information with bounds validation
            const merges: MergeCellSettings[] = [];
            const worksheetMerges = (worksheet.model as { merges?: string[] }).merges;
            if (worksheetMerges) {
                for (const mergeRange of worksheetMerges) {
                    const parsed = parseMergeRange(mergeRange, offsetRow, offsetCol);
                    if (parsed) {
                        // Validate merge is within data bounds
                        if (parsed.row >= 0 && parsed.col >= 0 &&
                            parsed.row + parsed.rowspan <= numRows &&
                            parsed.col + parsed.colspan <= numCols) {
                            merges.push(parsed);
                        } else {
                            console.warn(`Skipping out-of-bounds merge: ${mergeRange}`, parsed);
                        }
                    }
                }
            }
            mergeData[worksheet.name] = merges;
        })

        return { sheetData, mergeData, styleData };
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const xlsxWorkbook = await readXlsxWorkbookFromFile(file);
            const importResult = convertXlsxWorkbookToImportResult(xlsxWorkbook);
            onImport(importResult);
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
