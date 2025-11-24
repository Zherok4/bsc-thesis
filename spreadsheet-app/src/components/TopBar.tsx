import './TopBar.css';
import { useRef } from 'react';
import * as XLSX from 'xlsx';
import type { Sheet } from './SheetTabs';

interface TopBarProps {
    onImport: (sheets: Sheet[]) => void;
}

const TopBar = ({ onImport } : TopBarProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, {cellFormula: true});

            // Extract all sheets
            const sheets: Sheet[] = workbook.SheetNames.map((sheetName, index) => {
                const worksheet = workbook.Sheets[sheetName];

                // Extract formulas and values from cells
                const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
                const data: (string | number | null)[][] = [];

                for (let row = range.s.r; row <= range.e.r; row++) {
                    const rowData: (string | number | null)[] = [];
                    for (let col = range.s.c; col <= range.e.c; col++) {
                        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
                        const cell = worksheet[cellAddress];

                        if (!cell) {
                            // Empty cell
                            rowData.push(null);
                        } else if (cell.f) {
                            // Cell contains a formula - prepend = for Handsontable
                            rowData.push('=' + cell.f);
                        } else {
                            // Regular value
                            rowData.push(cell.v ?? null);
                        }
                    }
                    data.push(rowData);
                }

                return {
                    id: `sheet-${index}`,
                    name: sheetName,
                    data
                };
            });

            onImport(sheets);

            // Reset file input to allow re-importing the same file
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } catch (error) {
            alert('Failed to import file. Please make sure it is a valid Excel file.');
            console.error('Import error:', error);
        }
    };

    const handleButtonClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="top-bar">
            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                style={{ display: 'none' }}
            />
            <button
                className="top-bar__import-button"
                onClick={handleButtonClick}
            >
                Import File
            </button>
        </div>
    );
}

export default TopBar;
