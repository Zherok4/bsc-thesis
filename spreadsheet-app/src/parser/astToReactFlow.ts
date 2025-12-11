import type { Edge, Node } from "@xyflow/react";
import { nodeToString, type CollapsedNode } from "./collapseAST";
import type { ASTNode, BinaryOpNode, CellRangeNode, CellReferenceNode, FormulaNode, FunctionCallNode, NumberLiteralNode, PercentNode, StringLiteralNode, UnaryOpNode } from "./visitor";

export interface Graph {
    nodes: Node[];
    edges: Edge[]
}

// Context for expansion state passed through the visitor
export interface ExpansionContext {
    expandedNodeIds: Set<string>;
    onToggleExpand: (nodeId: string) => void;
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

function createResultNode(formula: string): Node {
    return {
        id: `${generateNodeId()}`,
        position: {x: 0, y: 100*nodeIdCounter},
        data: {formula},
        type: "ResultNode",
    } as Node
}

function createExpandableExpressionNode(
    formula: string,
    isExpanded: boolean,
    onToggleExpand: (nodeId: string) => void,
    isConnectedToFunctionArg: boolean = false
): Node {
    const nodeId = generateNodeId();
    return {
        id: nodeId,
        position: {x: 0, y: 100*nodeIdCounter},
        data: {
            formula,
            isExpanded,
            onToggleExpand,
            nodeId,
            isConnectedToFunctionArg,
        },
        type: "ExpandableExpressionNode",
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
            const funFormula: string = nodeToString(functionNode);
            const argFormulas: string[] = functionNode.arguments.map(arg => nodeToString(arg));
            const createdNode: Node = createFunctionNode(functionNode.name, argFormulas, funFormula);
            const createdEdge: Edge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            functionNode.arguments.forEach((arg) => {
                visitAstNode(arg, nodes, edges, createdNode.id);
            });
            break;
        }
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
            const createdNode: Node = createRangeNode(
                rangeNode.start.reference,
                rangeNode.end.reference,
                rangeNode.sheet
            );
            const createdEdge: Edge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            // Range node is a leaf - don't visit start/end as separate nodes
            break;
        }
        case "NumberLiteral":{
            const numNode: NumberLiteralNode = node as NumberLiteralNode;
            const createdNode: Node = createNumNode(numNode.value);
            const createdEdge: Edge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            break;
        }
        case "StringLiteral": {
            const strNode: StringLiteralNode = node as StringLiteralNode;
            const createdNode: Node = createStringNode(strNode.value);
            const createdEdge: Edge = createDefaultEdge(createdNode.id, parentID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            break;
        }
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
            const createdNode: Node = createResultNode(collapsedNode.label);
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

// New visitor that supports expansion context
export function visitCollapsedNodeWithExpansion(
    collapsedNode: CollapsedNode,
    nodes: Node[],
    edges: Edge[],
    parentID: string,
    context: ExpansionContext,
    handleID?: string,
    collapsedNodeId?: string,
) {
    // Generate a stable ID for this collapsed node to track expansion state
    const nodeCollapsedId = collapsedNodeId ?? `collapsed-${nodes.length}`;

    switch(collapsedNode.original.type) {
        case("Formula"): {
            const createdNode: Node = createResultNode(collapsedNode.label);
            nodes.push(createdNode);
            collapsedNode.children.forEach((child, idx) => {
                visitCollapsedNodeWithExpansion(
                    child, nodes, edges, createdNode.id, context, undefined, `${nodeCollapsedId}-${idx}`
                );
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
            const argFormulas: string[] = collapsedNode.children.map(child => child.label);
            const createdNode: Node = createFunctionNode(funNode.name, argFormulas, funFormula);
            const createdEdge: Edge = createDefaultEdge(createdNode.id, parentID, handleID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            collapsedNode.children.forEach((child, idx) => {
                visitCollapsedNodeWithExpansion(
                    child, nodes, edges, createdNode.id, context, `arghandle-${idx}`, `${nodeCollapsedId}-arg${idx}`
                );
            });
            break;
        }

        // Handle BinaryOp, UnaryOp, Percent - these can be expandable
        case("BinaryOp"):
        case("UnaryOp"):
        case("Percent"): {
            const isExpanded = context.expandedNodeIds.has(nodeCollapsedId);
            const isConnectedToFunctionArg = handleID?.startsWith('arghandle-') ?? false;

            if (collapsedNode.hasHiddenDetails && !isExpanded) {
                // Create expandable node (collapsed state)
                const createdNode: Node = createExpandableExpressionNode(
                    collapsedNode.label,
                    false,
                    context.onToggleExpand,
                    isConnectedToFunctionArg
                );
                // Override the nodeId in data to use our stable collapsed ID
                createdNode.data.nodeId = nodeCollapsedId;

                const createdEdge: Edge = createDefaultEdge(createdNode.id, parentID, handleID);
                nodes.push(createdNode);
                edges.push(createdEdge);

                // Still show important children (references, functions, ranges)
                collapsedNode.children.forEach((child, idx) => {
                    visitCollapsedNodeWithExpansion(
                        child, nodes, edges, createdNode.id, context, undefined, `${nodeCollapsedId}-${idx}`
                    );
                });
            } else if (collapsedNode.hasHiddenDetails && isExpanded) {
                // Create expandable node (expanded state) - show full AST
                const createdNode: Node = createExpandableExpressionNode(
                    collapsedNode.label,
                    true,
                    context.onToggleExpand,
                    isConnectedToFunctionArg
                );
                createdNode.data.nodeId = nodeCollapsedId;

                const createdEdge: Edge = createDefaultEdge(createdNode.id, parentID, handleID);
                nodes.push(createdNode);
                edges.push(createdEdge);

                // When expanded, show the collapsed children (which properly summarize arithmetic)
                collapsedNode.children.forEach((child, idx) => {
                    visitCollapsedNodeWithExpansion(
                        child, nodes, edges, createdNode.id, context, undefined, `${nodeCollapsedId}-expanded-${idx}`
                    );
                });
            } else {
                // No hidden details, just show as default node
                const createdNode: Node = createDefaultNode(collapsedNode.label);
                const createdEdge: Edge = createDefaultEdge(createdNode.id, parentID, handleID);
                nodes.push(createdNode);
                edges.push(createdEdge);
                collapsedNode.children.forEach((child, idx) => {
                    visitCollapsedNodeWithExpansion(
                        child, nodes, edges, createdNode.id, context, undefined, `${nodeCollapsedId}-${idx}`
                    );
                });
            }
            break;
        }

        default: {
            const createdNode: Node = createDefaultNode(collapsedNode.label);
            const createdEdge: Edge = createDefaultEdge(createdNode.id, parentID, handleID);
            nodes.push(createdNode);
            edges.push(createdEdge);
            collapsedNode.children.forEach((child, idx) => {
                visitCollapsedNodeWithExpansion(
                    child, nodes, edges, createdNode.id, context, undefined, `${nodeCollapsedId}-${idx}`
                );
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

// New function that builds graph with expansion support
export function toGraphWithExpansion(
    collapsedNode: CollapsedNode,
    context: ExpansionContext
): Graph {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    visitCollapsedNodeWithExpansion(collapsedNode, nodes, edges, "-1", context, undefined, "root");
    return {
        nodes,
        edges,
    };
} 

