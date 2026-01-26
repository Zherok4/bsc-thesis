import './TopBar.css';
import { useRef, type JSX } from 'react';
import { parseXlsxFile, type ImportResult, type MergeCellSettings, type CellStyle, type SheetStyleData } from '../utils/xlsxParser';
import { TutorialTrigger } from './tutorial';

// Re-export types for backwards compatibility
export type { ImportResult, MergeCellSettings, CellStyle, SheetStyleData };

/**
 * Props for the TopBar component
 */
interface TopBarProps {
    /** Callback invoked when an Excel file is successfully imported */
    onImport: (result: ImportResult) => void;
}

/**
 * Top navigation bar component with file import functionality.
 * Allows users to import Excel files (.xlsx, .xls) into the spreadsheet.
 *
 * @param props - Component props
 * @param props.onImport - Callback to handle imported spreadsheet data
 */
const TopBar = ({ onImport } : TopBarProps): JSX.Element => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const importResult = await parseXlsxFile(file);
            onImport(importResult);
        } catch(error) {
            alert('Failed to import file. Please make sure it is a valid Excel file.');
            console.error('Import error:', error);
        }
    }

    const handleButtonClick = (): void => {
        fileInputRef.current?.click();
    };

    return (
        <div className="top-bar">
            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="top-bar__hidden-input"
            />
            <button
                className="top-bar__import-button"
                onClick={handleButtonClick}
            >
                Import File
            </button>
            <TutorialTrigger />
        </div>
    );
}

export default TopBar;
