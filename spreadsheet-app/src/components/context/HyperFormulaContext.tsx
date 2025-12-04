import { createContext, useContext, type ReactNode } from 'react';
import type { HyperFormula } from 'hyperformula';

export interface HyperFormulaContextValue {
  hfInstance: HyperFormula;
  activeSheetName: string;
}

const HyperFormulaContext = createContext<HyperFormulaContextValue | undefined>(undefined);

export interface HyperFormulaProviderProps {
  hfInstance: HyperFormula;
  activeSheetName: string;
  children: ReactNode;
}

export function HyperFormulaProvider({
  hfInstance,
  activeSheetName,
  children
}: HyperFormulaProviderProps) {
  return (
    <HyperFormulaContext.Provider value={{ hfInstance, activeSheetName }}>
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
