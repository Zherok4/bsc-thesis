import { collapsedNodeFactory } from "./collapsedNodeFactory";
import type { ASTNode, BinaryOpNode, CellRangeNode, CellReferenceNode, FormulaNode, FunctionCallNode, NumberLiteralNode, PercentNode, StringLiteralNode, UnaryOpNode } from "./visitor";

export interface CollapsedNode {
    type: "CollapsedNode";
    label: string;
    nodeType: "function" | "expression" | "literal" | "reference";
    children: CollapsedNode[];
    original: ASTNode;
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
        case "NumberLiteral":{
            const numNode = node as NumberLiteralNode;
            return `${numNode.value}`;
        }
        case "StringLiteral":{
            const stringNode = node as StringLiteralNode;
            return stringNode.value
        }
        default: {
            return "undefined";
        }
    }
}

function containsFunctionNode(node: ASTNode): boolean {
    switch(node.type) {
        case "Formula":
            const formulaNode = node as FormulaNode;
            return containsFunctionNode(formulaNode.expression);
        case "BinaryOp":
            const binaryNode = node as BinaryOpNode;
            return containsFunctionNode(binaryNode.left) || containsFunctionNode(binaryNode.right);
        case "UnaryOp":
            const unaryNode = node as UnaryOpNode;
            return containsFunctionNode(unaryNode.operand);
        case "Percent":
            const percentNode = node as PercentNode;
            return containsFunctionNode(percentNode.operand);
        case "FunctionCall":
            return true;
        case "CellReference":
            return false;
        case "CellRange":
            return false;
        case "NumberLiteral":
            return false;
        case "StringLiteral":
            return false;
        case "BooleanLiteral":
            return false;
    }
}

export function collapseNode(node: ASTNode): CollapsedNode {
    switch(node.type) {
        case "Formula": { 
            const formulaNode: FormulaNode = node as FormulaNode;
            return collapsedNodeFactory(formulaNode, "expression", [collapseNode(formulaNode.expression)]);
        }
        case "BinaryOp":
            const binaryNode: BinaryOpNode = node as BinaryOpNode;
            if (!containsFunctionNode(binaryNode)) {
                return collapsedNodeFactory(binaryNode, "expression", []);
            } else {
                const children: CollapsedNode[] = [collapseNode(binaryNode.left), collapseNode(binaryNode.right)]
                return collapsedNodeFactory(binaryNode, "expression", children)
            }
        case "UnaryOp":
            const unaryNode: UnaryOpNode = node as UnaryOpNode;
            if (!containsFunctionNode(unaryNode)) {
                return collapsedNodeFactory(unaryNode, "expression", []);
            } else {
                const children: CollapsedNode[] = [collapseNode(unaryNode.operand)];
                return collapsedNodeFactory(unaryNode, "expression", children);
            }
        case "Percent":
            const percentNode: PercentNode = node as PercentNode;
            if (!containsFunctionNode(percentNode)) {
                return collapsedNodeFactory(percentNode, "expression", []);
            } else {
                const children: CollapsedNode[] = [collapseNode(percentNode.operand)];
                return collapsedNodeFactory(percentNode, "expression", children);
            }
        case "FunctionCall":
            const functionNode: FunctionCallNode = node as FunctionCallNode;
            return collapsedNodeFactory(functionNode, "function", functionNode.arguments.map(collapseNode));
        case "CellReference":
            const refNode: CellReferenceNode = node as CellReferenceNode;
            return collapsedNodeFactory(refNode, "reference", []);
        case "CellRange":
            const rangeNode: CellRangeNode = node as CellRangeNode;
            return collapsedNodeFactory(rangeNode, "expression", []);
        case "NumberLiteral":
            const numNode: NumberLiteralNode = node as NumberLiteralNode;
            return collapsedNodeFactory(numNode, "literal", []);
        case "StringLiteral":
            const stringNode: StringLiteralNode = node as StringLiteralNode;
            return collapsedNodeFactory(stringNode, "literal", []);
        default:
            return {
                type: "CollapsedNode",
                label: "undefined",
                nodeType: "expression",
                children: [],
                original: node,
            }
    }
}