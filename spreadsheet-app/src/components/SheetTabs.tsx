import './SheetTabs.css';
import type { JSX } from 'react';
import { HyperFormula } from 'hyperformula';

/**
 * Represents a spreadsheet sheet with its data
 */
export interface Sheet {
    /** Unique identifier for the sheet */
    id: string;
    /** Display name of the sheet */
    name: string;
    /** 2D array of cell values */
    data: (string | number | null)[][];
}

/**
 * Props for the SheetTabs component
 */
interface SheetTabsProps {
    /** HyperFormula instance containing sheet information */
    hfInstance: HyperFormula;
    /** Name of the currently active sheet */
    activeSheetId: string;
    /** Callback invoked when a different sheet tab is selected */
    onSheetChange: (sheetId: string) => void;
}

/**
 * Tab bar component for navigating between spreadsheet sheets.
 * Displays a button for each sheet and highlights the active one.
 *
 * @param props - Component props
 * @param props.hfInstance - HyperFormula instance for sheet data
 * @param props.activeSheetId - Currently active sheet name
 * @param props.onSheetChange - Handler for sheet selection changes
 */
const SheetTabs = ({hfInstance, activeSheetId, onSheetChange }: SheetTabsProps): JSX.Element => {
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
