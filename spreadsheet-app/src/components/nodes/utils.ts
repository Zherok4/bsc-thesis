/**
 * Checks if a string represents a valid number (not just starts with one).
 * E.g., "123" -> true, "123abc" -> false, "1.5e10" -> true
 */
function isNumericString(value: string): boolean {
    const trimmed = value.trim();
    if (trimmed === '') return false;
    return !isNaN(Number(trimmed)) && isFinite(Number(trimmed));
}

/**
 * Abbreviates large numbers and truncates long decimals for compact display.
 * E.g., 200000 -> "200K", 1500000 -> "1.5M", 3.141592653 -> "3.14"
 * Only processes pure numeric strings - text values pass through unchanged.
 * @param value - The string representation of a number
 * @param maxDecimals - Maximum decimal places for small numbers (default: 2)
 * @returns The abbreviated string or original value if not a pure number
 */
export function abbreviateNumber(value: string, maxDecimals: number = 2): string {
    if (!isNumericString(value)) return value;

    const num = parseFloat(value);

    const absNum = Math.abs(num);
    const sign = num < 0 ? "-" : "";

    if (absNum >= 1_000_000_000) {
        const abbreviated = absNum / 1_000_000_000;
        return sign + (abbreviated % 1 === 0 ? abbreviated.toFixed(0) : abbreviated.toFixed(1)) + "B";
    }
    if (absNum >= 1_000_000) {
        const abbreviated = absNum / 1_000_000;
        return sign + (abbreviated % 1 === 0 ? abbreviated.toFixed(0) : abbreviated.toFixed(1)) + "M";
    }
    if (absNum >= 10_000) {
        const abbreviated = absNum / 1_000;
        return sign + (abbreviated % 1 === 0 ? abbreviated.toFixed(0) : abbreviated.toFixed(1)) + "K";
    }

    // Truncate long decimals for smaller numbers
    const decimalIndex = value.indexOf('.');
    if (decimalIndex !== -1 && value.length - decimalIndex - 1 > maxDecimals) {
        // Use toFixed to round properly, then remove trailing zeros
        const rounded = num.toFixed(maxDecimals);
        return rounded.replace(/\.?0+$/, '');
    }

    return value;
}

/**
 * Truncates a string in the middle if it exceeds maxLength.
 * E.g., "LongSheetName" with maxLength 8 -> "Lon..ame"
 * @param str - The string to truncate
 * @param maxLength - Maximum length before truncation (default: 8)
 * @returns The truncated string with ".." in the middle if needed
 */
export function truncateMiddle(str: string, maxLength: number = 8): string {
    if (str.length <= maxLength) return str;

    const keepChars = maxLength - 2; // subtract 2 for ".."
    const startChars = Math.ceil(keepChars / 2);
    const endChars = Math.floor(keepChars / 2);

    return str.slice(0, startChars) + ".." + str.slice(-endChars);
}
