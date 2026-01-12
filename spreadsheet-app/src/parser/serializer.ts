import type {
    ASTNode,
    FormulaNode,
    BinaryOpNode,
    UnaryOpNode,
    PercentNode,
    FunctionCallNode,
    CellReferenceNode,
    CellRangeNode,
    ColumnRangeNode,
    RowRangeNode,
    NumberLiteralNode,
    StringLiteralNode,
    BooleanLiteralNode,
} from './visitor';
import { parseFormula } from './visitor';

/**
 * A transformer function that creates a new node from an existing one.
 */
export type NodeTransformer<T extends ASTNode = ASTNode> = (node: T) => ASTNode;

/**
 * Result of an AST transformation.
 */
export interface TransformResult {
    /** The transformed AST */
    ast: FormulaNode;
    /** Whether any nodes were transformed */
    transformed: boolean;
}

/**
 * Transforms an AST by applying a transformer function to the node with the specified nodeId.
 * Creates a deep clone of the AST, replacing only the targeted node.
 * @param ast - The AST to transform (will be cloned, not mutated)
 * @param targetNodeId - The nodeId of the node to transform
 * @param transformer - Function to create the new node from the existing one
 * @returns The transformed AST and whether a transformation occurred
 */
export function transformAST(
    ast: FormulaNode,
    targetNodeId: string,
    transformer: NodeTransformer
): TransformResult {
    let transformed = false;

    function visit(node: ASTNode): ASTNode {
        if (node.nodeId === targetNodeId) {
            transformed = true;
            return transformer(node);
        }

        switch (node.type) {
            case 'Formula':
                return { ...node, expression: visit(node.expression) };

            case 'BinaryOp':
                return { ...node, left: visit(node.left), right: visit(node.right) };

            case 'UnaryOp':
            case 'Percent':
                return { ...node, operand: visit(node.operand) };

            case 'FunctionCall':
                return { ...node, arguments: node.arguments.map(visit) };

            case 'CellRange':
                return {
                    ...node,
                    start: visit(node.start) as CellReferenceNode,
                    end: visit(node.end) as CellReferenceNode,
                };

            case 'ColumnRange':
            case 'RowRange':
                // Leaf nodes, just clone
                return { ...node };

            default:
                return { ...node };
        }
    }

    const newAst = visit(ast) as FormulaNode;
    return { ast: newAst, transformed };
}

/**
 * Finds an AST node by its nodeId and returns its serialized form.
 * @param ast - The root AST to search in
 * @param targetNodeId - The nodeId to find
 * @returns The serialized expression string, or null if not found
 */
export function findAndSerializeNode(ast: FormulaNode, targetNodeId: string): string | null {
    function find(node: ASTNode): ASTNode | null {
        if (node.nodeId === targetNodeId) {
            return node;
        }

        switch (node.type) {
            case 'Formula':
                return find(node.expression);

            case 'BinaryOp':
                return find(node.left) ?? find(node.right);

            case 'UnaryOp':
            case 'Percent':
                return find(node.operand);

            case 'FunctionCall':
                for (const arg of node.arguments) {
                    const result = find(arg);
                    if (result) return result;
                }
                return null;

            case 'CellRange':
                return find(node.start) ?? find(node.end);

            default:
                return null;
        }
    }

    const foundNode = find(ast);
    if (foundNode) {
        return serializeNode(foundNode);
    }
    return null;
}

/**
 * Finds an AST node by its nodeId and returns its type.
 * @param ast - The root AST to search in
 * @param targetNodeId - The nodeId to find
 * @returns The node type string, or null if not found
 */
export function findAstNodeType(ast: FormulaNode, targetNodeId: string): ASTNode['type'] | null {
    function find(node: ASTNode): ASTNode | null {
        if (node.nodeId === targetNodeId) {
            return node;
        }

        switch (node.type) {
            case 'Formula':
                return find(node.expression);

            case 'BinaryOp':
                return find(node.left) ?? find(node.right);

            case 'UnaryOp':
            case 'Percent':
                return find(node.operand);

            case 'FunctionCall':
                for (const arg of node.arguments) {
                    const result = find(arg);
                    if (result) return result;
                }
                return null;

            case 'CellRange':
                return find(node.start) ?? find(node.end);

            default:
                return null;
        }
    }

    const foundNode = find(ast);
    if (foundNode) {
        return foundNode.type;
    }
    return null;
}

/**
 * Creates a transformer that produces an updated CellReference node.
 * @param newReference - The new reference string (e.g., "B2")
 * @param newSheet - Optional new sheet name
 */
export function createCellReferenceTransformer(
    newReference: string,
    newSheet?: string
): NodeTransformer {
    return (node: ASTNode): ASTNode => {
        if (node.type !== 'CellReference') {
            return node;
        }
        const refNode = node as CellReferenceNode;
        const match = newReference.match(/^(\$?)([A-Za-z]+)(\$?)(\d+)$/);
        if (!match) {
            throw new Error(`Invalid cell reference: ${newReference}`);
        }

        const [, colAbsolute, column, rowAbsolute, row] = match;

        return {
            nodeId: refNode.nodeId,
            type: 'CellReference',
            sheet: newSheet,
            reference: newReference,
            column: column.toUpperCase(),
            row: parseInt(row, 10),
            absoluteColumn: colAbsolute === '$',
            absoluteRow: rowAbsolute === '$',
        };
    };
}

/**
 * Creates a transformer that produces an updated NumberLiteral node.
 * @param newValue - The new number value
 */
export function createNumberLiteralTransformer(newValue: number): NodeTransformer {
    return (node: ASTNode): ASTNode => {
        if (node.type !== 'NumberLiteral') {
            return node;
        }
        return {
            nodeId: node.nodeId,
            type: 'NumberLiteral',
            value: newValue,
        };
    };
}

/**
 * Creates a transformer that produces an updated StringLiteral node.
 * @param newValue - The new string value
 */
export function createStringLiteralTransformer(newValue: string): NodeTransformer {
    return (node: ASTNode): ASTNode => {
        if (node.type !== 'StringLiteral') {
            return node;
        }
        return {
            nodeId: node.nodeId,
            type: 'StringLiteral',
            value: newValue,
        };
    };
}

/**
 * Creates a transformer that produces an updated CellRange node.
 * @param startReference - The new start reference string (e.g., "A1")
 * @param endReference - The new end reference string (e.g., "B10")
 * @param newSheet - Optional new sheet name
 */
export function createCellRangeTransformer(
    startReference: string,
    endReference: string,
    newSheet?: string
): NodeTransformer {
    return (node: ASTNode): ASTNode => {
        if (node.type !== 'CellRange') {
            return node;
        }
        const rangeNode = node as CellRangeNode;

        const startMatch = startReference.match(/^(\$?)([A-Za-z]+)(\$?)(\d+)$/);
        const endMatch = endReference.match(/^(\$?)([A-Za-z]+)(\$?)(\d+)$/);

        if (!startMatch || !endMatch) {
            throw new Error(`Invalid cell range references: ${startReference}:${endReference}`);
        }

        const [, startColAbs, startCol, startRowAbs, startRow] = startMatch;
        const [, endColAbs, endCol, endRowAbs, endRow] = endMatch;

        return {
            nodeId: rangeNode.nodeId,
            type: 'CellRange',
            sheet: newSheet,
            start: {
                nodeId: rangeNode.start.nodeId,
                type: 'CellReference',
                sheet: newSheet,
                reference: startReference,
                column: startCol.toUpperCase(),
                row: parseInt(startRow, 10),
                absoluteColumn: startColAbs === '$',
                absoluteRow: startRowAbs === '$',
            },
            end: {
                nodeId: rangeNode.end.nodeId,
                type: 'CellReference',
                sheet: newSheet,
                reference: endReference,
                column: endCol.toUpperCase(),
                row: parseInt(endRow, 10),
                absoluteColumn: endColAbs === '$',
                absoluteRow: endRowAbs === '$',
            },
        };
    };
}

/**
 * Creates a transformer that produces an updated ColumnRange node.
 * @param startColumn - The new start column (e.g., "A")
 * @param endColumn - The new end column (e.g., "B")
 * @param newSheet - Optional new sheet name
 */
export function createColumnRangeTransformer(
    startColumn: string,
    endColumn: string,
    newSheet?: string
): NodeTransformer {
    return (node: ASTNode): ASTNode => {
        if (node.type !== 'ColumnRange') {
            return node;
        }
        const colRangeNode = node as ColumnRangeNode;

        return {
            nodeId: colRangeNode.nodeId,
            type: 'ColumnRange',
            sheet: newSheet,
            startColumn: startColumn.toUpperCase(),
            endColumn: endColumn.toUpperCase(),
            absoluteStart: colRangeNode.absoluteStart,
            absoluteEnd: colRangeNode.absoluteEnd,
        };
    };
}

/**
 * Creates a transformer that produces an updated RowRange node.
 * @param startRow - The new start row (1-indexed)
 * @param endRow - The new end row (1-indexed)
 * @param newSheet - Optional new sheet name
 */
export function createRowRangeTransformer(
    startRow: number,
    endRow: number,
    newSheet?: string
): NodeTransformer {
    return (node: ASTNode): ASTNode => {
        if (node.type !== 'RowRange') {
            return node;
        }
        const rowRangeNode = node as RowRangeNode;

        return {
            nodeId: rowRangeNode.nodeId,
            type: 'RowRange',
            sheet: newSheet,
            startRow,
            endRow,
            absoluteStart: rowRangeNode.absoluteStart,
            absoluteEnd: rowRangeNode.absoluteEnd,
        };
    };
}

/**
 * Serializes an AST node back to a formula string.
 * This is the inverse operation of parsing.
 * @param node - The AST node to serialize
 * @returns The formula string representation
 */
export function serializeNode(node: ASTNode): string {
    switch (node.type) {
        case 'Formula':
            return serializeFormula(node);
        case 'BinaryOp':
            return serializeBinaryOp(node);
        case 'UnaryOp':
            return serializeUnaryOp(node);
        case 'Percent':
            return serializePercent(node);
        case 'FunctionCall':
            return serializeFunctionCall(node);
        case 'CellReference':
            return serializeCellReference(node);
        case 'CellRange':
            return serializeCellRange(node);
        case 'ColumnRange':
            return serializeColumnRange(node);
        case 'RowRange':
            return serializeRowRange(node);
        case 'NumberLiteral':
            return serializeNumberLiteral(node);
        case 'StringLiteral':
            return serializeStringLiteral(node);
        case 'BooleanLiteral':
            return serializeBooleanLiteral(node);
        default:
            throw new Error(`Unknown node type: ${(node as ASTNode).type}`);
    }
}

/**
 * Serializes a FormulaNode (the root node).
 */
function serializeFormula(node: FormulaNode): string {
    return `=${serializeNode(node.expression)}`;
}

/**
 * Serializes a BinaryOpNode.
 * Handles operator precedence by wrapping operands in parentheses when needed.
 */
function serializeBinaryOp(node: BinaryOpNode): string {
    const left = serializeNode(node.left);
    const right = serializeNode(node.right);
    return `${left}${node.operator}${right}`;
}

/**
 * Serializes a UnaryOpNode.
 */
function serializeUnaryOp(node: UnaryOpNode): string {
    const operand = serializeNode(node.operand);
    return `${node.operator}${operand}`;
}

/**
 * Serializes a PercentNode.
 */
function serializePercent(node: PercentNode): string {
    const operand = serializeNode(node.operand);
    return `${operand}%`;
}

/**
 * Serializes a FunctionCallNode.
 */
function serializeFunctionCall(node: FunctionCallNode): string {
    const args = node.arguments.map(arg => serializeNode(arg)).join(',');
    return `${node.name}(${args})`;
}

/**
 * Serializes a CellReferenceNode.
 */
function serializeCellReference(node: CellReferenceNode): string {
    const colPrefix = node.absoluteColumn ? '$' : '';
    const rowPrefix = node.absoluteRow ? '$' : '';
    const ref = `${colPrefix}${node.column}${rowPrefix}${node.row}`;

    if (node.sheet) {
        return `${node.sheet}!${ref}`;
    }
    return ref;
}

/**
 * Serializes a CellRangeNode.
 */
function serializeCellRange(node: CellRangeNode): string {
    const startRef = serializeCellReference(node.start);
    const endRef = serializeCellReference(node.end);

    if (node.sheet) {
        const startWithoutSheet = startRef.includes('!')
            ? startRef.split('!')[1]
            : startRef;
        const endWithoutSheet = endRef.includes('!')
            ? endRef.split('!')[1]
            : endRef;
        return `${node.sheet}!${startWithoutSheet}:${endWithoutSheet}`;
    }
    return `${startRef}:${endRef}`;
}

/**
 * Serializes a ColumnRangeNode.
 */
function serializeColumnRange(node: { type: 'ColumnRange'; sheet?: string; startColumn: string; endColumn: string; absoluteStart: boolean; absoluteEnd: boolean }): string {
    const startPrefix = node.absoluteStart ? '$' : '';
    const endPrefix = node.absoluteEnd ? '$' : '';
    const range = `${startPrefix}${node.startColumn}:${endPrefix}${node.endColumn}`;

    if (node.sheet) {
        return `${node.sheet}!${range}`;
    }
    return range;
}

/**
 * Serializes a RowRangeNode.
 */
function serializeRowRange(node: { type: 'RowRange'; sheet?: string; startRow: number; endRow: number; absoluteStart: boolean; absoluteEnd: boolean }): string {
    const startPrefix = node.absoluteStart ? '$' : '';
    const endPrefix = node.absoluteEnd ? '$' : '';
    const range = `${startPrefix}${node.startRow}:${endPrefix}${node.endRow}`;

    if (node.sheet) {
        return `${node.sheet}!${range}`;
    }
    return range;
}

/**
 * Serializes a NumberLiteralNode.
 */
function serializeNumberLiteral(node: NumberLiteralNode): string {
    return String(node.value);
}

/**
 * Serializes a StringLiteralNode.
 */
function serializeStringLiteral(node: StringLiteralNode): string {
    const escaped = node.value.replace(/"/g, '\\"');
    return `"${escaped}"`;
}

/**
 * Serializes a BooleanLiteralNode.
 */
function serializeBooleanLiteral(node: BooleanLiteralNode): string {
    return node.value ? 'TRUE' : 'FALSE';
}

/**
 * Creates a transformer that replaces any AST node with a new expression.
 * The new expression is parsed from a formula string.
 * @param newExpression - The expression string to replace with (e.g., "A1", "SUM(A1:B10)")
 *                        Do NOT include the leading "=" - just the expression part
 * @returns A transformer function that replaces the target node
 */
export function createExpressionReplacementTransformer(
    newExpression: string
): NodeTransformer {
    return (node: ASTNode): ASTNode => {
        // Parse the new expression as a formula (adding = prefix)
        const fullFormula = `=${newExpression}`;
        let parsed: FormulaNode;
        try {
            parsed = parseFormula(fullFormula);
        } catch (error) {
            // If parsing fails, return the original node unchanged
            console.warn(`Failed to parse expression "${newExpression}":`, error);
            return node;
        }

        // The parsed formula wraps the expression in a FormulaNode
        // Extract the actual expression and preserve the original nodeId
        const newNode = parsed.expression;

        // Preserve the original nodeId so the AST tracking remains consistent
        return {
            ...newNode,
            nodeId: node.nodeId,
        };
    };
}

/**
 * Result of adding an argument to a function.
 */
export interface AddArgumentResult {
    /** The transformed AST */
    ast: FormulaNode;
    /** The index of the newly added argument */
    newArgIndex: number;
    /** Whether the transformation was successful */
    success: boolean;
}

/**
 * Adds a new argument to a FunctionCall node in the AST.
 * Creates a deep clone of the AST, adding the new argument to the function with the specified nodeId.
 * @param ast - The AST to transform (will be cloned, not mutated)
 * @param functionNodeId - The nodeId of the FunctionCall node to add the argument to
 * @param newArgumentFormula - The formula string for the new argument (e.g., "A1", "B2:C5")
 * @returns The transformed AST, new argument index, and success status
 */
export function addFunctionArgument(
    ast: FormulaNode,
    functionNodeId: string,
    newArgumentFormula: string
): AddArgumentResult {
    // Parse the new argument as a formula
    const fullFormula = `=${newArgumentFormula}`;
    let newArgNode: ASTNode;
    try {
        const parsed = parseFormula(fullFormula);
        newArgNode = parsed.expression;
    } catch (error) {
        console.warn(`Failed to parse argument "${newArgumentFormula}":`, error);
        return { ast, newArgIndex: -1, success: false };
    }

    let newArgIndex = -1;
    let transformed = false;

    function visit(node: ASTNode): ASTNode {
        if (node.nodeId === functionNodeId && node.type === 'FunctionCall') {
            transformed = true;
            const funNode = node as FunctionCallNode;
            newArgIndex = funNode.arguments.length;

            return {
                ...funNode,
                arguments: [...funNode.arguments, newArgNode],
            };
        }

        switch (node.type) {
            case 'Formula':
                return { ...node, expression: visit(node.expression) };

            case 'BinaryOp':
                return { ...node, left: visit(node.left), right: visit(node.right) };

            case 'UnaryOp':
            case 'Percent':
                return { ...node, operand: visit(node.operand) };

            case 'FunctionCall':
                return { ...node, arguments: node.arguments.map(visit) };

            case 'CellRange':
                return {
                    ...node,
                    start: visit(node.start) as CellReferenceNode,
                    end: visit(node.end) as CellReferenceNode,
                };

            default:
                return { ...node };
        }
    }

    const newAst = visit(ast) as FormulaNode;
    return {
        ast: newAst,
        newArgIndex,
        success: transformed,
    };
}
