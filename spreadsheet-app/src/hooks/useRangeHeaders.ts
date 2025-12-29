import { useMemo } from 'react';
import type { HyperFormula } from 'hyperformula';
import { findCellHeaders, type CellHeaders } from '../utils/cellHeaders';

/**
 * Result for range header lookup
 */
export interface UseRangeHeadersResult {
    /** Headers for the start cell */
    startHeaders: CellHeaders;
    /** Headers for the end cell */
    endHeaders: CellHeaders;
    /** Pre-formatted label for display */
    label: string;
}

/**
 * Truncates a string if it exceeds max length
 */
function truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 1) + '\u2026';
}

/**
 * Custom hook to find and format headers for a cell range.
 * Handles deduplication when start and end are in the same column or row.
 *
 * @param hfInstance - HyperFormula instance
 * @param sheetId - Sheet ID (undefined if sheet not found)
 * @param startRow - Zero-indexed start row
 * @param startCol - Zero-indexed start column
 * @param endRow - Zero-indexed end row
 * @param endCol - Zero-indexed end column
 * @param maxLabelLength - Maximum length per header segment (default: 10)
 * @returns Object with start/end headers and formatted label
 *
 * @example
 * // Range B2:B5 (same column) with column header "Price" and row headers "Apple", "Orange"
 * // label: "Price (Apple...Orange)"
 *
 * // Range B2:D2 (same row) with row header "Apple" and column headers "Price", "Total"
 * // label: "Apple (Price...Total)"
 *
 * // Range B2:D5 (different rows and columns)
 * // label: "Apple: Price...Orange: Total"
 */
export function useRangeHeaders(
    hfInstance: HyperFormula,
    sheetId: number | undefined,
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
    maxLabelLength: number = 10
): UseRangeHeadersResult {
    return useMemo<UseRangeHeadersResult>(() => {
        const emptyResult: UseRangeHeadersResult = {
            startHeaders: { columnHeader: null, rowHeader: null },
            endHeaders: { columnHeader: null, rowHeader: null },
            label: '',
        };

        if (sheetId === undefined) {
            return emptyResult;
        }

        const startHeaders = findCellHeaders(hfInstance, sheetId, startRow, startCol);
        const endHeaders = findCellHeaders(hfInstance, sheetId, endRow, endCol);

        // Build the label with deduplication
        const sameColumn = startCol === endCol;
        const sameRow = startRow === endRow;

        let label = '';

        if (sameColumn && sameRow) {
            // Single cell (shouldn't happen for ranges, but handle it)
            const parts: string[] = [];
            if (startHeaders.rowHeader) parts.push(truncate(startHeaders.rowHeader, maxLabelLength));
            if (startHeaders.columnHeader) parts.push(truncate(startHeaders.columnHeader, maxLabelLength));
            label = parts.join(': ');
        } else if (sameColumn) {
            // Vertical range - same column header, different row headers
            const colPart = startHeaders.columnHeader
                ? truncate(startHeaders.columnHeader, maxLabelLength)
                : '';
            const startRowPart = startHeaders.rowHeader
                ? truncate(startHeaders.rowHeader, maxLabelLength)
                : '';
            const endRowPart = endHeaders.rowHeader
                ? truncate(endHeaders.rowHeader, maxLabelLength)
                : '';

            if (colPart && (startRowPart || endRowPart)) {
                const rowRange = [startRowPart, endRowPart].filter(Boolean).join('...');
                label = `${colPart} (${rowRange})`;
            } else if (colPart) {
                label = colPart;
            } else if (startRowPart || endRowPart) {
                label = [startRowPart, endRowPart].filter(Boolean).join('...');
            }
        } else if (sameRow) {
            // Horizontal range - same row header, different column headers
            const rowPart = startHeaders.rowHeader
                ? truncate(startHeaders.rowHeader, maxLabelLength)
                : '';
            const startColPart = startHeaders.columnHeader
                ? truncate(startHeaders.columnHeader, maxLabelLength)
                : '';
            const endColPart = endHeaders.columnHeader
                ? truncate(endHeaders.columnHeader, maxLabelLength)
                : '';

            if (rowPart && (startColPart || endColPart)) {
                const colRange = [startColPart, endColPart].filter(Boolean).join('...');
                label = `${rowPart} (${colRange})`;
            } else if (rowPart) {
                label = rowPart;
            } else if (startColPart || endColPart) {
                label = [startColPart, endColPart].filter(Boolean).join('...');
            }
        } else {
            // Rectangular range - show corner headers
            const formatCorner = (h: CellHeaders): string => {
                const parts: string[] = [];
                if (h.rowHeader) parts.push(truncate(h.rowHeader, maxLabelLength));
                if (h.columnHeader) parts.push(truncate(h.columnHeader, maxLabelLength));
                return parts.join(': ');
            };

            const startPart = formatCorner(startHeaders);
            const endPart = formatCorner(endHeaders);

            if (startPart && endPart) {
                label = `${startPart}...${endPart}`;
            } else {
                label = startPart || endPart;
            }
        }

        return { startHeaders, endHeaders, label };
    }, [hfInstance, sheetId, startRow, startCol, endRow, endCol, maxLabelLength]);
}
