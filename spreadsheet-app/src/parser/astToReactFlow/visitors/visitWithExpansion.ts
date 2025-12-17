import type { Edge, Node } from "@xyflow/react";
import { nodeToString, type CollapsedNode } from "../../collapseAST";
import type {
    CellRangeNode,
    CellReferenceNode,
    FunctionCallNode,
    StringLiteralNode,
} from "../../visitor";
import { createDefaultEdge } from "../edgeFactory";
import { getCellFormulaAsCollapsedNode } from "../helpers/cellFormulaHelper";
import {
    createDefaultNode,
    createExpandableExpressionNode,
    createFunctionNode,
    createRangeNode,
    createReferenceNode,
    createResultNode,
    createStringNode,
} from "../nodeFactories";
import type { ExpansionContext } from "../types";

/**
 * Parameters passed to individual node type handlers
 */
interface HandlerParams {
    collapsedNode: CollapsedNode;
    nodes: Node[];
    edges: Edge[];
    parentID: string;
    context: ExpansionContext;
    handleID?: string;
    collapsedNodeId: string;
}

/**
 * Handles Formula nodes (top-level result wrapper)
 */
function handleFormulaNode(params: HandlerParams): void {
    const { collapsedNode, nodes, edges, context, collapsedNodeId } = params;

    const createdNode = createResultNode(collapsedNode.label);
    nodes.push(createdNode);

    collapsedNode.children.forEach((child, idx) => {
        visitCollapsedNodeWithExpansion(
            child,
            nodes,
            edges,
            createdNode.id,
            context,
            undefined,
            `${collapsedNodeId}-${idx}`
        );
    });
}

/**
 * Handles CellReference nodes with expansion support.
 * If the referenced cell has a formula, creates an expandable node.
 */
function handleCellReference(params: HandlerParams): void {
    const { collapsedNode, nodes, edges, parentID, context, handleID } = params;

    const refNode = collapsedNode.original as CellReferenceNode;
    const cellId = `${refNode.sheet || context.activeSheetName}:${refNode.reference}`;

    // Check for circular reference
    const visitedCells = context.visitedCells || new Set<string>();
    if (visitedCells.has(cellId)) {
        // Circular reference detected - create non-expandable node
        const createdNode = createReferenceNode(refNode.reference, refNode.sheet);
        const createdEdge = createDefaultEdge(createdNode.id, parentID, handleID);
        nodes.push(createdNode);
        edges.push(createdEdge);
        return;
    }

    // Try to get cell's formula for expansion
    const cellFormula = getCellFormulaAsCollapsedNode(
        refNode.reference,
        refNode.sheet,
        context
    );

    if (cellFormula) {
        handleCellReferenceWithFormula(
            params,
            refNode,
            cellId,
            cellFormula,
            visitedCells
        );
    } else {
        // No formula - create regular reference node
        const createdNode = createReferenceNode(refNode.reference, refNode.sheet);
        const createdEdge = createDefaultEdge(createdNode.id, parentID, handleID);
        nodes.push(createdNode);
        edges.push(createdEdge);
    }
}

/**
 * Handles a cell reference that contains a formula (creates expandable content)
 */
function handleCellReferenceWithFormula(
    params: HandlerParams,
    refNode: CellReferenceNode,
    cellId: string,
    cellFormula: CollapsedNode,
    visitedCells: Set<string>
): void {
    const { nodes, edges, parentID, context, handleID, collapsedNodeId } = params;

    // Use cellId in the expansion ID to make it unique per cell reference
    const cellExpandId = `${collapsedNodeId}-${cellId}`;
    const isExpanded = context.expandedNodeIds.has(cellExpandId);

    // Create the cell reference node (with hasFormula=true for left handle)
    const refCreatedNode = createReferenceNode(
        refNode.reference,
        refNode.sheet,
        true
    );
    const refEdge = createDefaultEdge(refCreatedNode.id, parentID, handleID);
    nodes.push(refCreatedNode);
    edges.push(refEdge);

    // Create an expandable expression node connected to the reference
    const expandableNode = createExpandableExpressionNode(
        cellFormula.label,
        isExpanded,
        context.onToggleExpand,
        false
    );
    expandableNode.data.nodeId = cellExpandId;

    const expandableEdge = createDefaultEdge(expandableNode.id, refCreatedNode.id);
    nodes.push(expandableNode);
    edges.push(expandableEdge);

    if (isExpanded) {
        // Recursively visit the cell's formula children with circular ref protection
        const childContext: ExpansionContext = {
            ...context,
            visitedCells: new Set([...visitedCells, cellId]),
        };

        // cellFormula wraps a FormulaNode, which has one child: the expression
        // We want to visit the expression's children, not the formula's children
        const expression = cellFormula.children[0];
        if (expression) {
            expression.children.forEach((child, idx) => {
                visitCollapsedNodeWithExpansion(
                    child,
                    nodes,
                    edges,
                    expandableNode.id,
                    childContext,
                    undefined,
                    `${cellExpandId}-${idx}`
                );
            });
        }
    }
}

/**
 * Handles CellRange nodes
 */
function handleCellRange(params: HandlerParams): void {
    const { collapsedNode, nodes, edges, parentID, handleID } = params;

    const rangeNode = collapsedNode.original as CellRangeNode;
    const startNode = rangeNode.start;
    const endNode = rangeNode.end;

    const createdNode = createRangeNode(
        startNode.reference,
        endNode.reference,
        rangeNode.sheet
    );
    const createdEdge = createDefaultEdge(createdNode.id, parentID, handleID);
    nodes.push(createdNode);
    edges.push(createdEdge);
}

/**
 * Handles NumberLiteral nodes (currently skipped in expansion mode)
 */
function handleNumberLiteral(_params: HandlerParams): void {
    // Number literals are currently skipped in expansion mode
    // Uncomment below to enable:
    // const { collapsedNode, nodes, edges, parentID, handleID } = params;
    // const numLiteralNode = collapsedNode.original as NumberLiteralNode;
    // const createdNode = createNumNode(numLiteralNode.value);
    // const createdEdge = createDefaultEdge(createdNode.id, parentID, handleID);
    // nodes.push(createdNode);
    // edges.push(createdEdge);
}

/**
 * Handles StringLiteral nodes
 */
function handleStringLiteral(params: HandlerParams): void {
    const { collapsedNode, nodes, edges, parentID, handleID } = params;

    const strLiteralNode = collapsedNode.original as StringLiteralNode;
    const createdNode = createStringNode(strLiteralNode.value);
    const createdEdge = createDefaultEdge(createdNode.id, parentID, handleID);
    nodes.push(createdNode);
    edges.push(createdEdge);
}

/**
 * Handles FunctionCall nodes
 */
function handleFunctionCall(params: HandlerParams): void {
    const { collapsedNode, nodes, edges, parentID, context, handleID, collapsedNodeId } =
        params;

    const funNode = collapsedNode.original as FunctionCallNode;
    const funFormula = nodeToString(funNode);
    const argFormulas = collapsedNode.children.map((child) => child.label);

    const createdNode = createFunctionNode(funNode.name, argFormulas, funFormula);
    const createdEdge = createDefaultEdge(createdNode.id, parentID, handleID);
    nodes.push(createdNode);
    edges.push(createdEdge);

    collapsedNode.children.forEach((child, idx) => {
        visitCollapsedNodeWithExpansion(
            child,
            nodes,
            edges,
            createdNode.id,
            context,
            `arghandle-${idx}`,
            `${collapsedNodeId}-arg${idx}`
        );
    });
}

/**
 * Handles expandable expression nodes (BinaryOp, UnaryOp, Percent)
 */
function handleExpandableExpression(params: HandlerParams): void {
    const { collapsedNode, nodes, edges, parentID, context, handleID, collapsedNodeId } =
        params;

    const isExpanded = context.expandedNodeIds.has(collapsedNodeId);
    const isConnectedToFunctionArg = handleID?.startsWith("arghandle-") ?? false;

    if (collapsedNode.hasHiddenDetails) {
        // Create expandable node (collapsed or expanded state)
        const createdNode = createExpandableExpressionNode(
            collapsedNode.label,
            isExpanded,
            context.onToggleExpand,
            isConnectedToFunctionArg
        );
        // Override the nodeId in data to use our stable collapsed ID
        createdNode.data.nodeId = collapsedNodeId;

        const createdEdge = createDefaultEdge(createdNode.id, parentID, handleID);
        nodes.push(createdNode);
        edges.push(createdEdge);

        // Show children (important references, functions, ranges)
        collapsedNode.children.forEach((child, idx) => {
            visitCollapsedNodeWithExpansion(
                child,
                nodes,
                edges,
                createdNode.id,
                context,
                undefined,
                `${collapsedNodeId}-${idx}`
            );
        });
    } else {
        // No hidden details, just show as default node
        const createdNode = createDefaultNode(collapsedNode.label);
        const createdEdge = createDefaultEdge(createdNode.id, parentID, handleID);
        nodes.push(createdNode);
        edges.push(createdEdge);

        collapsedNode.children.forEach((child, idx) => {
            visitCollapsedNodeWithExpansion(
                child,
                nodes,
                edges,
                createdNode.id,
                context,
                undefined,
                `${collapsedNodeId}-${idx}`
            );
        });
    }
}

/**
 * Default handler for unknown node types
 */
function handleDefault(params: HandlerParams): void {
    const { collapsedNode, nodes, edges, parentID, context, handleID, collapsedNodeId } =
        params;

    const createdNode = createDefaultNode(collapsedNode.label);
    const createdEdge = createDefaultEdge(createdNode.id, parentID, handleID);
    nodes.push(createdNode);
    edges.push(createdEdge);

    collapsedNode.children.forEach((child, idx) => {
        visitCollapsedNodeWithExpansion(
            child,
            nodes,
            edges,
            createdNode.id,
            context,
            undefined,
            `${collapsedNodeId}-${idx}`
        );
    });
}

/**
 * Visits a collapsed AST node with full expansion support.
 * This is the most feature-rich visitor, supporting:
 * - Node expansion/collapse
 * - Circular reference detection
 * - Cell formula expansion
 *
 * @param collapsedNode - The collapsed node to visit
 * @param nodes - Array to collect created nodes
 * @param edges - Array to collect created edges
 * @param parentID - ID of the parent node to connect to
 * @param context - Expansion context with state and callbacks
 * @param handleID - Optional handle ID for function argument connections
 * @param collapsedNodeId - Optional stable ID for tracking expansion state
 */
export function visitCollapsedNodeWithExpansion(
    collapsedNode: CollapsedNode,
    nodes: Node[],
    edges: Edge[],
    parentID: string,
    context: ExpansionContext,
    handleID?: string,
    collapsedNodeId?: string
): void {
    // Generate a stable ID for this collapsed node to track expansion state
    const nodeCollapsedId = collapsedNodeId ?? `collapsed-${nodes.length}`;

    const params: HandlerParams = {
        collapsedNode,
        nodes,
        edges,
        parentID,
        context,
        handleID,
        collapsedNodeId: nodeCollapsedId,
    };

    switch (collapsedNode.original.type) {
        case "Formula":
            handleFormulaNode(params);
            break;

        case "CellReference":
            handleCellReference(params);
            break;

        case "CellRange":
            handleCellRange(params);
            break;

        case "NumberLiteral":
            handleNumberLiteral(params);
            break;

        case "StringLiteral":
            handleStringLiteral(params);
            break;

        case "FunctionCall":
            handleFunctionCall(params);
            break;

        case "BinaryOp":
        case "UnaryOp":
        case "Percent":
            handleExpandableExpression(params);
            break;

        default:
            handleDefault(params);
    }
}
