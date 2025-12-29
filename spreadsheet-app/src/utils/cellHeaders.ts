import type { HyperFormula, CellValue } from 'hyperformula';

/**
 * Result of header detection for a single cell
 */
export interface CellHeaders {
    /** Column header text (found by looking upward), null if none found */
    columnHeader: string | null;
    /** Row header text (found by looking leftward), null if none found */
    rowHeader: string | null;
}

/**
 * Checks if a CellValue represents a string header
 * @param value - The cell value to check
 * @returns True if value is a non-empty string
 */
function isStringHeader(value: CellValue): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Checks if a CellValue is empty (null, undefined, or empty string)
 * @param value - The cell value to check
 * @returns True if value is considered empty
 */
function isEmpty(value: CellValue): boolean {
    return value === null || value === undefined || value === '';
}

/**
 * Finds the column header for a cell by searching upward in the same column.
 * Stops searching when an empty cell is encountered.
 *
 * @param hfInstance - HyperFormula instance
 * @param sheetId - The sheet ID to search in
 * @param row - Zero-indexed row of the target cell
 * @param col - Zero-indexed column of the target cell
 * @returns The header string if found, null otherwise
 */
export function findColumnHeader(
    hfInstance: HyperFormula,
    sheetId: number,
    row: number,
    col: number
): string | null {
    // Start from the cell directly above the target
    for (let r = row - 1; r >= 0; r--) {
        const value = hfInstance.getCellValue({ sheet: sheetId, row: r, col });

        // If we hit an empty cell, stop searching (no continuous header chain)
        if (isEmpty(value)) {
            return null;
        }

        // If we find a string, it's a potential header
        if (isStringHeader(value)) {
            return value;
        }

        // If it's a number/boolean, continue searching upward
    }

    return null;
}

/**
 * Finds the row header for a cell by searching leftward in the same row.
 * Stops searching when an empty cell is encountered.
 *
 * @param hfInstance - HyperFormula instance
 * @param sheetId - The sheet ID to search in
 * @param row - Zero-indexed row of the target cell
 * @param col - Zero-indexed column of the target cell
 * @returns The header string if found, null otherwise
 */
export function findRowHeader(
    hfInstance: HyperFormula,
    sheetId: number,
    row: number,
    col: number
): string | null {
    // Start from the cell directly to the left of the target
    for (let c = col - 1; c >= 0; c--) {
        const value = hfInstance.getCellValue({ sheet: sheetId, row, col: c });

        // If we hit an empty cell, stop searching
        if (isEmpty(value)) {
            return null;
        }

        // If we find a string, it's a potential header
        if (isStringHeader(value)) {
            return value;
        }

        // If it's a number/boolean, continue searching leftward
    }

    return null;
}

/**
 * Finds both column and row headers for a given cell position.
 *
 * @param hfInstance - HyperFormula instance
 * @param sheetId - The sheet ID to search in
 * @param row - Zero-indexed row of the target cell
 * @param col - Zero-indexed column of the target cell
 * @returns Object containing columnHeader and rowHeader (both nullable)
 *
 * @example
 * // For cell D4 in a spreadsheet where:
 * // Row 1 contains: "ID", "Name", "Price", "Quantity"
 * // Column A contains: "ID", "Apple", "Banana", "Orange"
 * findCellHeaders(hf, 0, 3, 3) // { columnHeader: "Quantity", rowHeader: "Orange" }
 */
export function findCellHeaders(
    hfInstance: HyperFormula,
    sheetId: number,
    row: number,
    col: number
): CellHeaders {
    return {
        columnHeader: findColumnHeader(hfInstance, sheetId, row, col),
        rowHeader: findRowHeader(hfInstance, sheetId, row, col),
    };
}

/**
 * Truncates a string if it exceeds max length
 * @param str - String to truncate
 * @param maxLength - Maximum allowed length
 * @returns Truncated string with ellipsis if needed
 */
function truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 1) + '\u2026';
}

/**
 * Formats cell headers for display in a node label.
 *
 * @param headers - The CellHeaders object
 * @param maxLength - Maximum length for each header before truncation (default: 12)
 * @returns Formatted string like "Row: Column" or just "Column" or just "Row" or empty string
 *
 * @example
 * formatCellHeadersLabel({ columnHeader: "Price", rowHeader: "Apple" }) // "Apple: Price"
 * formatCellHeadersLabel({ columnHeader: "Price", rowHeader: null }) // "Price"
 * formatCellHeadersLabel({ columnHeader: null, rowHeader: "Apple" }) // "Apple"
 * formatCellHeadersLabel({ columnHeader: null, rowHeader: null }) // ""
 */
export function formatCellHeadersLabel(
    headers: CellHeaders,
    maxLength: number = 12
): string {
    const col = headers.columnHeader ? truncate(headers.columnHeader, maxLength) : null;
    const row = headers.rowHeader ? truncate(headers.rowHeader, maxLength) : null;

    if (row && col) {
        return `${row}: ${col}`;
    }
    if (col) {
        return col;
    }
    if (row) {
        return row;
    }
    return '';
}
