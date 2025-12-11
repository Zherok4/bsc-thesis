import type { Edge, Node } from "@xyflow/react";
import { nodeToString, type CollapsedNode } from "./collapseAST";
import type { ASTNode, BinaryOpNode, CellRangeNode, CellReferenceNode, FormulaNode, FunctionCallNode, NumberLiteralNode, PercentNode, StringLiteralNode, UnaryOpNode } from "./visitor";

export interface Graph {
    nodes: Node[];
    edges: Edge[]
}

let nodeIdCounter: number = 0;

function generateNodeId(): string {
    return `node_${nodeIdCounter++}`
};

export function resetNodeIdCounter(): void {
    nodeIdCounter = 0;
};

function createDefaultNode(label: string): Node {
    return {
        id: `${generateNodeId()}`,
        position: {x: 0, y: 100*nodeIdCounter},
        data: {formula: label},
        type: "twoTextNode",
    } as Node;
};

function createReferenceNode(reference: string, sheet?: string): Node {
    return {
        id: `${generateNodeId()}`,
        position: {x: 0, y: 100*nodeIdCounter},
        data: {reference, sheet},
        type: "ReferenceNode",
    } as Node;
};

function createRangeNode(startReference: string, endReference: string, sheet?: string): Node {
    return {
        id: `${generateNodeId()}`,
        position: {x: 0, y: 100*nodeIdCounter},
        data: {startReference, endReference, sheet},
        type: "RangeNode",
    } as Node
};

function createNumNode(value: number): Node {
    return {
        id: `${generateNodeId()}`,
        position: {x: 0, y: 100*nodeIdCounter},
        data: {value},
        type: "NumberNode" ,
    } as Node
}

function createStringNode(value: string): Node {
    return {
        id: `${generateNodeId()}`,
        position: {x: 0, y: 100*nodeIdCounter},
        data: {value},
        type: "StringNode" ,
    } as Node
}

function createFunctionNode(funName: string, argFormulas: string[], funFormula: string): Node {
    return {
        id: `${generateNodeId()}`,
        position: {x: 0, y: 100*nodeIdCounter},
        data: {funName, argFormulas, funFormula},
        type: "FunctionNode",
    } as Node
}

function createDefaultEdge(source: string, target: string, handleID?: string) : Edge {
    return {
        id: `${source}-${target}`,
        source,
        target,
        type: "straight",
        label: "",
        targetHandle: handleID,
    } as Edge;
};

export function visitAstNode(node: ASTNode, nodes: any[], edges: any[], parentID: string) {
    switch(node.type) {
        case "Formula":{
            const formulaNode: FormulaNode = node as FormulaNode;
            const createdNode: Node = createDefaultNode(nodeToString(formulaNode));
            nodes.push(createdNode);
            visitAstNode(formulaNode.expression, nodes, edges, createdNode.id);
            break;
        }
        case "BinaryOp":{
            const binaryNode: BinaryOpNode = node as BinaryOpNode;
            const createdNode: Node = createDefaultNode(nodeToString(node));
            const createdEdge: Edge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            visitAstNode(binaryNode.left, nodes, edges, createdNode.id);
            visitAstNode(binaryNode.right, nodes, edges, createdNode.id);
            break;
        }
        case "UnaryOp":{
            const unaryNode: UnaryOpNode = node as UnaryOpNode;
            const createdNode: Node = createDefaultNode(nodeToString(node));
            const createdEdge: Edge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            visitAstNode(unaryNode.operand, nodes, edges, createdNode.id);
            break;
        }
        case "Percent":{
            const percentNode: PercentNode = node as PercentNode;
            const createdNode: Node = createDefaultNode(nodeToString(node));
            const createdEdge: Edge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            visitAstNode(percentNode.operand, nodes, edges, createdNode.id);
            break;
        }
        case "FunctionCall":{
            const functionNode: FunctionCallNode = node as FunctionCallNode;
            const createdNode: Node = createDefaultNode(nodeToString(node));
            const createdEdge: Edge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            const argumentNodes = functionNode.arguments;
            argumentNodes.forEach((node) => visitAstNode(node, nodes, edges, createdNode.id));
            break;}
        case "CellReference":{
            const refNode: CellReferenceNode = node as CellReferenceNode;
            const createdNode: Node = createReferenceNode(refNode.reference, refNode.sheet);
            const createdEdge: Edge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            break;
        }
        case "CellRange":{
            const rangeNode: CellRangeNode = node as CellRangeNode;
            const createdNode: Node = createDefaultNode(nodeToString(node));
            const createdEdge: Edge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            visitAstNode(rangeNode.start, nodes, edges, createdNode.id);
            visitAstNode(rangeNode.end, nodes, edges, createdNode.id);
            break;
        }
        case "NumberLiteral":{
            const createdNode: Node = createDefaultNode(nodeToString(node));
            const createdEdge: Edge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            break;
        }
        case "StringLiteral":
            const createdNode: Node = createDefaultNode(nodeToString(node));
            const createdEdge: Edge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            break;
    }
}

export function visitCollapsedNode(
    collapsedNode: CollapsedNode, 
    nodes: Node[], 
    edges: Edge[], 
    parentID: string,
    handleID?: string,
) {
    switch(collapsedNode.original.type) {
        case("Formula"): {
            const createdNode: Node = createDefaultNode(collapsedNode.label);
            nodes.push(createdNode);
            collapsedNode.children.forEach(child => {
                visitCollapsedNode(child, nodes, edges, createdNode.id);
            });
            break;
        }

        case("CellReference"): {
            const refNode: CellReferenceNode = collapsedNode.original as CellReferenceNode;
            const createdNode: Node = createReferenceNode(refNode.reference, refNode.sheet);
            const createdEdge: Edge = createDefaultEdge(createdNode.id, parentID, handleID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            break;
        }

        case("CellRange"): {
            const rangeNode: CellRangeNode = collapsedNode.original as CellRangeNode;
            const startNode: CellReferenceNode = rangeNode.start;
            const endNode: CellReferenceNode = rangeNode.end;
            const createdNode: Node = createRangeNode(startNode.reference, endNode.reference, rangeNode.sheet);
            const createdEdge: Edge = createDefaultEdge(createdNode.id, parentID, handleID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            break;
        }

        case("NumberLiteral"): {
            const numLiteralNode: NumberLiteralNode = collapsedNode.original as NumberLiteralNode;
            const createdNode: Node = createNumNode(numLiteralNode.value);
            const createdEdge: Edge = createDefaultEdge(createdNode.id, parentID, handleID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            break;
        }

        case("StringLiteral"): {
            const strLiteralNode: StringLiteralNode = collapsedNode.original as StringLiteralNode;
            const createdNode: Node = createStringNode(strLiteralNode.value);
            const createdEdge: Edge = createDefaultEdge(createdNode.id, parentID, handleID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            break;
        }

        case("FunctionCall"): {
            const funNode: FunctionCallNode = collapsedNode.original as FunctionCallNode;
            const funFormula: string = nodeToString(funNode);
            const argFormulas: string[] = collapsedNode.children.map(child => {return child.label;});
            const createdNode: Node = createFunctionNode(funNode.name, argFormulas, funFormula);
            const createdEdge: Edge = createDefaultEdge(createdNode.id, parentID, handleID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            collapsedNode.children.forEach((child, idx) => {
                visitCollapsedNode(child, nodes, edges, createdNode.id, `arghandle-${idx}`);
            });
            break;
        }

        default:{
            const createdNode: Node = createDefaultNode(collapsedNode.label);
            const createdEdge: Edge = createDefaultEdge(createdNode.id, parentID, handleID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            collapsedNode.children.forEach(child => {
                visitCollapsedNode(child, nodes, edges, createdNode.id);
            });
        }

    }
}

// TODO: put visitMethods in an wrapper ==> visitMethod can now also have their individual arguments.
export function toGraph<T extends ASTNode | CollapsedNode>(nodeToVisit: T, visitMethod: (visitedObject: T, nodes: Node[], edges: Edge[], parentID: string) => void): Graph {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    visitMethod(nodeToVisit, nodes, edges, "-1");
    return {
        nodes,
        edges,
    };
} 

