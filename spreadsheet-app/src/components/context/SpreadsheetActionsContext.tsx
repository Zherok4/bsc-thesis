import React, { createContext, useContext, type ReactNode } from 'react';

/**
 * Callback types for spreadsheet actions from the graph view.
 */
export interface SpreadsheetActionsContextValue {
  /** Set the viewed cell highlight (dotted border) in the spreadsheet */
  setViewedCellHighlight: (row: number, col: number, sheet: string) => void;
  /** Clear the viewed cell highlight */
  clearViewedCellHighlight: () => void;
  /**
   * Callback when a node edit is saved.
   * Receives the new formula and cell position to update.
   */
  onNodeEdit: (newFormula: string, row: number, col: number, sheet: string) => void;
  /** Deselect any selected cells in the spreadsheet (prevents keyboard events from affecting cells) */
  deselectCell: () => void;
}

const SpreadsheetActionsContext = createContext<SpreadsheetActionsContextValue | undefined>(undefined);

export interface SpreadsheetActionsProviderProps {
  /** Set the viewed cell highlight (dotted border) in the spreadsheet */
  setViewedCellHighlight: (row: number, col: number, sheet: string) => void;
  /** Clear the viewed cell highlight */
  clearViewedCellHighlight: () => void;
  /** Callback when a node edit is saved */
  onNodeEdit: (newFormula: string, row: number, col: number, sheet: string) => void;
  /** Deselect any selected cells in the spreadsheet */
  deselectCell: () => void;
  children: ReactNode;
}

/**
 * Provider for spreadsheet action callbacks.
 * Used to pass spreadsheet manipulation functions from App to graph components
 * without prop drilling through Sidebar.
 */
export function SpreadsheetActionsProvider({
  setViewedCellHighlight,
  clearViewedCellHighlight,
  onNodeEdit,
  deselectCell,
  children
}: SpreadsheetActionsProviderProps): React.ReactElement {
  return (
    <SpreadsheetActionsContext.Provider
      value={{ setViewedCellHighlight, clearViewedCellHighlight, onNodeEdit, deselectCell }}
    >
      {children}
    </SpreadsheetActionsContext.Provider>
  );
}

/**
 * Hook to access spreadsheet action callbacks.
 * Must be used within a SpreadsheetActionsProvider.
 */
export function useSpreadsheetActions(): SpreadsheetActionsContextValue {
  const context = useContext(SpreadsheetActionsContext);
  if (context === undefined) {
    throw new Error('useSpreadsheetActions must be used within a SpreadsheetActionsProvider');
  }
  return context;
}

export { SpreadsheetActionsContext };
