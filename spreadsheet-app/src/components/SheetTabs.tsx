import './SheetTabs.css';
import type { JSX } from 'react';
import { HyperFormula } from 'hyperformula';
import { getSheetColors } from '../utils/sheetColors';
import Minimap from './Minimap';
import type { ViewportInfo } from './Datatable';

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
    /** Current viewport information for the minimap */
    viewportInfo?: ViewportInfo | null;
    /** Whether the minimap should be visible (during scrolling) */
    isScrolling?: boolean;
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
const SheetTabs = ({
    hfInstance,
    activeSheetId,
    onSheetChange,
    viewportInfo = null,
    isScrolling = false
}: SheetTabsProps): JSX.Element => {
    return (
        <div className="sheet-tabs">
            <div className="sheet-tabs__container">
                {(hfInstance.getSheetNames()).map((sheetName) => {
                    const sheetId = hfInstance.getSheetId(sheetName) ?? 0;
                    const { accent } = getSheetColors(sheetId);
                    return (
                        <button
                            key={sheetId}
                            className={`sheet-tabs__tab ${sheetName === activeSheetId ? 'sheet-tabs__tab--active' : ''}`}
                            onClick={() => onSheetChange(sheetName)}
                        >
                            <span
                                className="sheet-tabs__color-bar"
                                style={{ backgroundColor: accent }}
                            />
                            {sheetName}
                        </button>
                    );
                })}
            </div>
            <Minimap viewport={viewportInfo} visible={isScrolling} />
        </div>
    );
};

export default SheetTabs;
