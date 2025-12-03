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
            const formulaNode = node as FormulaNode;
            return {
                type: "CollapsedNode",
                label: nodeToString(formulaNode),
                nodeType: "expression",
                children: [collapseNode(formulaNode.expression)],
                original: formulaNode,
            };
        }
        case "BinaryOp":
            const binaryNode = node as BinaryOpNode;
            if (!containsFunctionNode(binaryNode)) {
                return {
                    type: "CollapsedNode",
                    label: nodeToString(binaryNode),
                    nodeType: "expression",
                    children: [],
                    original: binaryNode,
                };
            } else {
                return {
                    type: "CollapsedNode",
                    label: nodeToString(binaryNode),
                    nodeType: "expression",
                    children: [collapseNode(binaryNode.left), collapseNode(binaryNode.right)],
                    original: binaryNode,
                };
            }
        case "UnaryOp":
            const unaryNode = node as UnaryOpNode;
            if (!containsFunctionNode(unaryNode)) {
                return {
                    type: "CollapsedNode",
                    label: nodeToString(unaryNode),
                    nodeType: "expression",
                    children: [],
                    original: unaryNode,
                };
            } else {
                return {
                    type: "CollapsedNode",
                    label: nodeToString(unaryNode),
                    nodeType: "expression",
                    children: [collapseNode(unaryNode.operand)],
                    original: unaryNode,
                };
            }
        case "Percent":
            const percentNode = node as PercentNode;
            if (!containsFunctionNode(percentNode)) {
                return {
                    type: "CollapsedNode",
                    label: nodeToString(percentNode),
                    nodeType: "expression",
                    children: [],
                    original: percentNode,
                };
            } else {
                return {
                    type: "CollapsedNode",
                    label: nodeToString(percentNode),
                    nodeType: "expression",
                    children: [collapseNode(percentNode)],
                    original: percentNode,
                };
            }
        case "FunctionCall":
            const functionNode = node as FunctionCallNode;
            return {
                type: "CollapsedNode",
                label: nodeToString(functionNode),
                nodeType: "function",
                children: functionNode.arguments.map(collapseNode),
                original: functionNode,
            };
        case "CellReference":
            const refNode = node as CellReferenceNode;
            return {
                type: "CollapsedNode",
                label: nodeToString(refNode),
                nodeType: "reference",
                children: [],
                original: refNode,
            };

        case "CellRange":
            const rangeNode = node as CellRangeNode;
            return {
                type: "CollapsedNode",
                label: nodeToString(rangeNode),
                nodeType: "expression",
                children: [],
                original: rangeNode,
            }
        case "NumberLiteral":
            const numNode = node as NumberLiteralNode;
            return {
                type: "CollapsedNode",
                label: nodeToString(numNode),
                nodeType: "literal",
                children: [],
                original: numNode,
            }
        case "StringLiteral":
            const stringNode = node as StringLiteralNode;
            return {
                type: "CollapsedNode",
                label: nodeToString(stringNode),
                nodeType: "literal",
                children: [],
                original: stringNode,
            }
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