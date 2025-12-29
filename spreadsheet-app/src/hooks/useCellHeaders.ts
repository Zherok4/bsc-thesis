import { useMemo } from 'react';
import type { HyperFormula } from 'hyperformula';
import { findCellHeaders, formatCellHeadersLabel, type CellHeaders } from '../utils/cellHeaders';

/**
 * Hook result containing headers and formatted label
 */
export interface UseCellHeadersResult {
    /** Raw header data */
    headers: CellHeaders;
    /** Pre-formatted label string for display */
    label: string;
}

/**
 * Custom hook to find and format cell headers for a given cell position.
 * Memoized to prevent unnecessary recalculations on re-render.
 *
 * @param hfInstance - HyperFormula instance
 * @param sheetId - Sheet ID (undefined if sheet not found)
 * @param row - Zero-indexed row number
 * @param col - Zero-indexed column number
 * @param maxLabelLength - Maximum length for header labels (default: 12)
 * @returns Object with raw headers and formatted label
 *
 * @example
 * const { headers, label } = useCellHeaders(hfInstance, sheetId, 3, 3);
 * // headers: { columnHeader: "Price", rowHeader: "Apple" }
 * // label: "Apple: Price"
 */
export function useCellHeaders(
    hfInstance: HyperFormula,
    sheetId: number | undefined,
    row: number,
    col: number,
    maxLabelLength: number = 12
): UseCellHeadersResult {
    return useMemo<UseCellHeadersResult>(() => {
        if (sheetId === undefined) {
            return {
                headers: { columnHeader: null, rowHeader: null },
                label: '',
            };
        }

        const headers = findCellHeaders(hfInstance, sheetId, row, col);
        const label = formatCellHeadersLabel(headers, maxLabelLength);

        return { headers, label };
    }, [hfInstance, sheetId, row, col, maxLabelLength]);
}
