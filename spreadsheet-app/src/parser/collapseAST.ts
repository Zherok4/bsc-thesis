import { collapsedNodeFactory } from "./collapsedNodeFactory";
import type { ASTNode, BinaryOpNode, CellRangeNode, CellReferenceNode, ColumnRangeNode, FormulaNode, FunctionCallNode, NumberLiteralNode, PercentNode, RowRangeNode, StringLiteralNode, UnaryOpNode } from "./visitor";

export interface CollapsedNode {
    type: "CollapsedNode";
    label: string;
    nodeType: "function" | "expression" | "literal" | "reference";
    children: CollapsedNode[];
    original: ASTNode;
    // For expandable nodes: stores the full subtree that was collapsed
    hasHiddenDetails: boolean;
}

export function nodeToString(node: ASTNode): string {
    switch(node.type) {
        case "Formula":{
            const formulaNode = node as FormulaNode;
            return `${nodeToString(formulaNode.expression)}`;
        }
        case "BinaryOp": {
            const binaryNode = node as BinaryOpNode;
            return `${nodeToString(binaryNode.left)} ${binaryNode.operator} ${nodeToString(binaryNode.right)}`;
            
        }
        case "UnaryOp":{
            const unaryNode = node as UnaryOpNode;
            return `${unaryNode.operator}${nodeToString(unaryNode.operand)}`;
        }
        case "Percent":{
            const percentNode = node as PercentNode;
            return `${nodeToString(percentNode.operand)}%`;
        }
        case "FunctionCall":{
            const functionNode = node as FunctionCallNode;
            return `${functionNode.name}(${functionNode.arguments.map(nodeToString).join()})`;
        }
        case "CellReference":{
            const refNode = node as CellReferenceNode;
            const prefix = refNode.sheet? `${refNode.sheet}!` : "";
            return `${prefix}${refNode.reference}`;
        }
        case "CellRange":{
            const rangeNode = node as CellRangeNode;
            const prefix = rangeNode.sheet? `${rangeNode.sheet}!` : "";
            return `${prefix}${nodeToString(rangeNode.start)}:${nodeToString(rangeNode.end)}`;
        }
        case "ColumnRange":{
            const colRangeNode = node as ColumnRangeNode;
            const prefix = colRangeNode.sheet ? `${colRangeNode.sheet}!` : "";
            return `${prefix}${colRangeNode.startColumn}:${colRangeNode.endColumn}`;
        }
        case "RowRange":{
            const rowRangeNode = node as RowRangeNode;
            const prefix = rowRangeNode.sheet ? `${rowRangeNode.sheet}!` : "";
            return `${prefix}${rowRangeNode.startRow}:${rowRangeNode.endRow}`;
        }
        case "NumberLiteral":{
            const numNode = node as NumberLiteralNode;
            return `${numNode.value}`;
        }
        case "StringLiteral":{
            const stringNode = node as StringLiteralNode;
            return `"${stringNode.value}"`;
        }
        default: {
            return "undefined";
        }
    }
}

// Recursively extract all important nodes (functions, references, ranges) from a subtree
function extractImportantNodes(node: ASTNode): ASTNode[] {
    switch(node.type) {
        case "Formula": {
            const formulaNode = node as FormulaNode;
            return extractImportantNodes(formulaNode.expression);
        }
        case "BinaryOp": {
            const binaryNode = node as BinaryOpNode;
            return [
                ...extractImportantNodes(binaryNode.left),
                ...extractImportantNodes(binaryNode.right)
            ];
        }
        case "UnaryOp": {
            const unaryNode = node as UnaryOpNode;
            return extractImportantNodes(unaryNode.operand);
        }
        case "Percent": {
            const percentNode = node as PercentNode;
            return extractImportantNodes(percentNode.operand);
        }
        case "FunctionCall":
        case "CellReference":
        case "CellRange":
        case "ColumnRange":
        case "RowRange":
            // Important node found - return it
            return [node];
        case "NumberLiteral":
        case "StringLiteral":
        case "BooleanLiteral":
            // Literals are not important, return empty
            return [];
        default:
            return [];
    }
}

export function collapseNode(node: ASTNode): CollapsedNode {
    switch(node.type) {
        case "Formula": {
            const formulaNode: FormulaNode = node as FormulaNode;
            return collapsedNodeFactory(formulaNode, "expression", [collapseNode(formulaNode.expression)]);
        }
        case "BinaryOp": {
            const binaryNode: BinaryOpNode = node as BinaryOpNode;
            // Extract all important nodes from this subtree
            const importantNodes = extractImportantNodes(binaryNode);
            // Collapse each important node (which handles their own children)
            const children: CollapsedNode[] = importantNodes.map(collapseNode);
            // This expression has hidden arithmetic details
            return collapsedNodeFactory(binaryNode, "expression", children, true);
        }
        case "UnaryOp": {
            const unaryNode: UnaryOpNode = node as UnaryOpNode;
            const importantNodes = extractImportantNodes(unaryNode);
            const children: CollapsedNode[] = importantNodes.map(collapseNode);
            return collapsedNodeFactory(unaryNode, "expression", children, true);
        }
        case "Percent": {
            const percentNode: PercentNode = node as PercentNode;
            const importantNodes = extractImportantNodes(percentNode);
            const children: CollapsedNode[] = importantNodes.map(collapseNode);
            return collapsedNodeFactory(percentNode, "expression", children, true);
        }
        case "FunctionCall": {
            const functionNode: FunctionCallNode = node as FunctionCallNode;
            return collapsedNodeFactory(functionNode, "function", functionNode.arguments.map(collapseNode));
        }
        case "CellReference": {
            const refNode: CellReferenceNode = node as CellReferenceNode;
            return collapsedNodeFactory(refNode, "reference", []);
        }
        case "CellRange": {
            const rangeNode: CellRangeNode = node as CellRangeNode;
            return collapsedNodeFactory(rangeNode, "reference", []);
        }
        case "ColumnRange": {
            const colRangeNode: ColumnRangeNode = node as ColumnRangeNode;
            return collapsedNodeFactory(colRangeNode, "reference", []);
        }
        case "RowRange": {
            const rowRangeNode: RowRangeNode = node as RowRangeNode;
            return collapsedNodeFactory(rowRangeNode, "reference", []);
        }
        case "NumberLiteral": {
            const numNode: NumberLiteralNode = node as NumberLiteralNode;
            return collapsedNodeFactory(numNode, "literal", []);
        }
        case "StringLiteral": {
            const stringNode: StringLiteralNode = node as StringLiteralNode;
            return collapsedNodeFactory(stringNode, "literal", []);
        }
        default:
            return {
                type: "CollapsedNode",
                label: "undefined",
                nodeType: "expression",
                children: [],
                original: node,
                hasHiddenDetails: false,
            }
    }
}