/**
 * Registry for generating human-readable descriptions of Excel functions.
 * Each function has a template that gets populated with actual argument values.
 */

import type { HyperFormula } from "hyperformula";
import { getParameterName } from "./functionParameters";
import { evaluateFormula } from "../utils";

/**
 * Template for generating function descriptions.
 * Uses {paramName} placeholders that get replaced with actual argument values.
 */
interface FunctionDescriptionTemplate {
    /** The description template with {paramName} placeholders */
    template: string;
    /** Whether this function uses variadic args (handled specially) */
    isVariadic?: boolean;
    /** Verb for variadic functions (e.g., "Adds", "Calculates the average of") */
    variadicVerb?: string;
    /** Whether to show parameter labels in output (default: false) */
    showLabels?: boolean;
}

/**
 * Simplifies a formula by evaluating nested function calls.
 * Only evaluates when the formula contains operators (like >, <, +, -, etc.)
 * Pure cell references/ranges are kept as-is.
 *
 * For example: "SUM(A2:A11) > 2" becomes "171 > 2"
 * But: "A2:A11" stays as "A2:A11"
 *
 * @param formula - The formula string to simplify
 * @param hfInstance - HyperFormula instance for evaluation
 * @param sheet - Sheet name for context
 * @returns Simplified formula string
 */
function simplifyFormula(
    formula: string,
    hfInstance: HyperFormula | null,
    sheet: string
): string {
    if (!hfInstance) return formula;

    // Pattern to match function calls: FUNCTIONNAME(...)
    const functionPattern = /([A-Z][A-Z0-9]*)\(([^()]*(?:\([^()]*\)[^()]*)*)\)/gi;

    // Pattern to detect operators (comparison, arithmetic)
    const hasOperators = /[><=!+\-*/&|^]/.test(formula);

    // Only simplify if the formula contains operators AND function calls
    // This keeps pure cell references like "A2:A11" unchanged
    if (!hasOperators || !functionPattern.test(formula)) {
        return formula;
    }

    let simplified = formula;
    let hasChanges = true;
    let iterations = 0;
    const maxIterations = 10; // Prevent infinite loops

    // Keep simplifying until no more changes (handles nested functions)
    while (hasChanges && iterations < maxIterations) {
        hasChanges = false;
        iterations++;

        // Reset the regex lastIndex
        functionPattern.lastIndex = 0;

        // Evaluate function calls only
        simplified = simplified.replace(functionPattern, (match) => {
            const result = evaluateFormula(`=${match}`, hfInstance, sheet);
            // Only replace if we got a valid result (not an error)
            if (result && !result.startsWith('#') && result !== match) {
                hasChanges = true;
                return result;
            }
            return match;
        });
    }

    return simplified;
}

/**
 * Formats a list of variadic arguments into a readable string.
 * @param args - Array of argument formula strings (already simplified)
 * @param paramBaseName - Base name for parameters (e.g., "number" for SUM)
 * @param showLabels - Whether to include parameter labels (e.g., "number1 (A1)" vs "A1")
 * @returns Formatted string like "number1 (A1), number2 (B2), and number3 (5)" or "A1, B2, and 5"
 */
function formatVariadicArgs(args: string[], paramBaseName: string, showLabels: boolean): string {
    if (args.length === 0) return "no arguments";

    if (showLabels) {
        if (args.length === 1) return `${paramBaseName}1 (${args[0]})`;
        if (args.length === 2) {
            return `${paramBaseName}1 (${args[0]}) and ${paramBaseName}2 (${args[1]})`;
        }
        const lastArg = args[args.length - 1];
        const otherArgs = args.slice(0, -1).map((arg, i) => `${paramBaseName}${i + 1} (${arg})`);
        return `${otherArgs.join(", ")}, and ${paramBaseName}${args.length} (${lastArg})`;
    } else {
        if (args.length === 1) return args[0];
        if (args.length === 2) {
            return `${args[0]} and ${args[1]}`;
        }
        const lastArg = args[args.length - 1];
        const otherArgs = args.slice(0, -1);
        return `${otherArgs.join(", ")}, and ${lastArg}`;
    }
}

/**
 * Registry of function description templates.
 * Maps function name (uppercase) to its description template.
 */
const FUNCTION_DESCRIPTIONS: Record<string, FunctionDescriptionTemplate> = {
    // --- Logical Functions ---
    "IF": {
        template: "If the condition is true, return {then}, otherwise return {else}"
    },
    "IFERROR": {
        template: "Returns {value} unless it's an error, then returns {value_if_error}"
    },
    "IFNA": {
        template: "Returns {value} unless it's #N/A, then returns {value_if_na}"
    },
    "IFS": {
        template: "Evaluates multiple conditions and returns the value for the first true condition"
    },
    "SWITCH": {
        template: "Evaluates {expression} and returns the matching result"
    },
    "AND": {
        isVariadic: true,
        variadicVerb: "Returns TRUE if all of",
        template: "{args} are true"
    },
    "OR": {
        isVariadic: true,
        variadicVerb: "Returns TRUE if any of",
        template: "{args} is true"
    },
    "XOR": {
        isVariadic: true,
        variadicVerb: "Returns TRUE if an odd number of",
        template: "{args} are true"
    },
    "NOT": {
        template: "Returns the opposite of {logical}"
    },
    "TRUE": {
        template: "Returns the logical value TRUE"
    },
    "FALSE": {
        template: "Returns the logical value FALSE"
    },

    // --- Lookup & Reference Functions ---
    "VLOOKUP": {
        template: "Looks up {value to lookup} in {in table}, returns value from column {vertical offset}"
    },
    "HLOOKUP": {
        template: "Looks up {value to lookup} in {in table}, returns value from row {horizontal offset}"
    },
    "INDEX": {
        template: "Returns the value at row {row_num} and column {column_num} in {array}"
    },
    "MATCH": {
        template: "Finds the position of {lookup_value} in {lookup_array}"
    },
    "CHOOSE": {
        template: "Returns the value at position {index_num} from the provided options"
    },
    "OFFSET": {
        template: "Returns a reference offset from {reference} by {rows} rows and {cols} columns"
    },
    "INDIRECT": {
        template: "Returns the reference specified by {ref_text}"
    },
    "COLUMN": {
        template: "Returns the column number of {reference}"
    },
    "ROW": {
        template: "Returns the row number of {reference}"
    },
    "COLUMNS": {
        template: "Returns the number of columns in {array}"
    },
    "ROWS": {
        template: "Returns the number of rows in {array}"
    },
    "ADDRESS": {
        template: "Creates a cell address from row {row_num} and column {column_num}"
    },

    // --- Math & Trig Functions ---
    "SUM": {
        isVariadic: true,
        variadicVerb: "Adds",
        template: "{args} together"
    },
    "SUMIF": {
        template: "Sums cells in {sum_range} where {range} matches {criteria}"
    },
    "SUMIFS": {
        template: "Sums cells in {sum_range} that match multiple criteria"
    },
    "PRODUCT": {
        isVariadic: true,
        variadicVerb: "Multiplies",
        template: "{args} together"
    },
    "QUOTIENT": {
        template: "Returns the integer portion of {numerator} divided by {denominator}"
    },
    "MOD": {
        template: "Returns the remainder of {number} divided by {divisor}"
    },
    "ABS": {
        template: "Returns the absolute value of {number}"
    },
    "SQRT": {
        template: "Returns the square root of {number}"
    },
    "POWER": {
        template: "Returns {number} raised to the power of {power}"
    },
    "EXP": {
        template: "Returns e raised to the power of {number}"
    },
    "LN": {
        template: "Returns the natural logarithm of {number}"
    },
    "LOG": {
        template: "Returns the logarithm of {number} with base {base}"
    },
    "LOG10": {
        template: "Returns the base-10 logarithm of {number}"
    },
    "INT": {
        template: "Rounds {number} down to the nearest integer"
    },
    "TRUNC": {
        template: "Truncates {number} to {num_digits} decimal places"
    },
    "ROUND": {
        template: "Rounds {number} to {num_digits} decimal places"
    },
    "ROUNDUP": {
        template: "Rounds {number} up to {num_digits} decimal places"
    },
    "ROUNDDOWN": {
        template: "Rounds {number} down to {num_digits} decimal places"
    },
    "CEILING": {
        template: "Rounds {number} up to the nearest multiple of {significance}"
    },
    "FLOOR": {
        template: "Rounds {number} down to the nearest multiple of {significance}"
    },
    "RAND": {
        template: "Returns a random number between 0 and 1"
    },
    "RANDBETWEEN": {
        template: "Returns a random integer between {bottom} and {top}"
    },
    "PI": {
        template: "Returns the value of pi (3.14159...)"
    },
    "SUBTOTAL": {
        template: "Calculates a subtotal using function {function_num} on the specified ranges"
    },

    // --- Statistical Functions ---
    "AVERAGE": {
        isVariadic: true,
        variadicVerb: "Calculates the average of",
        template: "{args}"
    },
    "AVERAGEIF": {
        template: "Averages cells in {average_range} where {range} matches {criteria}"
    },
    "AVERAGEIFS": {
        template: "Averages cells in {average_range} that match multiple criteria"
    },
    "COUNT": {
        isVariadic: true,
        variadicVerb: "Counts the numbers in",
        template: "{args}"
    },
    "COUNTA": {
        isVariadic: true,
        variadicVerb: "Counts non-empty cells in",
        template: "{args}"
    },
    "COUNTBLANK": {
        isVariadic: true,
        variadicVerb: "Counts empty cells in",
        template: "{args}"
    },
    "COUNTIF": {
        template: "Counts cells in {range} that match {criteria}"
    },
    "COUNTIFS": {
        template: "Counts cells that match multiple criteria across ranges"
    },
    "MAX": {
        isVariadic: true,
        variadicVerb: "Returns the largest value from",
        template: "{args}"
    },
    "MIN": {
        isVariadic: true,
        variadicVerb: "Returns the smallest value from",
        template: "{args}"
    },
    "MAXIFS": {
        template: "Returns the maximum value in {max_range} that matches the criteria"
    },
    "MINIFS": {
        template: "Returns the minimum value in {min_range} that matches the criteria"
    },

    // --- Text Functions ---
    "CONCAT": {
        isVariadic: true,
        variadicVerb: "Joins",
        template: "{args} into a single string"
    },
    "CONCATENATE": {
        isVariadic: true,
        variadicVerb: "Joins",
        template: "{args} into a single string"
    },
    "TEXT": {
        template: "Formats {value} as text using format {format_text}"
    },
    "LEFT": {
        template: "Returns the first {num_chars} characters from {text}"
    },
    "RIGHT": {
        template: "Returns the last {num_chars} characters from {text}"
    },
    "MID": {
        template: "Returns {num_chars} characters from {text} starting at position {start_num}"
    },
    "LEN": {
        template: "Returns the length of {text}"
    },
    "FIND": {
        template: "Finds the position of {find_text} in {within_text}"
    },
    "SEARCH": {
        template: "Searches for {find_text} in {within_text} (case-insensitive)"
    },
    "SUBSTITUTE": {
        template: "Replaces {old_text} with {new_text} in {text}"
    },
    "REPLACE": {
        template: "Replaces {num_chars} characters in {old_text} starting at {start_num} with {new_text}"
    },
    "TRIM": {
        template: "Removes extra spaces from {text}"
    },
    "UPPER": {
        template: "Converts {text} to uppercase"
    },
    "LOWER": {
        template: "Converts {text} to lowercase"
    },
    "PROPER": {
        template: "Capitalizes the first letter of each word in {text}"
    },
    "VALUE": {
        template: "Converts {text} to a number"
    },
    "T": {
        template: "Returns {value} if it's text, otherwise returns empty"
    },
    "EXACT": {
        template: "Checks if {text1} and {text2} are exactly equal (case-sensitive)"
    },

    // --- Date & Time Functions ---
    "TODAY": {
        template: "Returns today's date"
    },
    "NOW": {
        template: "Returns the current date and time"
    },
    "DATE": {
        template: "Creates a date from {year}, {month}, and {day}"
    },
    "TIME": {
        template: "Creates a time from {hour}, {minute}, and {second}"
    },
    "DAY": {
        template: "Returns the day of the month from {serial_number}"
    },
    "MONTH": {
        template: "Returns the month from {serial_number}"
    },
    "YEAR": {
        template: "Returns the year from {serial_number}"
    },
    "HOUR": {
        template: "Returns the hour from {serial_number}"
    },
    "MINUTE": {
        template: "Returns the minute from {serial_number}"
    },
    "SECOND": {
        template: "Returns the second from {serial_number}"
    },
    "EDATE": {
        template: "Returns a date {months} months after {start_date}"
    },
    "EOMONTH": {
        template: "Returns the last day of the month {months} months after {start_date}"
    },
    "DATEDIF": {
        template: "Calculates the difference between {start_date} and {end_date} in {unit}"
    },
    "DAYS": {
        template: "Returns the number of days between {start_date} and {end_date}"
    },
    "NETWORKDAYS": {
        template: "Returns working days between {start_date} and {end_date}"
    },
    "NETWORKDAYS.INTL": {
        template: "Returns working days between {start_date} and {end_date} with custom weekend"
    },
    "WORKDAY": {
        template: "Returns the date {days} working days after {start_date}"
    },
    "WORKDAY.INTL": {
        template: "Returns the date {days} working days after {start_date} with custom weekend"
    },

    // --- Information Functions ---
    "ISBLANK": {
        template: "Returns TRUE if {value} is empty"
    },
    "ISERROR": {
        template: "Returns TRUE if {value} is any error"
    },
    "ISERR": {
        template: "Returns TRUE if {value} is an error (except #N/A)"
    },
    "ISNA": {
        template: "Returns TRUE if {value} is #N/A"
    },
    "ISLOGICAL": {
        template: "Returns TRUE if {value} is a logical value"
    },
    "ISNUMBER": {
        template: "Returns TRUE if {value} is a number"
    },
    "ISTEXT": {
        template: "Returns TRUE if {value} is text"
    },
    "ISNONTEXT": {
        template: "Returns TRUE if {value} is not text"
    },
    "ISREF": {
        template: "Returns TRUE if {value} is a reference"
    },
};

/**
 * Generates a human-readable description of what a function does.
 * @param functionName - The Excel function name (case-insensitive)
 * @param argFormulas - Array of argument formula strings
 * @param hfInstance - Optional HyperFormula instance for simplifying nested formulas
 * @param sheet - Optional sheet name for context when simplifying
 * @returns A sentence describing the function's operation
 */
export function generateFunctionDescription(
    functionName: string,
    argFormulas: string[],
    hfInstance: HyperFormula | null = null,
    sheet: string = ''
): string {
    const upperName = functionName.toUpperCase();
    const template = FUNCTION_DESCRIPTIONS[upperName];

    // Simplify argument formulas by evaluating nested function calls
    const simplifiedArgs = argFormulas.map(formula =>
        simplifyFormula(formula, hfInstance, sheet)
    );

    // Fallback for unknown functions
    if (!template) {
        return generateFallbackDescription(upperName, simplifiedArgs);
    }

    // Use per-function showLabels setting (default: false)
    const showLabels = template.showLabels ?? false;

    // Handle variadic functions specially
    if (template.isVariadic && template.variadicVerb) {
        const paramBaseName = getParameterName(upperName, 0).replace(/\d+$/, '');
        const formattedArgs = formatVariadicArgs(simplifiedArgs, paramBaseName, showLabels);
        return `${template.variadicVerb} ${template.template.replace("{args}", formattedArgs)}`;
    }

    // Replace placeholders with actual values
    let description = template.template;

    simplifiedArgs.forEach((formula, idx) => {
        const paramName = getParameterName(upperName, idx);
        const placeholder = `{${paramName}}`;
        if (description.includes(placeholder)) {
            const replacement = showLabels ? `${paramName} (${formula})` : formula;
            description = description.replace(placeholder, replacement);
        }
    });

    // Remove any unreplaced placeholders (for optional args not provided)
    description = description.replace(/\{[^}]+\}/g, '');

    return description.trim();
}

/**
 * Generates a fallback description for unknown functions.
 * @param functionName - The function name
 * @param argFormulas - Array of argument formula strings
 * @returns A generic description
 */
function generateFallbackDescription(functionName: string, argFormulas: string[]): string {
    if (argFormulas.length === 0) {
        return `Executes the ${functionName} function`;
    }

    const argList = argFormulas.map((arg, i) => `arg${i + 1} (${arg})`).join(", ");
    return `Applies ${functionName} to ${argList}`;
}
