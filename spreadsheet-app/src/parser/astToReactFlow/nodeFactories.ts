import type { Node } from "@xyflow/react";
import { generateNodeId, getNodeIdCounter } from "./idGenerator";
import type { ConstantArgInfo } from "../../components/nodes/FunctionNode";
import type { ConstantArgInfo as ConditionalConstantArgInfo } from "../../components/nodes/ConditionalNode";
import type { ConstantOperandInfo } from "../../components/nodes/BinOpNode";

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
 * Configuration for expandable reference nodes
 */
interface ReferenceExpansionConfig {
    /** Whether this node is currently expanded */
    isExpanded: boolean;
    /** Callback to toggle expansion state */
    onToggleExpand: (nodeId: string) => void;
    /** Stable ID used for tracking expansion state */
    expansionNodeId: string;
}

/**
 * Creates a cell reference node
 * @param reference - The cell reference (e.g., "A1", "B2")
 * @param sheet - Optional sheet name for cross-sheet references
 * @param hasFormula - Whether the referenced cell contains a formula (enables left handle)
 * @param expansionConfig - Optional expansion configuration (only used when hasFormula is true)
 * @param astNodeId - Optional AST node ID for identifying this node during edits
 */
export function createReferenceNode(
    reference: string,
    sheet?: string,
    hasFormula: boolean = false,
    expansionConfig?: ReferenceExpansionConfig,
    astNodeId?: string
): Node {
    return {
        id: generateNodeId(),
        position: { x: 0, y: 100 * getNodeIdCounter() },
        data: {
            reference,
            sheet,
            hasFormula,
            astNodeId,
            ...(hasFormula && expansionConfig ? {
                isExpanded: expansionConfig.isExpanded,
                onToggleExpand: expansionConfig.onToggleExpand,
                expansionNodeId: expansionConfig.expansionNodeId,
            } : {}),
        },
        type: "ReferenceNode",
    };
}

/**
 * Creates a cell range node
 * @param startReference - Start of the range (e.g., "A1")
 * @param endReference - End of the range (e.g., "B10")
 * @param sheet - Sheet name where this range resides
 */
export function createRangeNode(
    startReference: string,
    endReference: string,
    sheet: string
): Node {
    return {
        id: generateNodeId(),
        position: { x: 0, y: 100 * getNodeIdCounter() },
        data: { startReference, endReference, sheet, rangeType: "cell" },
        type: "RangeNode",
    };
}

/**
 * Creates a column range node (e.g., "A:B", "$A:$C")
 * @param startColumn - Start column (e.g., "A")
 * @param endColumn - End column (e.g., "B")
 * @param sheet - Sheet name where this range resides
 */
export function createColumnRangeNode(
    startColumn: string,
    endColumn: string,
    sheet: string
): Node {
    return {
        id: generateNodeId(),
        position: { x: 0, y: 100 * getNodeIdCounter() },
        data: { startColumn, endColumn, sheet, rangeType: "column" },
        type: "RangeNode",
    };
}

/**
 * Creates a row range node (e.g., "1:10", "$1:$5")
 * @param startRow - Start row number
 * @param endRow - End row number
 * @param sheet - Sheet name where this range resides
 */
export function createRowRangeNode(
    startRow: number,
    endRow: number,
    sheet: string
): Node {
    return {
        id: generateNodeId(),
        position: { x: 0, y: 100 * getNodeIdCounter() },
        data: { startRow, endRow, sheet, rangeType: "row" },
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
 * @param sheet - The sheet name where this function resides
 * @param constantArgs - Optional map of argument index to constant info for editable constants
 */
export function createFunctionNode(
    funName: string,
    argFormulas: string[],
    funFormula: string,
    sheet: string,
    constantArgs?: Record<number, ConstantArgInfo>
): Node {
    return {
        id: generateNodeId(),
        position: { x: 0, y: 100 * getNodeIdCounter() },
        data: { funName, argFormulas, funFormula, sheet, constantArgs },
        type: "FunctionNode",
    };
}

/**
 * Creates a result node (top-level formula result)
 * @param formula - The formula string
 * @param sheet - The sheet name where this result node was created
 */
export function createResultNode(formula: string, sheet: string): Node {
    return {
        id: generateNodeId(),
        position: { x: 0, y: 100 * getNodeIdCounter() },
        data: { formula, sheet },
        type: "ResultNode",
    };
}

/** Represents an argument input with a label (A, B, C...) and optional constant value */
interface ExpressionArgument {
    /** The label for this argument (A, B, C, ...) */
    label: string;
    /** The original formula/reference this argument represents */
    originalFormula: string;
    /** If this is a constant value, store it here (won't have a handle) */
    constantValue?: string;
}

/**
 * Creates an expandable expression node that can be toggled to show/hide details.
 * Uses named arguments (A, B, C...) to represent inputs.
 * @param formula - The original formula/expression string for evaluation
 * @param displayFormula - The formula with references replaced by argument labels
 * @param args - Array of arguments with labels A, B, C...
 * @param isExpanded - Whether the node is currently expanded
 * @param onToggleExpand - Callback to toggle expansion state
 * @param isConnectedToFunctionArg - Whether this node is connected to a function argument handle
 * @param sheet - The sheet name where this expression resides
 */
export function createExpandableExpressionNode(
    formula: string,
    displayFormula: string,
    args: ExpressionArgument[],
    isExpanded: boolean,
    onToggleExpand: (nodeId: string) => void,
    isConnectedToFunctionArg: boolean = false,
    sheet: string = ""
): Node {
    const nodeId = generateNodeId();
    return {
        id: nodeId,
        position: { x: 0, y: 100 * getNodeIdCounter() },
        data: {
            formula,
            displayFormula,
            arguments: args,
            isExpanded,
            onToggleExpand,
            nodeId,
            isConnectedToFunctionArg,
            sheet,
        },
        type: "ExpandableExpressionNode",
    };
}

/**
 * Creates a binary operation node
 * @param operator - The operator symbol (e.g., "+", "-", "*", "/")
 * @param leftConstant - Optional constant value for left operand
 * @param rightConstant - Optional constant value for right operand
 * @param leftConstantInfo - Optional info about the left constant for editing
 * @param rightConstantInfo - Optional info about the right constant for editing
 */
export function createBinOpNode(
    operator: string,
    leftConstant?: string,
    rightConstant?: string,
    leftConstantInfo?: ConstantOperandInfo,
    rightConstantInfo?: ConstantOperandInfo
): Node {
    return {
        id: generateNodeId(),
        position: { x: 0, y: 100 * getNodeIdCounter() },
        data: { operator, leftConstant, rightConstant, leftConstantInfo, rightConstantInfo },
        type: "BinOpNode",
    };
}

/**
 * Configuration for conditional node branch expansion
 */
interface ConditionalExpansionConfig {
    /** Callback to toggle branch expansion */
    onToggleBranchExpand: (branchId: string) => void;
    /** Array of expansion IDs for each branch */
    branchExpansionIds: string[];
    /** Array of expanded branch indices */
    expandedBranchIndices: number[];
}

/**
 * Creates a conditional node for IF or IFS functions
 * @param funName - The function name ('IF' or 'IFS')
 * @param argFormulas - Array of formula strings for each argument
 * @param funFormula - The complete function formula string
 * @param expansionConfig - Configuration for branch expansion
 * @param sheet - The sheet name where this conditional resides
 * @param constantArgs - Optional map of argument index to constant info for editable constants
 */
export function createConditionalNode(
    funName: 'IF' | 'IFS',
    argFormulas: string[],
    funFormula: string,
    expansionConfig: ConditionalExpansionConfig,
    sheet: string,
    constantArgs?: Record<number, ConditionalConstantArgInfo>
): Node {
    return {
        id: generateNodeId(),
        position: { x: 0, y: 100 * getNodeIdCounter() },
        data: {
            funName,
            argFormulas,
            funFormula,
            onToggleBranchExpand: expansionConfig.onToggleBranchExpand,
            branchExpansionIds: expansionConfig.branchExpansionIds,
            expandedBranchIndices: expansionConfig.expandedBranchIndices,
            sheet,
            constantArgs,
        },
        type: "ConditionalNode",
    };
}
