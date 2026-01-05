import type { Edge, Node } from "@xyflow/react";
import { nodeToString, type CollapsedNode } from "../../collapseAST";
import type {
    ASTNode,
    BinaryOpNode,
    CellRangeNode,
    CellReferenceNode,
    ColumnRangeNode,
    FunctionCallNode,
    NumberLiteralNode,
    RowRangeNode,
    StringLiteralNode,
} from "../../visitor";
import { createDefaultEdge } from "../edgeFactory";
import { getCellFormulaAsCollapsedNode } from "../helpers/cellFormulaHelper";
import {
    createBinOpNode,
    createColumnRangeNode,
    createConditionalNode,
    createDefaultNode,
    createExpandableExpressionNode,
    createFunctionNode,
    createRangeNode,
    createReferenceNode,
    createResultNode,
    createRowRangeNode,
    createStringNode,
} from "../nodeFactories";
import type { ExpansionContext } from "../types";
import { evaluateFormula } from "../../../utils";

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

    const createdNode = createResultNode(collapsedNode.label, context.activeSheetName);
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

    // Resolve sheet name - use explicit sheet from AST or fall back to context's active sheet
    const resolvedSheet = refNode.sheet || context.activeSheetName;

    // Check for circular reference
    const visitedCells = context.visitedCells || new Set<string>();
    if (visitedCells.has(cellId)) {
        // Circular reference detected - create non-expandable node
        const createdNode = createReferenceNode(
            refNode.reference,
            resolvedSheet,
            false,
            undefined,
            refNode.nodeId
        );
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
            visitedCells,
            resolvedSheet
        );
    } else {
        // No formula - create regular reference node
        const createdNode = createReferenceNode(
            refNode.reference,
            resolvedSheet,
            false,
            undefined,
            refNode.nodeId
        );
        const createdEdge = createDefaultEdge(createdNode.id, parentID, handleID);
        nodes.push(createdNode);
        edges.push(createdEdge);
    }
}

/**
 * Handles a cell reference that contains a formula (creates expandable reference node)
 */
function handleCellReferenceWithFormula(
    params: HandlerParams,
    refNode: CellReferenceNode,
    cellId: string,
    cellFormula: CollapsedNode,
    visitedCells: Set<string>,
    resolvedSheet: string
): void {
    const { nodes, edges, parentID, context, handleID, collapsedNodeId } = params;

    // Use cellId in the expansion ID to make it unique per cell reference
    const cellExpandId = `${collapsedNodeId}-${cellId}`;
    const isExpanded = context.expandedNodeIds.has(cellExpandId);

    // Create the cell reference node with expansion support
    const refCreatedNode = createReferenceNode(
        refNode.reference,
        resolvedSheet,
        true,
        {
            isExpanded,
            onToggleExpand: context.onToggleExpand,
            expansionNodeId: cellExpandId,
        },
        refNode.nodeId
    );
    const refEdge = createDefaultEdge(refCreatedNode.id, parentID, handleID);
    nodes.push(refCreatedNode);
    edges.push(refEdge);

    // When expanded, connect children directly to the reference node
    if (isExpanded) {
        // Recursively visit the cell's formula children with circular ref protection
        const childContext: ExpansionContext = {
            ...context,
            visitedCells: new Set([...visitedCells, cellId]),
        };

        // cellFormula wraps a FormulaNode - visit its children (the top-level expressions)
        // This properly handles all formula types: references, functions, binary ops, etc.
        cellFormula.children.forEach((child, idx) => {
            visitCollapsedNodeWithExpansion(
                child,
                nodes,
                edges,
                refCreatedNode.id,
                childContext,
                undefined,
                `${cellExpandId}-${idx}`
            );
        });
    }
}

/**
 * Handles CellRange nodes
 */
function handleCellRange(params: HandlerParams): void {
    const { collapsedNode, nodes, edges, parentID, handleID, context } = params;

    const rangeNode = collapsedNode.original as CellRangeNode;
    const startNode = rangeNode.start;
    const endNode = rangeNode.end;

    const createdNode = createRangeNode(
        startNode.reference,
        endNode.reference,
        rangeNode.sheet || context.activeSheetName
    );
    const createdEdge = createDefaultEdge(createdNode.id, parentID, handleID);
    nodes.push(createdNode);
    edges.push(createdEdge);
}

/**
 * Handles ColumnRange nodes (e.g., A:B, $A:$C)
 */
function handleColumnRange(params: HandlerParams): void {
    const { collapsedNode, nodes, edges, parentID, handleID, context } = params;

    const colRangeNode = collapsedNode.original as ColumnRangeNode;

    const createdNode = createColumnRangeNode(
        colRangeNode.startColumn,
        colRangeNode.endColumn,
        colRangeNode.sheet || context.activeSheetName
    );
    const createdEdge = createDefaultEdge(createdNode.id, parentID, handleID);
    nodes.push(createdNode);
    edges.push(createdEdge);
}

/**
 * Handles RowRange nodes (e.g., 1:10, $1:$5)
 */
function handleRowRange(params: HandlerParams): void {
    const { collapsedNode, nodes, edges, parentID, handleID, context } = params;

    const rowRangeNode = collapsedNode.original as RowRangeNode;

    const createdNode = createRowRangeNode(
        rowRangeNode.startRow,
        rowRangeNode.endRow,
        rowRangeNode.sheet || context.activeSheetName
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
    //const { collapsedNode, nodes, edges, parentID, handleID } = params;

    //const strLiteralNode = collapsedNode.original as StringLiteralNode;
    //const createdNode = createStringNode(strLiteralNode.value);
    //const createdEdge = createDefaultEdge(createdNode.id, parentID, handleID);
    //nodes.push(createdNode);
    //edges.push(createdEdge);
}

/**
 * Handles FunctionCall nodes
 */
// TODO: create custom handles for certain functions: false(), true(), vlookup(), xlookup()
function handleFunctionCall(params: HandlerParams): void {
    const { collapsedNode } = params;
    const funNode = collapsedNode.original as FunctionCallNode;
    const funName = funNode.name.toUpperCase();

    // Route to specialized handlers for IF/IFS
    if (funName === 'IF' || funName === 'IFS') {
        handleConditionalFunctionCall(params, funName as 'IF' | 'IFS');
        return;
    }

    // Generic function handling
    handleGenericFunctionCall(params);
}

/**
 * Handles generic function calls (non-conditional)
 */
function handleGenericFunctionCall(params: HandlerParams): void {
    const { collapsedNode, nodes, edges, parentID, context, handleID, collapsedNodeId } =
        params;

    const funNode = collapsedNode.original as FunctionCallNode;
    const funFormula = nodeToString(funNode);
    const argFormulas = collapsedNode.children.map((child) => child.label);

    // Build constant args info for editable constants
    const constantArgs: Record<number, { astNodeId: string; type: 'number' | 'string'; rawValue: string | number }> = {};
    funNode.arguments.forEach((arg, idx) => {
        const info = getConstantInfo(arg);
        if (info) {
            constantArgs[idx] = {
                astNodeId: info.astNodeId,
                type: info.type,
                rawValue: info.rawValue,
            };
        }
    });

    const createdNode = createFunctionNode(
        funNode.name,
        argFormulas,
        funFormula,
        context.activeSheetName,
        Object.keys(constantArgs).length > 0 ? constantArgs : undefined
    );
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
 * Determines if a condition result is truthy for IF/IFS evaluation.
 */
function isTruthyCondition(result: string): boolean {
    const upper = result.toUpperCase();
    return upper === 'TRUE' || (upper !== 'FALSE' && upper !== '0' && upper !== '' && !upper.startsWith('#'));
}

/**
 * Handles IF and IFS function calls with specialized ConditionalNode.
 * Implements collapsing logic: only visits active branches or manually expanded branches.
 */
function handleConditionalFunctionCall(
    params: HandlerParams,
    funName: 'IF' | 'IFS'
): void {
    const { collapsedNode, nodes, edges, parentID, context, handleID, collapsedNodeId } =
        params;

    const funNode = collapsedNode.original as FunctionCallNode;
    const funFormula = nodeToString(funNode);
    const argFormulas = collapsedNode.children.map((child) => child.label);

    // Generate expansion IDs for each branch
    // For IF: 2 branches (true, false)
    // For IFS: N/2 branches (one per condition-value pair)
    const branchCount = funName === 'IF' ? 2 : Math.floor(argFormulas.length / 2);
    const branchExpansionIds: string[] = [];
    const expandedBranchIndices: number[] = [];

    for (let i = 0; i < branchCount; i++) {
        const branchId = `${collapsedNodeId}-branch-${i}`;
        branchExpansionIds.push(branchId);
        if (context.expandedNodeIds.has(branchId)) {
            expandedBranchIndices.push(i);
        }
    }

    // Evaluate condition(s) to determine active branch
    let activeBranchIndex = -1;
    if (funName === 'IF') {
        // IF: evaluate the first argument (condition)
        const conditionFormula = argFormulas[0];
        try {
            const conditionResult = evaluateFormula(conditionFormula, context.hfInstance, context.activeSheetName);
            activeBranchIndex = isTruthyCondition(conditionResult) ? 0 : 1;
        } catch {
            // Cell reference out of bounds - default to showing true branch
            activeBranchIndex = 0;
        }
    } else {
        // IFS: find the first truthy condition
        for (let i = 0; i < branchCount; i++) {
            const conditionFormula = argFormulas[i * 2]; // conditions are at even indices
            try {
                const conditionResult = evaluateFormula(conditionFormula, context.hfInstance, context.activeSheetName);
                if (isTruthyCondition(conditionResult)) {
                    activeBranchIndex = i;
                    break;
                }
            } catch {
                // Cell reference out of bounds - continue checking other conditions
            }
        }
    }

    const createdNode = createConditionalNode(funName, argFormulas, funFormula, {
        onToggleBranchExpand: context.onToggleExpand,
        branchExpansionIds,
        expandedBranchIndices,
    }, context.activeSheetName);
    const createdEdge = createDefaultEdge(createdNode.id, parentID, handleID);
    nodes.push(createdNode);
    edges.push(createdEdge);

    // Visit children selectively based on collapse state
    if (funName === 'IF') {
        // IF structure: [condition, value_if_true, value_if_false]
        // Always visit condition (index 0)
        if (collapsedNode.children[0]) {
            visitCollapsedNodeWithExpansion(
                collapsedNode.children[0],
                nodes,
                edges,
                createdNode.id,
                context,
                `arghandle-0`,
                `${collapsedNodeId}-arg0`
            );
        }

        // Visit true branch (index 1) if active OR manually expanded
        const isTrueBranchActive = activeBranchIndex === 0;
        const isTrueBranchExpanded = expandedBranchIndices.includes(0);
        const shouldVisitTrueBranch = isTrueBranchActive || isTrueBranchExpanded;
        if (shouldVisitTrueBranch && collapsedNode.children[1]) {
            // If branch is expanded but not active, mark children as inactive path
            const trueBranchContext = !isTrueBranchActive && isTrueBranchExpanded
                ? { ...context, isInactivePath: true }
                : context;
            visitCollapsedNodeWithExpansion(
                collapsedNode.children[1],
                nodes,
                edges,
                createdNode.id,
                trueBranchContext,
                `arghandle-1`,
                `${collapsedNodeId}-arg1`
            );
        }

        // Visit false branch (index 2) if active OR manually expanded
        const isFalseBranchActive = activeBranchIndex === 1;
        const isFalseBranchExpanded = expandedBranchIndices.includes(1);
        const shouldVisitFalseBranch = isFalseBranchActive || isFalseBranchExpanded;
        if (shouldVisitFalseBranch && collapsedNode.children[2]) {
            // If branch is expanded but not active, mark children as inactive path
            const falseBranchContext = !isFalseBranchActive && isFalseBranchExpanded
                ? { ...context, isInactivePath: true }
                : context;
            visitCollapsedNodeWithExpansion(
                collapsedNode.children[2],
                nodes,
                edges,
                createdNode.id,
                falseBranchContext,
                `arghandle-2`,
                `${collapsedNodeId}-arg2`
            );
        }
    } else {
        // IFS structure: [cond1, val1, cond2, val2, ...]
        for (let pairIndex = 0; pairIndex < branchCount; pairIndex++) {
            const conditionIdx = pairIndex * 2;
            const valueIdx = pairIndex * 2 + 1;
            const isPairActive = pairIndex === activeBranchIndex;
            const isPairExpanded = expandedBranchIndices.includes(pairIndex);

            // Always visit condition - conditions are never marked as inactive
            // (they provide context about why a path was not taken)
            if (collapsedNode.children[conditionIdx]) {
                visitCollapsedNodeWithExpansion(
                    collapsedNode.children[conditionIdx],
                    nodes,
                    edges,
                    createdNode.id,
                    context,
                    `arghandle-${conditionIdx}`,
                    `${collapsedNodeId}-arg${conditionIdx}`
                );
            }

            // Visit value only if this is the active pair OR manually expanded
            const shouldVisitValue = isPairActive || isPairExpanded;
            if (shouldVisitValue && collapsedNode.children[valueIdx]) {
                // If pair is expanded but not active, mark children as inactive path
                const valueContext = !isPairActive && isPairExpanded
                    ? { ...context, isInactivePath: true }
                    : context;
                visitCollapsedNodeWithExpansion(
                    collapsedNode.children[valueIdx],
                    nodes,
                    edges,
                    createdNode.id,
                    valueContext,
                    `arghandle-${valueIdx}`,
                    `${collapsedNodeId}-arg${valueIdx}`
                );
            }
        }
    }
}

/**
 * Information about a constant for editing
 */
interface ConstantInfo {
    /** The display value (may include quotes for strings) */
    displayValue: string;
    /** The raw value (number for numbers, unquoted string for strings) */
    rawValue: string | number;
    /** The type of constant */
    type: 'number' | 'string';
    /** The AST node ID */
    astNodeId: string;
}

/**
 * Gets the constant info from an AST node if it's a literal.
 * Returns undefined for non-constant nodes.
 */
function getConstantInfo(node: ASTNode): ConstantInfo | undefined {
    if (node.type === "NumberLiteral") {
        const numNode = node as NumberLiteralNode;
        return {
            displayValue: String(numNode.value),
            rawValue: numNode.value,
            type: 'number',
            astNodeId: numNode.nodeId,
        };
    }
    if (node.type === "StringLiteral") {
        const strNode = node as StringLiteralNode;
        return {
            displayValue: `"${strNode.value}"`,
            rawValue: strNode.value,
            type: 'string',
            astNodeId: strNode.nodeId,
        };
    }
    return undefined;
}

/**
 * If in the BinaryOp no other BinaryOp is direct child than we use an BinaryOpNode else it is an math expression
 * and therfore use an Expandable Node.
 */
function handleBinaryOp(params: HandlerParams): void {
    const { collapsedNode, nodes, edges, parentID, context, handleID, collapsedNodeId } =
        params;

    const binaryNode = collapsedNode.original as BinaryOpNode;

    if (binaryNode.left.type === "BinaryOp" || binaryNode.right.type === "BinaryOp") {
        handleExpandableExpression(params);
    } else {
        const leftConstantInfo = getConstantInfo(binaryNode.left);
        const rightConstantInfo = getConstantInfo(binaryNode.right);

        const createdNode = createBinOpNode(
            binaryNode.operator,
            leftConstantInfo?.displayValue,
            rightConstantInfo?.displayValue,
            leftConstantInfo ? {
                astNodeId: leftConstantInfo.astNodeId,
                type: leftConstantInfo.type,
                rawValue: leftConstantInfo.rawValue,
            } : undefined,
            rightConstantInfo ? {
                astNodeId: rightConstantInfo.astNodeId,
                type: rightConstantInfo.type,
                rawValue: rightConstantInfo.rawValue,
            } : undefined
        );
        const createdEdge = createDefaultEdge(createdNode.id, parentID, handleID);
        nodes.push(createdNode);
        edges.push(createdEdge);

        // When a constant exists, it's not in collapsedNode.children
        // So we need to determine which handle each child connects to
        let childIdx = 0;

        // Visit left operand only if not a constant
        if (!leftConstantInfo && collapsedNode.children[childIdx]) {
            visitCollapsedNodeWithExpansion(
                collapsedNode.children[childIdx],
                nodes,
                edges,
                createdNode.id,
                context,
                "operand",
                `${collapsedNodeId}-left`
            );
            childIdx++;
        }

        // Visit right operand only if not a constant
        if (!rightConstantInfo && collapsedNode.children[childIdx]) {
            visitCollapsedNodeWithExpansion(
                collapsedNode.children[childIdx],
                nodes,
                edges,
                createdNode.id,
                context,
                "operand",
                `${collapsedNodeId}-right`
            );
        }
    }
}

/**
 * Generates an argument label from an index (0 -> A, 1 -> B, ..., 25 -> Z, 26 -> AA, etc.)
 */
function getArgumentLabel(index: number): string {
    let label = '';
    let n = index;
    do {
        label = String.fromCharCode(65 + (n % 26)) + label;
        n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return label;
}

/**
 * Represents an argument for the expandable expression node
 */
interface ExpressionArgument {
    label: string;
    originalFormula: string;
    constantValue?: string;
}

/**
 * Builds arguments and display formula from collapsed node children.
 * Replaces each child's label in the formula with A, B, C... labels.
 */
function buildExpressionArguments(
    formula: string,
    children: CollapsedNode[]
): { displayFormula: string; args: ExpressionArgument[] } {
    const args: ExpressionArgument[] = [];
    let displayFormula = formula;

    children.forEach((child, idx) => {
        const label = getArgumentLabel(idx);
        const originalFormula = child.label;

        args.push({
            label,
            originalFormula,
        });

        // Replace the child's formula in the display formula with the label
        // Use a simple replacement (first occurrence)
        displayFormula = displayFormula.replace(originalFormula, label);
    });

    return { displayFormula, args };
}

/**
 * Handles expandable expression nodes (UnaryOp, Percent, nested BinaryOp)
 */
function handleExpandableExpression(params: HandlerParams): void {
    const { collapsedNode, nodes, edges, parentID, context, handleID, collapsedNodeId } =
        params;

    const isExpanded = context.expandedNodeIds.has(collapsedNodeId);
    const isConnectedToFunctionArg = handleID?.startsWith("arghandle-") ?? false;

    if (collapsedNode.hasHiddenDetails) {
        // Build arguments from children (A, B, C...)
        const { displayFormula, args } = buildExpressionArguments(
            collapsedNode.label,
            collapsedNode.children
        );

        // Create expandable node (collapsed or expanded state)
        const createdNode = createExpandableExpressionNode(
            collapsedNode.label,
            displayFormula,
            args,
            isExpanded,
            context.onToggleExpand,
            isConnectedToFunctionArg,
            context.activeSheetName
        );
        // Override the nodeId in data to use our stable collapsed ID
        createdNode.data.nodeId = collapsedNodeId;

        const createdEdge = createDefaultEdge(createdNode.id, parentID, handleID);
        nodes.push(createdNode);
        edges.push(createdEdge);

        // Show children (important references, functions, ranges) with proper arghandle IDs
        collapsedNode.children.forEach((child, idx) => {
            visitCollapsedNodeWithExpansion(
                child,
                nodes,
                edges,
                createdNode.id,
                context,
                `arghandle-${idx}`,
                `${collapsedNodeId}-${idx}`
            );
        });
    } else {
        // No hidden details - build arguments but show as simpler node
        const { displayFormula, args } = buildExpressionArguments(
            collapsedNode.label,
            collapsedNode.children
        );

        const createdNode = createExpandableExpressionNode(
            collapsedNode.label,
            displayFormula,
            args,
            isExpanded,
            context.onToggleExpand,
            isConnectedToFunctionArg,
            context.activeSheetName
        );
        createdNode.data.nodeId = collapsedNodeId;

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
 * - Inactive path styling for conditional branches
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

    // Track node count before handler to identify newly created nodes
    const nodeCountBefore = nodes.length;

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

        case "ColumnRange":
            handleColumnRange(params);
            break;

        case "RowRange":
            handleRowRange(params);
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
            handleBinaryOp(params);
            break;

        case "UnaryOp":
        case "Percent":
            handleExpandableExpression(params);
            break;

        default:
            handleDefault(params);
    }

    // If on an inactive path, add className to all newly created nodes
    if (context.isInactivePath) {
        for (let i = nodeCountBefore; i < nodes.length; i++) {
            const node = nodes[i];
            node.className = node.className
                ? `${node.className} inactive-path`
                : 'inactive-path';
        }
    }
}
