import {createToken, Lexer } from "chevrotain"; 
import type { TokenType } from "chevrotain";

export const WhiteSpace: TokenType = createToken({
    name: "WhiteSpace",
    pattern: /\s+/,
    group: Lexer.SKIPPED,
});

export const Equal: TokenType = createToken({
    name: "Equals",
    pattern: /=/
});

// Literals
export const Number: TokenType = createToken({
    name: "Number",
    pattern: /\d+(\.\d+)?([eE][+-]?\d+)?/,
});

export const String: TokenType = createToken({
    name: "String",
    pattern: /"([^"\\]|\\.)*"/,
});

// Cell and Range References
export const CellReference: TokenType = createToken({
    name: "CellReference",
    pattern: /\$?[A-Za-z]+\$?\d+/,
});

export const SheetReference: TokenType = createToken({
    name: "SheetReference",
    pattern: /[A-Za-z_][A-Za-z0-9_]*!/,
})

export const FunctionName: TokenType = createToken({
    name: "FunctionName",
    pattern: /[A-Za-z_][A-Za-z0-9_]*(?=\s*\()/,
});

// Operators
export const Plus: TokenType = createToken({name: "Plus", pattern: /\+/});
export const Minus: TokenType = createToken({name: "Minus", pattern: /-/});
export const Multiply: TokenType = createToken({name: "Multiply", pattern: /\+/});
export const Divide: TokenType = createToken({name:"Divide", pattern: /\//});
export const Power:TokenType = createToken({name: "Power", pattern: /\^/});
export const Concat: TokenType = createToken({name: "Concat", pattern: /&/});
export const Percent: TokenType = createToken({name: "Percent", pattern: /%/});

// Comparison Operators
export const NotEqual: TokenType = createToken({name: "NotEqual", pattern: /<>/});
export const LessEqual: TokenType = createToken({name: "LessEqual", pattern: /<=/});
export const GreaterEqual: TokenType = createToken({name: "GreaterEqual", pattern: />=/});
export const LessThan: TokenType = createToken({name: "LessThan", pattern: /</});
export const GreaterThan: TokenType = createToken({name: "GreaterThan", pattern: />/});

// Punctuation
export const LParen: TokenType = createToken({name: "LParen", pattern: /\(/});
export const RParen: TokenType = createToken({name: "RParen", pattern: /\)/});
export const Comma: TokenType = createToken({name: "Comma", pattern: /,/});
export const Colon: TokenType = createToken({name:"Colon", pattern:/:/});
export const Semicolon: TokenType = createToken({name:"Semicolon", pattern:/;/});

export const allTokens = [
    WhiteSpace,
    // Literals
    Number,
    String,
    // Operators
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
    // Punctuation
    LParen,
    RParen,
    Comma,
    Colon,
    Semicolon,
    Equal,
    // References
    SheetReference,
    FunctionName,
    CellReference,
];

// TODO: create buildLexer based on config options i.e which seperator etc.
export const SpreadsheetFormulaLexer: Lexer = new Lexer(allTokens);

