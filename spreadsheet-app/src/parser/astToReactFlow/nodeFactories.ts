import type { Node } from "@xyflow/react";
import { generateNodeId, getNodeIdCounter } from "./idGenerator";

/**
 * Factory functions for creating ReactFlow nodes.
 * Each function creates a specific type of node with the appropriate data structure.
 */

/**
 * Creates a default two-text node for generic expressions
 * @param label - The formula/expression to display
 */
export function createDefaultNode(label: string): Node {
    return {
        id: generateNodeId(),
        position: { x: 0, y: 100 * getNodeIdCounter() },
        data: { formula: label },
        type: "TwoTextNode",
    };
}

/**
 * Creates a cell reference node
 * @param reference - The cell reference (e.g., "A1", "B2")
 * @param sheet - Optional sheet name for cross-sheet references
 * @param hasFormula - Whether the referenced cell contains a formula (enables left handle)
 */
export function createReferenceNode(
    reference: string,
    sheet?: string,
    hasFormula: boolean = false
): Node {
    return {
        id: generateNodeId(),
        position: { x: 0, y: 100 * getNodeIdCounter() },
        data: { reference, sheet, hasFormula },
        type: "ReferenceNode",
    };
}

/**
 * Creates a cell range node
 * @param startReference - Start of the range (e.g., "A1")
 * @param endReference - End of the range (e.g., "B10")
 * @param sheet - Optional sheet name
 */
export function createRangeNode(
    startReference: string,
    endReference: string,
    sheet?: string
): Node {
    return {
        id: generateNodeId(),
        position: { x: 0, y: 100 * getNodeIdCounter() },
        data: { startReference, endReference, sheet },
        type: "RangeNode",
    };
}

/**
 * Creates a number literal node
 * @param value - The numeric value
 */
export function createNumNode(value: number): Node {
    return {
        id: generateNodeId(),
        position: { x: 0, y: 100 * getNodeIdCounter() },
        data: { value },
        type: "NumberNode",
    };
}

/**
 * Creates a string literal node
 * @param value - The string value
 */
export function createStringNode(value: string): Node {
    return {
        id: generateNodeId(),
        position: { x: 0, y: 100 * getNodeIdCounter() },
        data: { value },
        type: "StringNode",
    };
}

/**
 * Creates a function call node
 * @param funName - Name of the function (e.g., "SUM", "AVERAGE")
 * @param argFormulas - Array of formula strings for each argument
 * @param funFormula - The complete function formula string
 */
export function createFunctionNode(
    funName: string,
    argFormulas: string[],
    funFormula: string
): Node {
    return {
        id: generateNodeId(),
        position: { x: 0, y: 100 * getNodeIdCounter() },
        data: { funName, argFormulas, funFormula },
        type: "FunctionNode",
    };
}

/**
 * Creates a result node (top-level formula result)
 * @param formula - The formula string
 */
export function createResultNode(formula: string): Node {
    return {
        id: generateNodeId(),
        position: { x: 0, y: 100 * getNodeIdCounter() },
        data: { formula },
        type: "ResultNode",
    };
}

/**
 * Creates an expandable expression node that can be toggled to show/hide details
 * @param formula - The formula/expression string
 * @param isExpanded - Whether the node is currently expanded
 * @param onToggleExpand - Callback to toggle expansion state
 * @param isConnectedToFunctionArg - Whether this node is connected to a function argument handle
 */
export function createExpandableExpressionNode(
    formula: string,
    isExpanded: boolean,
    onToggleExpand: (nodeId: string) => void,
    isConnectedToFunctionArg: boolean = false
): Node {
    const nodeId = generateNodeId();
    return {
        id: nodeId,
        position: { x: 0, y: 100 * getNodeIdCounter() },
        data: {
            formula,
            isExpanded,
            onToggleExpand,
            nodeId,
            isConnectedToFunctionArg,
        },
        type: "ExpandableExpressionNode",
    };
}

/**
 * Creates a binary operation node
 * @param operator - The operator symbol (e.g., "+", "-", "*", "/")
 * @param leftConstant - Optional constant value for left operand
 * @param rightConstant - Optional constant value for right operand
 */
export function createBinOpNode(
    operator: string,
    leftConstant?: string,
    rightConstant?: string
): Node {
    return {
        id: generateNodeId(),
        position: { x: 0, y: 100 * getNodeIdCounter() },
        data: { operator, leftConstant, rightConstant },
        type: "BinOpNode",
    };
}
