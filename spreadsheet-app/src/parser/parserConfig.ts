import { CstParser } from "chevrotain";
import type { CstNode } from "chevrotain";
import { allTokens } from "./tokens";
import {
    Number,
    String,
    NotEqual,
    LessEqual,
    GreaterEqual,
    LessThan,
    GreaterThan,
    Plus,
    Minus,
    Multiply,
    Divide,
    Power,
    Concat,
    Percent,
    LParen,
    RParen,
    Comma,
    Colon,
    Semicolon,
    Equal,
    SheetReference,
    FunctionName,
    ColumnReference,
    RowReference,
    CellReference,
 } from "./tokens";


class SpreadsheetFormulaParser extends CstParser {
    public formula!: () => CstNode;
    private expression!: () => CstNode;
    private comparisonExpression!: () => CstNode;
    private concatExpression!: () => CstNode;
    private additiveExpression!: () => CstNode;
    private multiplicativeExpression!: () => CstNode;
    private powerExpression!: () => CstNode;
    private unaryExpression!: () => CstNode;
    private percentExpression!: () => CstNode;
    private atomicExpression!: () => CstNode;
    private functionCall!: () => CstNode;
    private argumentList!: () => CstNode;
    private cellRange!: () => CstNode;
    private literal!: () => CstNode;
    private parenExpression!: () => CstNode;

    constructor() {
        super (allTokens)

        const $: this = this;

        $.RULE("formula", () => {
            $.OPTION(() => $.CONSUME(Equal));
            $.SUBRULE($.expression);
        });

        $.RULE("expression", () => {
            $.SUBRULE($.comparisonExpression)
        });

        // Maybe MANY not best fit
        $.RULE("comparisonExpression", () => {
            $.SUBRULE($.concatExpression, { LABEL: "lhs"});
            $.MANY(() => {
                $.OR([
                    { ALT: () => $.CONSUME(Equal) },
                    { ALT: () => $.CONSUME(NotEqual) },
                    { ALT: () => $.CONSUME(LessThan) },
                    { ALT: () => $.CONSUME(GreaterThan) },
                    { ALT: () => $.CONSUME(LessEqual) },
                    { ALT: () => $.CONSUME(GreaterEqual) },
                ]);
                $.SUBRULE2($.concatExpression, {LABEL: "rhs"});
            });
        });

        $.RULE("concatExpression", () => {
            $.SUBRULE($.additiveExpression, { LABEL: "lhs" });
            $.MANY(() => {
                $.CONSUME(Concat);
                $.SUBRULE2($.additiveExpression, { LABEL: "rhs" });
            });
        });

        $.RULE("additiveExpression", () => {
            $.SUBRULE($.multiplicativeExpression, { LABEL: "lhs" });
            $.MANY(() => {
                $.OR([
                    { ALT: () => $.CONSUME(Plus) },
                    { ALT: () => $.CONSUME(Minus) },
                ]);
                $.SUBRULE2($.additiveExpression, { LABEL:"rhs" });
            });
        });

        $.RULE("multiplicativeExpression", () => {
            $.SUBRULE($.powerExpression, { LABEL: "lhs" });
            $.MANY(() => {
                $.OR([
                    { ALT: () => $.CONSUME(Multiply) },
                    { ALT: () => $.CONSUME(Divide) },
                ]);
                $.SUBRULE2($.powerExpression, { LABEL: "rhs" });
            });
        });

        $.RULE("powerExpression", () => {
            $.SUBRULE($.unaryExpression, { LABEL: "lhs" });
            $.MANY(() => {
                $.CONSUME(Power);
                $.SUBRULE2($.unaryExpression, {LABEL: "rhs"});
            });
        });

        $.RULE("unaryExpression", () => {
            $.OPTION(() => {
                $.OR([
                    { ALT: () => $.CONSUME(Minus) },
                    { ALT: () => $.CONSUME(Plus) },
                ]);
            });
            $.SUBRULE($.percentExpression);
        });

        $.RULE("percentExpression", () => {
            $.SUBRULE($.atomicExpression);
            $.OPTION(() => $.CONSUME(Percent));
        });

        $.RULE("atomicExpression", () => {
            $.OR([
                { ALT: () => $.SUBRULE($.functionCall) },
                { ALT: () => $.SUBRULE($.cellRange) },
                { ALT: () => $.SUBRULE($.literal) },
                { ALT: () => $.SUBRULE($.parenExpression) },
            ]);
        });

        $.RULE("functionCall", () => {
            $.CONSUME(FunctionName);
            $.CONSUME(LParen);
            $.OPTION(() => $.SUBRULE($.argumentList));
            $.CONSUME(RParen);
        });

        // WE need config for differnet seperators !
        $.RULE("argumentList", () => {
            $.SUBRULE($.expression, { LABEL: "args" });
            $.MANY(() => {
                $.OR([
                    { ALT: () => $.CONSUME(Comma) },
                    { ALT: () => $.CONSUME(Semicolon) },
                ]);
                $.SUBRULE2($.expression, { LABEL: "args"});
            });
        });

        $.RULE("cellRange", () => {
            $.OPTION(() => $.CONSUME(SheetReference));
            $.OR([
                // Column range: A:B, $A:$B
                { ALT: () => {
                    $.CONSUME(ColumnReference, { LABEL: "startCol" });
                    $.CONSUME(Colon);
                    $.CONSUME2(ColumnReference, { LABEL: "endCol" });
                }},
                // Row range: 1:10, $1:$10
                { ALT: () => {
                    $.CONSUME(RowReference, { LABEL: "startRow" });
                    $.CONSUME2(Colon);
                    $.CONSUME2(RowReference, { LABEL: "endRow" });
                }},
                // Cell reference or cell range (existing): A1 or A1:B10
                { ALT: () => {
                    $.CONSUME(CellReference, { LABEL: "start" });
                    $.OPTION2(() => {
                        $.CONSUME3(Colon);
                        $.CONSUME2(CellReference, { LABEL: "end" });
                    });
                }},
            ]);
        });

        $.RULE("literal", () => {
            $.OR([
                { ALT: () => $.CONSUME(Number) },
                { ALT: () => $.CONSUME(String) },
            ]);
        });

        $.RULE("parenExpression", () => {
            $.CONSUME(LParen);
            $.SUBRULE($.expression);
            $.CONSUME(RParen);
        });

        $.performSelfAnalysis();
    }
}

export const parserInstance = new SpreadsheetFormulaParser();