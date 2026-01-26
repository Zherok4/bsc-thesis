import { parseXlsxArrayBuffer, type ImportResult } from '../utils/xlsxParser';

/**
 * Path to the tutorial spreadsheet in the public folder
 */
const TUTORIAL_SPREADSHEET_PATH = '/tutorial-spreadsheet.xlsx';

/**
 * Loads the bundled tutorial spreadsheet and parses it into ImportResult format.
 * @returns Promise resolving to the parsed spreadsheet data
 * @throws Error if the spreadsheet cannot be loaded or parsed
 */
export async function loadTutorialSpreadsheet(): Promise<ImportResult> {
    const response = await fetch(TUTORIAL_SPREADSHEET_PATH);

    if (!response.ok) {
        throw new Error(`Failed to load tutorial spreadsheet: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return parseXlsxArrayBuffer(arrayBuffer);
}
