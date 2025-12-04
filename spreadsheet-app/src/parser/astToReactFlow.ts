import type { Edge, Node } from "@xyflow/react";
import { nodeToString, type CollapsedNode } from "./collapseAST";
import type { ASTNode, BinaryOpNode, CellRangeNode, CellReferenceNode, FormulaNode, FunctionCallNode, NumberLiteralNode, PercentNode, StringLiteralNode, UnaryOpNode } from "./visitor";

export interface Graph {
    nodes: Node[];
    edges: Edge[]
}

let nodeIdCounter = 0;

function generateNodeId(): string {
    return `node_${nodeIdCounter++}`
}

export function resetNodeIdCounter(): void {
    nodeIdCounter = 0;
}

function createDefaultNode(label: string): Node {
    return {
        id: `${generateNodeId()}`,
        position: {x: 0, y: 100*nodeIdCounter},
        data: {formula: label, output: "2"},
        type: "twoTextNode"
    } as Node;
}

function createDefaultEdge(source: string, target: string) : Edge {
    return {
        id: `${source}-${target}`,
        source,
        target,
        type: "straight",
        label: ""
    } as Edge;
}

export function visitAstNode(node: ASTNode, nodes: any[], edges: any[], parentID: string) {
    switch(node.type) {
        case "Formula":{
            const formulaNode = node as FormulaNode;
            const createdNode = createDefaultNode(nodeToString(node));
            nodes.push(createdNode);
            visitAstNode(node.expression, nodes, edges, createdNode.id);
            break;
        }
        case "BinaryOp":{
            const binaryNode = node as BinaryOpNode;
            const createdNode = createDefaultNode(nodeToString(node));
            const createdEdge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            visitAstNode(binaryNode.left, nodes, edges, createdNode.id);
            visitAstNode(binaryNode.right, nodes, edges, createdNode.id);
            break;
        }
        case "UnaryOp":{
            const unaryNode = node as UnaryOpNode;
            const createdNode = createDefaultNode(nodeToString(node));
            const createdEdge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            visitAstNode(unaryNode.operand, nodes, edges, createdNode.id);
            break;
        }
        case "Percent":{
            const percentNode = node as PercentNode;
            const createdNode = createDefaultNode(nodeToString(node));
            const createdEdge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            visitAstNode(percentNode.operand, nodes, edges, createdNode.id);
            break;
        }
        case "FunctionCall":{
            const functionNode = node as FunctionCallNode;
            const createdNode = createDefaultNode(nodeToString(node));
            const createdEdge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            const argumentNodes = functionNode.arguments;
            argumentNodes.forEach((node) => visitAstNode(node, nodes, edges, createdNode.id));
            break;}
        case "CellReference":{
            const createdNode = createDefaultNode(nodeToString(node));
            const createdEdge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            break;
        }
        case "CellRange":{
            const rangeNode = node as CellRangeNode;
            const createdNode = createDefaultNode(nodeToString(node));
            const createdEdge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            visitAstNode(rangeNode.start, nodes, edges, createdNode.id);
            visitAstNode(rangeNode.end, nodes, edges, createdNode.id);
            break;
        }
        case "NumberLiteral":{
            const createdNode = createDefaultNode(nodeToString(node));
            const createdEdge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            break;
        }
        case "StringLiteral":
            const createdNode = createDefaultNode(nodeToString(node));
            const createdEdge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            break;
    }
}

export function visitCollapsedNode(collapsedNode: CollapsedNode, nodes: any[], edges: any[], parentID: string) {
    const createdNode = createDefaultNode(collapsedNode.label);
    nodes.push(createdNode);
    if (collapsedNode.original.type !== "Formula") {
        const createdEdge = createDefaultEdge(createdNode.id, parentID);
        edges.push(createdEdge);
    }
    collapsedNode.children.forEach(child => {
        visitCollapsedNode(child, nodes, edges, createdNode.id);
    });
}

export function toGraph<T extends ASTNode | CollapsedNode>(nodeToVisit: T, visitMethod: (visitedObject: T, nodes: any[], edges: any[], parentID: string) => void): Graph {
    const nodes: any[] = [];
    const edges: any[] = [];
    visitMethod(nodeToVisit, nodes, edges, "-1");
    return {
        nodes,
        edges,
    };
} 

