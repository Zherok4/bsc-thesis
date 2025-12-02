import type { CstNode, ILexingResult, IToken } from "chevrotain";
import { parserInstance } from "./parserConfig";
import { SpreadsheetFormulaLexer } from "./tokens";

export type ASTNode = 
    | FormulaNode
    | BinaryOpNode
    | UnaryOpNode
    | PercentNode
    | FunctionCallNode
    | CellReferenceNode
    | CellRangeNode
    | NumberLiteralNode
    | StringLiteralNode
    | BooleanLiteralNode;

export interface FormulaNode {
    type: "Formula";
    expression: ASTNode;
}

export interface BinaryOpNode {
    type: "BinaryOp";
    operator: string;
    left: ASTNode;
    right: ASTNode;
}

export interface UnaryOpNode {
    type: "UnaryOp";
    operator: string;
    operand: ASTNode;
}

export interface PercentNode {
    type: "Percent";
    operator: string;
    operand: ASTNode;
}

export interface FunctionCallNode {
    type: "FunctionCall";
    name: string;
    arguments: ASTNode[];
}

export interface CellReferenceNode {
    type: "CellReference";
    sheet?: string;
    reference: string;
    column: string;
    row: number;
    absoluteColumn: boolean;
    absoluteRow: boolean;
}

export interface CellRangeNode {
    type: "CellRange";
    sheet?: string;
    start: CellReferenceNode;
    end: CellReferenceNode;
}

export interface NumberLiteralNode {
    type: "NumberLiteral";
    value: number;
}

export interface StringLiteralNode {
    type: "StringLiteral";
    value: string;
}

export interface BooleanLiteralNode {
    type: "BooleanLiteral";
    value: boolean;
}

const BaseSpreadsheetVisitor = parserInstance.getBaseCstVisitorConstructor();

class SpreadsheetASTVisitor extends BaseSpreadsheetVisitor {
    constructor() {
        super();
        this.validateVisitor();
    }

    formula (ctx: any): FormulaNode {
        return {
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
                type: "UnaryOp",
                operator: "-",
                operand,
            };
        }

        if (ctx.Plus) {
            return {
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
            type: "FunctionCall",
            name: ctx.FunctionName[0].image.toUpperCase(),
            arguments: args,
        };
    }

    argumentList(ctx: any): ASTNode[] {
        return ctx.args.map((arg: CstNode) => this.visit(arg));
    }

    cellRange(ctx: any): CellReferenceNode | CellRangeNode {
        const sheet = ctx.SheetReference ? ctx.SheetReference[0].image.slice(0, -1) : undefined;

        const startRef = this.parseCellReference(ctx.start[0].image, sheet);

        if (ctx.end) {
            const endRef = this.parseCellReference(ctx.end[0].image, sheet);
            return {
                type: "CellRange",
                sheet,
                start: startRef,
                end: endRef,
            };
        }

        return startRef;
    }

    private parseCellReference(reference: string, sheet?: string): CellReferenceNode {
        const match = reference.match(/^(\$?)([A-Za-z]+)(\$?)(\d+)$/);
        if (!match) {
            throw new Error('Invalid cell reference: ${ref}');
        }
        const [, colAbsolute, column, rowAbsolute, row] = match;

        return {
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
                type: "NumberLiteral",
                value: parseFloat(ctx.Number[0].image),
            };
        }

        if (ctx.String) {
            const raw = ctx.String[0].image;
            const value = raw.slice(1, -1).replace(/\\(.)/g, "$1");
            return {
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