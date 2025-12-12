import type { Edge, Node } from "@xyflow/react";
import { collapseNode, nodeToString, type CollapsedNode } from "./collapseAST";
import type { ASTNode, BinaryOpNode, CellRangeNode, CellReferenceNode, FormulaNode, FunctionCallNode, NumberLiteralNode, PercentNode, StringLiteralNode, UnaryOpNode } from "./visitor";
import { parseFormula } from "./visitor";
import type { HyperFormula } from "hyperformula";

export interface Graph {
    nodes: Node[];
    edges: Edge[]
}

// Context for expansion state passed through the visitor
export interface ExpansionContext {
    expandedNodeIds: Set<string>;
    onToggleExpand: (nodeId: string) => void;
    hfInstance: HyperFormula;
    activeSheetName: string;
    visitedCells?: Set<string>;  // For circular reference detection
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

function createReferenceNode(reference: string, sheet?: string, hasFormula: boolean = false): Node {
    return {
        id: `${generateNodeId()}`,
        position: {x: 0, y: 100*nodeIdCounter},
        data: {reference, sheet, hasFormula},
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

// Helper to get a cell's formula as a CollapsedNode for expansion
function getCellFormulaAsCollapsedNode(
    reference: string,
    sheet: string | undefined,
    context: ExpansionContext
): CollapsedNode | null {
    try {
        const sheetName = sheet || context.activeSheetName;
        const sheetId = context.hfInstance.getSheetId(sheetName);
        if (sheetId === undefined) {
            return null;
        }

        const cellAddress = context.hfInstance.simpleCellAddressFromString(reference, sheetId);
        if (!cellAddress) {
            return null;
        }

        const formulaString = context.hfInstance.getCellFormula(cellAddress);
        if (!formulaString) {
            return null;
        }

        // Parse the formula and collapse it
        const ast = parseFormula(formulaString);
        if (!ast) {
            return null;
        }

        return collapseNode(ast);
    } catch (error) {
        console.error(`Failed to parse formula for cell ${reference}:`, error);
        return null;
    }
}

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
            const cellId = `${refNode.sheet || context.activeSheetName}:${refNode.reference}`;

            // Check for circular reference
            const visitedCells = context.visitedCells || new Set<string>();
            if (visitedCells.has(cellId)) {
                // Circular reference detected - create non-expandable node
                const createdNode: Node = createReferenceNode(refNode.reference, refNode.sheet);
                const createdEdge: Edge = createDefaultEdge(createdNode.id, parentID, handleID);
                nodes.push(createdNode);
                edges.push(createdEdge);
                break;
            }

            // Try to get cell's formula for expansion
            const cellFormula = getCellFormulaAsCollapsedNode(refNode.reference, refNode.sheet, context);

            if (cellFormula) {
                // Cell has a formula - create reference node + expandable node
                // Use cellId in the expansion ID to make it unique per cell reference
                const cellExpandId = `${nodeCollapsedId}-${cellId}`;
                const isExpanded = context.expandedNodeIds.has(cellExpandId);

                // Create the cell reference node (with hasFormula=true for left handle)
                const refCreatedNode: Node = createReferenceNode(refNode.reference, refNode.sheet, true);
                const refEdge: Edge = createDefaultEdge(refCreatedNode.id, parentID, handleID);
                nodes.push(refCreatedNode);
                edges.push(refEdge);

                // Create an expandable expression node connected to the reference
                const expandableNode: Node = createExpandableExpressionNode(
                    cellFormula.label,
                    isExpanded,
                    context.onToggleExpand,
                    false
                );
                expandableNode.data.nodeId = cellExpandId;

                const expandableEdge: Edge = createDefaultEdge(expandableNode.id, refCreatedNode.id);
                nodes.push(expandableNode);
                edges.push(expandableEdge);

                if (isExpanded) {
                    // Recursively visit the cell's formula children with circular ref protection
                    const childContext: ExpansionContext = {
                        ...context,
                        visitedCells: new Set([...visitedCells, cellId])
                    };

                    // cellFormula wraps a FormulaNode, which has one child: the expression
                    // We want to visit the expression's children, not the formula's children
                    const expression = cellFormula.children[0];
                    if (expression) {
                        expression.children.forEach((child, idx) => {
                            visitCollapsedNodeWithExpansion(
                                child, nodes, edges, expandableNode.id, childContext, undefined, `${cellExpandId}-${idx}`
                            );
                        });
                    }
                }
            } else {
                // No formula - create regular reference node
                const createdNode: Node = createReferenceNode(refNode.reference, refNode.sheet);
                const createdEdge: Edge = createDefaultEdge(createdNode.id, parentID, handleID);
                nodes.push(createdNode);
                edges.push(createdEdge);
            }
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
            //const numLiteralNode: NumberLiteralNode = collapsedNode.original as NumberLiteralNode;
            //const createdNode: Node = createNumNode(numLiteralNode.value);
            //const createdEdge: Edge = createDefaultEdge(createdNode.id, parentID, handleID);
            //nodes.push(createdNode);
            //edges.push(createdEdge);
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
                        child, nodes, edges, createdNode.id, context, undefined, `${nodeCollapsedId}-${idx}`
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

