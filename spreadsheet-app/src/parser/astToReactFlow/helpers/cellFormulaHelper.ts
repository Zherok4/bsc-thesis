import { collapseNode, type CollapsedNode } from "../../collapseAST";
import { parseFormula } from "../../visitor";
import type { ExpansionContext } from "../types";

/**
 * Helper functions for working with cell formulas during expansion
 */

/**
 * Retrieves a cell's formula and returns it as a CollapsedNode for expansion.
 * Used when expanding cell references to show their underlying formula.
 *
 * @param reference - The cell reference (e.g., "A1")
 * @param sheet - Optional sheet name for cross-sheet references
 * @param context - The expansion context containing the HyperFormula instance
 * @returns The collapsed AST node, or null if the cell has no formula
 */
export function getCellFormulaAsCollapsedNode(
    reference: string,
    sheet: string | undefined,
    context: ExpansionContext
): CollapsedNode | null {
    try {
        const sheetName = sheet || context.activeSheetName;
        const sheetId = context.hfInstance.getSheetId(sheetName);

        if (sheetId === undefined) {
            return null;
        }

        const cellAddress = context.hfInstance.simpleCellAddressFromString(
            reference,
            sheetId
        );

        if (!cellAddress) {
            return null;
        }

        const formulaString = context.hfInstance.getCellFormula(cellAddress);

        if (!formulaString) {
            return null;
        }

        // Parse the formula and collapse it
        const ast = parseFormula(formulaString);

        if (!ast) {
            return null;
        }

        return collapseNode(ast);
    } catch (error) {
        console.error(`Failed to parse formula for cell ${reference}:`, error);
        return null;
    }
}
