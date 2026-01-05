import type { CstNode, ILexingResult, IToken } from "chevrotain";
import { parserInstance } from "./parserConfig";
import { SpreadsheetFormulaLexer } from "./tokens";

/**
 * Base interface for all AST nodes, providing a unique identifier.
 */
export interface BaseASTNode {
    /** Unique identifier for this node within the AST */
    nodeId: string;
}

export type ASTNode =
    | FormulaNode
    | BinaryOpNode
    | UnaryOpNode
    | PercentNode
    | FunctionCallNode
    | CellReferenceNode
    | CellRangeNode
    | ColumnRangeNode
    | RowRangeNode
    | NumberLiteralNode
    | StringLiteralNode
    | BooleanLiteralNode;

export interface FormulaNode extends BaseASTNode {
    type: "Formula";
    expression: ASTNode;
}

export interface BinaryOpNode extends BaseASTNode {
    type: "BinaryOp";
    operator: string;
    left: ASTNode;
    right: ASTNode;
}

export interface UnaryOpNode extends BaseASTNode {
    type: "UnaryOp";
    operator: string;
    operand: ASTNode;
}

export interface PercentNode extends BaseASTNode {
    type: "Percent";
    operator: string;
    operand: ASTNode;
}

export interface FunctionCallNode extends BaseASTNode {
    type: "FunctionCall";
    name: string;
    arguments: ASTNode[];
}

export interface CellReferenceNode extends BaseASTNode {
    type: "CellReference";
    sheet?: string;
    reference: string;
    column: string;
    row: number;
    absoluteColumn: boolean;
    absoluteRow: boolean;
}

export interface CellRangeNode extends BaseASTNode {
    type: "CellRange";
    sheet?: string;
    start: CellReferenceNode;
    end: CellReferenceNode;
}

export interface ColumnRangeNode extends BaseASTNode {
    type: "ColumnRange";
    sheet?: string;
    startColumn: string;
    endColumn: string;
    absoluteStart: boolean;
    absoluteEnd: boolean;
}

export interface RowRangeNode extends BaseASTNode {
    type: "RowRange";
    sheet?: string;
    startRow: number;
    endRow: number;
    absoluteStart: boolean;
    absoluteEnd: boolean;
}

export interface NumberLiteralNode extends BaseASTNode {
    type: "NumberLiteral";
    value: number;
}

export interface StringLiteralNode extends BaseASTNode {
    type: "StringLiteral";
    value: string;
}

export interface BooleanLiteralNode extends BaseASTNode {
    type: "BooleanLiteral";
    value: boolean;
}

const BaseSpreadsheetVisitor = parserInstance.getBaseCstVisitorConstructor();

class SpreadsheetASTVisitor extends BaseSpreadsheetVisitor {
    private nodeIdCounter: number = 0;

    constructor() {
        super();
        this.validateVisitor();
    }

    /** Resets the node ID counter. Should be called before parsing a new formula. */
    resetCounter(): void {
        this.nodeIdCounter = 0;
    }

    /** Generates a unique node ID */
    private generateNodeId(): string {
        return `ast-${this.nodeIdCounter++}`;
    }

    formula (ctx: any): FormulaNode {
        return {
            nodeId: this.generateNodeId(),
            type: "Formula",
            expression: this.visit(ctx.expression),
        };
    }

    expression (ctx: any): ASTNode {
        return this.visit(ctx.comparisonExpression);
    }

    comparisonExpression(ctx: any): ASTNode {
        let result = this.visit(ctx.lhs);

        if (ctx.rhs) {
            const operators = [
                ...(ctx.Equal || []),
                ...(ctx.NotEqual || []),
                ...(ctx.LessThan || []),
                ...(ctx.GreaterThan || []),
                ...(ctx.LessEqual || []),
                ...(ctx.GreaterEqual || []),
            ].sort((a: IToken, b: IToken) => a.startOffset - b.startOffset);

            ctx.rhs.forEach((rhsOperand: CstNode, idx: number) => {
                result = {
                    nodeId: this.generateNodeId(),
                    type: "BinaryOp",
                    operator: operators[idx].image,
                    left: result,
                    right: this.visit(rhsOperand),
                };
            });
        }

        return result;
    }

    concatExpression(ctx: any): ASTNode {
        let result = this.visit(ctx.lhs);

        if (ctx.rhs) {
            ctx.rhs.forEach((rhsOperand: CstNode) => {
                result = {
                    nodeId: this.generateNodeId(),
                    type: "BinaryOp",
                    operator: "&",
                    left: result,
                    right: this.visit(rhsOperand),
                };
            });
        }

        return result;
    }

    additiveExpression(ctx: any): ASTNode {
        let result = this.visit(ctx.lhs);

        if (ctx.rhs) {
            const operators = [
                ...(ctx.Plus || []),
                ...(ctx.Minus || [])
            ].sort((a:IToken, b:IToken) => a.startOffset - b.startOffset);

            ctx.rhs.forEach((rhsOperand: CstNode, idx: number) => {
                result = {
                    nodeId: this.generateNodeId(),
                    type: "BinaryOp",
                    operator: operators[idx].image,
                    left: result,
                    right: this.visit(rhsOperand),
                };
            });
        }

        return result;
    }

    multiplicativeExpression(ctx: any): ASTNode {
        let result = this.visit(ctx.lhs);

        if (ctx.rhs) {
            const operators = [
                ...(ctx.Multiply || []),
                ...(ctx.Divide || [])
            ].sort((a:IToken, b:IToken) => a.startOffset - b.startOffset);

            ctx.rhs.forEach((rhsOperand: CstNode, idx: number) => {
                result = {
                    nodeId: this.generateNodeId(),
                    type: "BinaryOp",
                    operator: operators[idx].image,
                    left: result,
                    right: this.visit(rhsOperand),
                };
            });
        }

        return result;
    }

    powerExpression(ctx: any): ASTNode {
        let result = this.visit(ctx.lhs);

        if (ctx.rhs) {
            ctx.rhs.forEach((rhsOperand: CstNode) => {
                result = {
                    nodeId: this.generateNodeId(),
                    type: "BinaryOp",
                    operator: "^",
                    left: result,
                    right: this.visit(rhsOperand),
                };
            });
        }

        return result;
    }

    unaryExpression(ctx: any): ASTNode {
        const operand = this.visit(ctx.percentExpression);

        if (ctx.Minus) {
            return {
                nodeId: this.generateNodeId(),
                type: "UnaryOp",
                operator: "-",
                operand,
            };
        }

        if (ctx.Plus) {
            return {
                nodeId: this.generateNodeId(),
                type: "UnaryOp",
                operator: "+",
                operand,
            };
        }

        return operand;
    }

    percentExpression(ctx: any): ASTNode {
        const operand = this.visit(ctx.atomicExpression);

        if (ctx.Percent) {
            return {
                nodeId: this.generateNodeId(),
                type: "Percent",
                operator: "%",
                operand,
            };
        }

        return operand;
    }

    atomicExpression(ctx: any): ASTNode {
        if (ctx.functionCall) {
            return this.visit(ctx.functionCall);
        }

        if (ctx.cellRange) {
            return this.visit(ctx.cellRange);
        }

        if (ctx.literal) {
            return this.visit(ctx.literal);
        }

        if (ctx.parenExpression) {
            return this.visit(ctx.parenExpression);
        }
        throw new Error("Unexpected atomicExpression");
    }

    functionCall(ctx: any): FunctionCallNode {
        const args = ctx.argumentList ? this.visit(ctx.argumentList) : [];
        return {
            nodeId: this.generateNodeId(),
            type: "FunctionCall",
            name: ctx.FunctionName[0].image.toUpperCase(),
            arguments: args,
        };
    }

    argumentList(ctx: any): ASTNode[] {
        return ctx.args.map((arg: CstNode) => this.visit(arg));
    }

    cellRange(ctx: any): CellReferenceNode | CellRangeNode | ColumnRangeNode | RowRangeNode {
        let sheet: string | undefined = undefined;
        if (ctx.SheetReference) {
            // Remove trailing '!' and strip quotes if present
            const raw = ctx.SheetReference[0].image.slice(0, -1);
            sheet = raw.startsWith("'") && raw.endsWith("'") ? raw.slice(1, -1) : raw;
        }

        // Handle column range: A:B, $A:$B
        if (ctx.startCol) {
            const startColImage = ctx.startCol[0].image;
            const endColImage = ctx.endCol[0].image;
            return {
                nodeId: this.generateNodeId(),
                type: "ColumnRange",
                sheet,
                startColumn: this.parseColumnReference(startColImage),
                endColumn: this.parseColumnReference(endColImage),
                absoluteStart: startColImage.startsWith("$"),
                absoluteEnd: endColImage.startsWith("$"),
            };
        }

        // Handle row range: 1:10, $1:$10
        if (ctx.startRow) {
            const startRowImage = ctx.startRow[0].image;
            const endRowImage = ctx.endRow[0].image;
            return {
                nodeId: this.generateNodeId(),
                type: "RowRange",
                sheet,
                startRow: this.parseRowReference(startRowImage),
                endRow: this.parseRowReference(endRowImage),
                absoluteStart: startRowImage.startsWith("$"),
                absoluteEnd: endRowImage.startsWith("$"),
            };
        }

        // Handle cell reference or cell range: A1 or A1:B10
        const startRef = this.parseCellReference(ctx.start[0].image, sheet);

        if (ctx.end) {
            const endRef = this.parseCellReference(ctx.end[0].image, sheet);
            return {
                nodeId: this.generateNodeId(),
                type: "CellRange",
                sheet,
                start: startRef,
                end: endRef,
            };
        }

        return startRef;
    }

    private parseColumnReference(reference: string): string {
        const match = reference.match(/^\$?([A-Za-z]+)$/);
        if (!match) {
            throw new Error(`Invalid column reference: ${reference}`);
        }
        return match[1].toUpperCase();
    }

    private parseRowReference(reference: string): number {
        const match = reference.match(/^\$?(\d+)$/);
        if (!match) {
            throw new Error(`Invalid row reference: ${reference}`);
        }
        return parseInt(match[1], 10);
    }

    private parseCellReference(reference: string, sheet?: string): CellReferenceNode {
        const match = reference.match(/^(\$?)([A-Za-z]+)(\$?)(\d+)$/);
        if (!match) {
            throw new Error('Invalid cell reference: ${ref}');
        }
        const [, colAbsolute, column, rowAbsolute, row] = match;

        return {
            nodeId: this.generateNodeId(),
            type: "CellReference",
            sheet,
            reference,
            column: column.toUpperCase(),
            row: parseInt(row, 10),
            absoluteColumn: colAbsolute === "$",
            absoluteRow: rowAbsolute === "$",
        };
    }

    literal(ctx: any): NumberLiteralNode | StringLiteralNode {
        if (ctx.Number) {
            return {
                nodeId: this.generateNodeId(),
                type: "NumberLiteral",
                value: parseFloat(ctx.Number[0].image),
            };
        }

        if (ctx.String) {
            const raw = ctx.String[0].image;
            const value = raw.slice(1, -1).replace(/\\(.)/g, "$1");
            return {
                nodeId: this.generateNodeId(),
                type: "StringLiteral",
                value,
            };
        }

        throw new Error("Unexpected literal");
    }

    parenExpression(ctx: any): ASTNode {
        return this.visit(ctx.expression);
    }
}

export const astVisitor = new SpreadsheetASTVisitor();

// PUBLIC API
// TODO: Documentation
export interface ParseResult {
    ast: FormulaNode | null;
    cst: CstNode | null,
    errors: any[];
    lexErrors: any[];
}

export function parse(formula: string): ParseResult {
    const lexResult: ILexingResult = SpreadsheetFormulaLexer.tokenize(formula);

    if (lexResult.errors.length > 0) {
        return {
            ast: null,
            cst: null,
            errors: [],
            lexErrors: lexResult.errors,
        }
    }

    parserInstance.input = lexResult.tokens;
    const cst: CstNode = parserInstance.formula();

    if (parserInstance.errors.length > 0) {
        return {
            ast: null,
            cst,
            errors: parserInstance.errors,
            lexErrors: [],
        };
    }

    astVisitor.resetCounter();
    const ast: FormulaNode = astVisitor.visit(cst) as FormulaNode;

    return {
        ast,
        cst,
        errors: [],
        lexErrors: [],
    };
}

export function parseFormula(formula: string): FormulaNode {
    const result: ParseResult = parse(formula);

    if (result.lexErrors.length > 0) {
        throw new Error('Lexer error: ${result.lexErrors[0].message}');
    }

    if (result.errors.length > 0) {
        throw new Error('Parser error: ${result.errors[0].message}');
    }

    return result.ast!;
}