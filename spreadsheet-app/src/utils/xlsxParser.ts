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
 * Converts Excel column letter(s) to zero-based index (e.g., "A" -> 0, "Z" -> 25, "AA" -> 26)
 */
function columnLetterToIndex(letters: string): number {
    let index = 0;
    for (let i = 0; i < letters.length; i++) {
        index = index * 26 + (letters.charCodeAt(i) - 64);
    }
    return index - 1;
}

/**
 * Parses an Excel-style merge range string (e.g., "A1:C3") into Handsontable merge settings.
 * Adjusts coordinates based on sheet dimensions offset.
 */
function parseMergeRange(mergeRange: string, offsetRow: number, offsetCol: number): MergeCellSettings | null {
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
}

/**
 * Extracts font style from an ExcelJS cell if it has any styling
 */
function extractCellStyle(cell: ExcelJS.Cell): CellStyle | null {
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
}

/**
 * Appends an empty buffer column to all rows for expansion.
 */
function appendBufferColumn(data: ExcelJS.CellValue[][]): ExcelJS.CellValue[][] {
    return data.map(row => [...row, '']);
}

/**
 * Reads an xlsx workbook from a File object
 */
export async function readXlsxWorkbookFromFile(file: File): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = await file.arrayBuffer();
    await workbook.xlsx.load(arrayBuffer);
    return workbook;
}

/**
 * Reads an xlsx workbook from an ArrayBuffer
 */
export async function readXlsxWorkbookFromArrayBuffer(arrayBuffer: ArrayBuffer): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    return workbook;
}

/**
 * Converts an ExcelJS workbook to ImportResult format
 */
export function convertXlsxWorkbookToImportResult(workbook: ExcelJS.Workbook): ImportResult {
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
            const rowData: ExcelJS.CellValue[] = [];
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
    });

    return { sheetData, mergeData, styleData };
}

/**
 * Parses an xlsx file and returns ImportResult
 * @param file - The File object to parse
 */
export async function parseXlsxFile(file: File): Promise<ImportResult> {
    const workbook = await readXlsxWorkbookFromFile(file);
    return convertXlsxWorkbookToImportResult(workbook);
}

/**
 * Parses an xlsx ArrayBuffer and returns ImportResult
 * @param arrayBuffer - The ArrayBuffer containing xlsx data
 */
export async function parseXlsxArrayBuffer(arrayBuffer: ArrayBuffer): Promise<ImportResult> {
    const workbook = await readXlsxWorkbookFromArrayBuffer(arrayBuffer);
    return convertXlsxWorkbookToImportResult(workbook);
}
