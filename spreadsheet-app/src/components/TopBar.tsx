import './TopBar.css';
import { useRef } from 'react';
import * as XLSX from 'xlsx';

interface TopBarProps {
    onImport: (data: (string | number | null)[][]) => void;
}

const TopBar = ({ onImport }: TopBarProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer);
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const data = XLSX.utils.sheet_to_json(worksheet, {
                header: 1,
                raw: true,
                defval: null
            }) as (string | number | null)[][];

            onImport(data);

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
