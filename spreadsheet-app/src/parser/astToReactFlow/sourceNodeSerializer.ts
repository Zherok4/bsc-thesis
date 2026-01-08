import type { Node } from "@xyflow/react";

/**
 * Gets the formula/expression string that a source node represents.
 * This is the value that will be used to replace the target argument.
 * @param node - The ReactFlow source node
 * @param targetSheet - The sheet of the target cell (for cross-sheet reference handling)
 * @returns The formula string, or null if the node cannot be serialized
 */
export function getSourceNodeFormula(node: Node, targetSheet: string): string | null {
    const nodeType = node.type;
    const data = node.data;

    if (!nodeType || !data) {
        return null;
    }

    switch (nodeType) {
        case 'ReferenceNode': {
            const reference = data.reference as string;
            const sheet = data.sheet as string | undefined;

            // Add sheet prefix if cross-sheet reference
            if (sheet && sheet !== targetSheet) {
                return `${sheet}!${reference}`;
            }
            return reference;
        }

        case 'RangeNode': {
            const rangeType = data.rangeType as string;
            const sheet = data.sheet as string | undefined;
            let rangeStr: string;

            if (rangeType === 'cell') {
                const startRef = data.startReference as string;
                const endRef = data.endReference as string;
                rangeStr = `${startRef}:${endRef}`;
            } else if (rangeType === 'column') {
                const startCol = data.startColumn as string;
                const endCol = data.endColumn as string;
                rangeStr = `${startCol}:${endCol}`;
            } else if (rangeType === 'row') {
                const startRow = data.startRow as number;
                const endRow = data.endRow as number;
                rangeStr = `${startRow}:${endRow}`;
            } else {
                return null;
            }

            // Add sheet prefix if cross-sheet reference
            if (sheet && sheet !== targetSheet) {
                return `${sheet}!${rangeStr}`;
            }
            return rangeStr;
        }

        case 'FunctionNode':
        case 'ConditionalNode': {
            // Return the complete function formula
            const funFormula = data.funFormula as string;
            return funFormula || null;
        }

        case 'NumberNode': {
            const value = data.value as number;
            return String(value);
        }

        case 'StringNode': {
            const value = data.value as string;
            // Strings need to be quoted in formulas
            return `"${value}"`;
        }

        case 'ExpandableExpressionNode': {
            // Return the original formula
            const formula = data.formula as string;
            return formula || null;
        }

        case 'BinOpNode': {
            // BinOpNode doesn't store the full formula directly
            // We'd need to reconstruct it from left, operator, right
            // For now, return null as this is a complex case
            return null;
        }

        case 'ResultNode': {
            // ResultNode represents the top-level formula
            const formula = data.formula as string;
            // Remove the leading '=' if present
            if (formula && formula.startsWith('=')) {
                return formula.substring(1);
            }
            return formula || null;
        }

        default:
            return null;
    }
}
