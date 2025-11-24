import './SheetTabs.css';

export interface Sheet {
    id: string;
    name: string;
    data: (string | number | null)[][];
}

interface SheetTabsProps {
    sheets: Sheet[];
    activeSheetId: string;
    onSheetChange: (sheetId: string) => void;
}

const SheetTabs = ({ sheets, activeSheetId, onSheetChange }: SheetTabsProps) => {
    return (
        <div className="sheet-tabs">
            <div className="sheet-tabs__container">
                {sheets.map((sheet) => (
                    <button
                        key={sheet.id}
                        className={`sheet-tabs__tab ${sheet.id === activeSheetId ? 'sheet-tabs__tab--active' : ''}`}
                        onClick={() => onSheetChange(sheet.id)}
                    >
                        {sheet.name}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default SheetTabs;
