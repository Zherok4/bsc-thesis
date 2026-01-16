/**
 * Registry of functions that accept a variable number of arguments.
 * These functions allow dropping connections onto the node body to add new arguments.
 */
export const VARIADIC_FUNCTIONS: ReadonlySet<string> = new Set([
    // Math & Aggregation functions
    'SUM',
    'PRODUCT',

    // Statistical functions
    'AVERAGE',
    'COUNT',
    'COUNTA',
    'COUNTBLANK',
    'MAX',
    'MIN',

    // Text functions
    'CONCAT',
    'CONCATENATE',

    // Logical functions
    'AND',
    'OR',
    'XOR',

    // Other variadic functions
    'IFS',
    'CHOOSE',
    'SUBTOTAL',
]);

/**
 * Checks if a function accepts a variable number of arguments.
 * @param functionName - The function name (case-insensitive)
 * @returns true if the function accepts variadic arguments
 */
export function isVariadicFunction(functionName: string): boolean {
    return VARIADIC_FUNCTIONS.has(functionName.toUpperCase());
}
