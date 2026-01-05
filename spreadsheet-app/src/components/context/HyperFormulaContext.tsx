import React, { createContext, useContext, type ReactNode } from 'react';
import type { HyperFormula } from 'hyperformula';


/**
 * Represents a range selection in the spreadsheet.
 */
export interface SelectedRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

// TODO: make a uniform handler
export interface HyperFormulaContextValue {
  hfInstance: HyperFormula;
  activeSheetName: string;
  selectedCell: {row: number, col: number} | null;
  selectedRange: SelectedRange | null;
  scrollToCell: (row: number, col: number, sheet?: string) => void;
  highlightCells: (startRow: number, startCol: number, endRow: number, endCol: number, sheet?: string) => void;
  clearHighlight: () => void;
}

const HyperFormulaContext = createContext<HyperFormulaContextValue | undefined>(undefined);

export interface HyperFormulaProviderProps {
  hfInstance: HyperFormula;
  activeSheetName: string;
  selectedCell: {row: number, col: number} | null;
  selectedRange: SelectedRange | null;
  scrollToCell: (row: number, col: number, sheet?: string) => void;
  highlightCells: (startRow: number, startCol: number, endRow: number, endCol: number, sheet?: string) => void;
  clearHighlight: () => void;
  children: ReactNode;
}

export function HyperFormulaProvider({
  hfInstance,
  activeSheetName,
  selectedCell,
  selectedRange,
  scrollToCell,
  highlightCells,
  clearHighlight,
  children
}: HyperFormulaProviderProps): React.ReactElement {
  return (
    <HyperFormulaContext.Provider
      value={{ hfInstance, activeSheetName, selectedCell, selectedRange, scrollToCell, highlightCells, clearHighlight }}
    >
      {children}
    </HyperFormulaContext.Provider>
  );
}

export function useHyperFormula(): HyperFormulaContextValue {
  const context = useContext(HyperFormulaContext);
  if (context === undefined) {
    throw new Error('useHyperFormula must be used within a HyperFormulaProvider');
  }
  return context;
}

export { HyperFormulaContext };
