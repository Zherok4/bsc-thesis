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
