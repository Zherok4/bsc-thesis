import './SheetTabs.css';
import { HyperFormula } from 'hyperformula';

export interface Sheet {
    id: string;
    name: string;
    data: (string | number | null)[][];
}

interface SheetTabsProps {
    hfInstance: HyperFormula;
    activeSheetId: string;
    onSheetChange: (sheetId: string) => void;
}

const SheetTabs = ({hfInstance, activeSheetId, onSheetChange }: SheetTabsProps) => {
    return (
        <div className="sheet-tabs">
            <div className="sheet-tabs__container">
                {(hfInstance.getSheetNames()).map((sheetName) => (
                    <button
                        key={hfInstance.getSheetId(sheetName)}
                        className={`sheet-tabs__tab ${sheetName === activeSheetId ? 'sheet-tabs__tab--active' : ''}`}
                        onClick={() => onSheetChange(sheetName)}
                    >
                        {sheetName}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default SheetTabs;
