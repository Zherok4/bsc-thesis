import type { ASTNode, BinaryOpNode, CellRangeNode, CellReferenceNode, FunctionCallNode, NumberLiteralNode, PercentNode, StringLiteralNode, UnaryOpNode } from "./visitor";


export interface defaultNode {
    id: string;
    position: { x: number, y: number };
    data: { label: string };
}

export interface astGraph {
    nodes: any[];
    edges: any[]
}

let nodeIdCounter = 0;

function generateNodeId(): string {
    return `node_${nodeIdCounter++}`
}

function createDefaultNode(label: string): defaultNode {
    return {
        id: `${generateNodeId()}`,
        position: {x: 0, y: 100*nodeIdCounter},
        data: {label},
    };
}

function visitNode(node: ASTNode, nodes: any[], edges: any[]) {
    switch(node.type) {
        case "Formula":
            visitNode(node.expression, nodes, edges);
            break;
        case "BinaryOp":
            const binaryNode = node as BinaryOpNode;
            nodes.push(createDefaultNode(node.type));
            visitNode(binaryNode.left, nodes, edges);
            visitNode(binaryNode.right, nodes, edges);
            break;
        case "UnaryOp":
            const unaryNode = node as UnaryOpNode;
            nodes.push(createDefaultNode(unaryNode.type));
            visitNode(unaryNode.operand, nodes, edges);
            break;
        case "Percent":
            const percentNode = node as PercentNode;
            nodes.push(createDefaultNode(percentNode.type));
            visitNode(percentNode.operand, nodes, edges);
            break;
        case "FunctionCall":
            const functionNode = node as FunctionCallNode;
            nodes.push(createDefaultNode(functionNode.type));
            const argumentNodes = functionNode.arguments;
            argumentNodes.forEach((node) => visitNode(node, nodes, edges));
            break;
        case "CellReference":
            const referenceNode = node as CellReferenceNode;
            nodes.push(createDefaultNode(referenceNode.type));
            break;
        case "CellRange":
            const rangeNode = node as CellRangeNode;
            nodes.push(createDefaultNode(rangeNode.type));
            visitNode(rangeNode.start, nodes, edges);
            visitNode(rangeNode.end, nodes, edges);
            break;
        case "NumberLiteral":
            const numberNode = node as NumberLiteralNode;
            nodes.push(createDefaultNode(`${numberNode.value}`));
            break;
        case "StringLiteral":
            const stringNode = node as StringLiteralNode;
            nodes.push(createDefaultNode(stringNode.value));
            break;
    }
}

export function astToGraph(ast: ASTNode): astGraph {
    const nodes: any[] = [];
    const edges: any[] = [];
    visitNode(ast, nodes, edges);
    return {
        nodes,
        edges,
    };
} 

