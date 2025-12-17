import type { HyperFormula } from 'hyperformula';

/**
 * Evaluates a formula using HyperFormula and returns the result as a string.
 * Handles empty formulas, array results, and errors gracefully.
 *
 * @param formula - The formula string to evaluate (with or without leading "=")
 * @param hfInstance - HyperFormula instance for calculation
 * @param activeSheetName - Name of the sheet to evaluate the formula in
 * @returns The evaluated result as a string, or error indicator
 */
export function evaluateFormula(
    formula: string,
    hfInstance: HyperFormula,
    activeSheetName: string
): string {
    if (!formula || formula.trim() === '') {
        return '';
    }

    try {
        const sheetId = hfInstance.getSheetId(activeSheetName);
        if (sheetId === undefined) {
            return '#SHEET?';
        }

        // HyperFormula requires formulas to start with "="
        const formulaToEvaluate = formula.startsWith('=') ? formula : `=${formula}`;
        const result = hfInstance.calculateFormula(formulaToEvaluate, sheetId);

        if (result === null || result === undefined) {
            return '';
        }

        // Handle array results (e.g., from array formulas)
        if (Array.isArray(result)) {
            if (Array.isArray(result[0])) {
                return `${result[0][0]}, ...`;
            }
            return `${result[0]}, ...`;
        }

        return String(result);
    } catch (error) {
        console.error('Formula evaluation error:', error);
        return '#ERROR';
    }
}
