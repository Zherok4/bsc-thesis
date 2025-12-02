import type { ASTNode, BinaryOpNode, CellRangeNode, CellReferenceNode, FormulaNode, FunctionCallNode, NumberLiteralNode, PercentNode, StringLiteralNode, UnaryOpNode } from "./visitor";


export interface defaultNode {
    id: string;
    position: { x: number, y: number };
    data: { label: string };
}

export interface defaultEdge {
    id: string;
    source: string;
    target: string;
    type: string;
    label: string;
}

export interface Graph {
    nodes: any[];
    edges: any[]
}

let nodeIdCounter = 0;

function generateNodeId(): string {
    return `node_${nodeIdCounter++}`
}

export function resetNodeIdCounter(): void {
    nodeIdCounter = 0;
}

function createDefaultNode(label: string): defaultNode {
    return {
        id: `${generateNodeId()}`,
        position: {x: 0, y: 100*nodeIdCounter},
        data: {label},
    };
}

function createDefaultEdge(source: string, target: string) : defaultEdge {
    return {
        id: `${source}-${target}`,
        source,
        target,
        type: "step",
        label: ""
    }
}

function visitNode(node: ASTNode, nodes: any[], edges: any[], parentID: string) {
    switch(node.type) {
        case "Formula":{
            const formulaNode = node as FormulaNode;
            const createdNode = createDefaultNode(formulaNode.type);
            nodes.push(createdNode);
            visitNode(node.expression, nodes, edges, createdNode.id);
            break;
        }
        case "BinaryOp":{
            const binaryNode = node as BinaryOpNode;
            const createdNode = createDefaultNode(binaryNode.operator)
            const createdEdge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            visitNode(binaryNode.left, nodes, edges, createdNode.id);
            visitNode(binaryNode.right, nodes, edges, createdNode.id);
            break;
        }
        case "UnaryOp":{
            const unaryNode = node as UnaryOpNode;
            const createdNode = createDefaultNode(unaryNode.type)
            const createdEdge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            visitNode(unaryNode.operand, nodes, edges, createdNode.id);
            break;
        }
        case "Percent":{
            const percentNode = node as PercentNode;
            const createdNode = createDefaultNode(percentNode.type);
            const createdEdge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            visitNode(percentNode.operand, nodes, edges, createdNode.id);
            break;
        }
        case "FunctionCall":{
            const functionNode = node as FunctionCallNode;
            const createdNode = createDefaultNode(functionNode.name);
            const createdEdge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            const argumentNodes = functionNode.arguments;
            argumentNodes.forEach((node) => visitNode(node, nodes, edges, createdNode.id));
            break;}
        case "CellReference":{
            const referenceNode = node as CellReferenceNode;
            const createdNode = createDefaultNode(referenceNode.type);
            const createdEdge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            break;
        }
        case "CellRange":{
            const rangeNode = node as CellRangeNode;
            const createdNode = createDefaultNode(rangeNode.type);
            const createdEdge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            visitNode(rangeNode.start, nodes, edges, createdNode.id);
            visitNode(rangeNode.end, nodes, edges, createdNode.id);
            break;
        }
        case "NumberLiteral":{
            const numberNode = node as NumberLiteralNode;
            const createdNode = createDefaultNode(`${numberNode.value}`);
            const createdEdge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            break;
        }
        case "StringLiteral":
            const stringNode = node as StringLiteralNode;
            const createdNode = createDefaultNode(stringNode.value);
            const createdEdge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            break;
    }
}

export function astToGraph(ast: ASTNode): Graph {
    const nodes: any[] = [];
    const edges: any[] = [];
    visitNode(ast, nodes, edges, "-1");
    return {
        nodes,
        edges,
    };
} 

