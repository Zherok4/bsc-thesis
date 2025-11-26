import { useState, useCallback, useRef, useMemo } from 'react'
import './App.css'
import Datatable from './components/Datatable';
import type { DatatableHandle } from './components/Datatable';
import FormulaBar from './components/FormulaBar';
import TopBar from './components/TopBar';
import SheetTabs from './components/SheetTabs';
import type { Sheet } from './components/SheetTabs';
import { HyperFormula } from 'hyperformula';

const options : {licenseKey : string}= {
  licenseKey: 'gpl-v3'
};

const DEFAULT_ROW_COUNT : number = 100;
const DEFAULT_COL_COUNT : number = 26;
const INIT_DATA = Array(DEFAULT_ROW_COUNT).fill('').map(() => Array(DEFAULT_COL_COUNT).fill(''));

function App() {
  const datatableRef = useRef<DatatableHandle>(null);
  
  const hfInstance = useMemo(() => {
    return HyperFormula.buildFromSheets({defaultSheet: INIT_DATA}, options);
  }, [])

  const [selectedCell, setSelectedCell] = useState<{row: number, col: number} | null>(null);
  const [selectedCellValue, setSelectedCellValue] = useState<string>('');
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string>('');

  /**
   * updateSelectionState is triggered if:
   * - cell is selected in the Datatable
   * 
   * Updates both the cell Value and cell Position
   * @param value - the current value of the selected cell
   * @param row - zero-indexed row number of the selected cell
   * @param col - zero-indexed column number of the selected cell
   */
  const updateSelectionState = useCallback((
    value: string,
    row: number,
    col: number,
  ) => {
    setSelectedCellValue(value);
    setSelectedCell({row, col});
  }, []);

  /**
   * updateSelectedCellValueState is triggered if:
   * - FormulaBar component changes
   *
   * @param newValue - the newValue for the selected cell
   */
  const updateSelectedCellValueState = useCallback((
    newValue: string
  ) => {
    setSelectedCellValue(newValue);
    const currentDatatable: DatatableHandle | null = datatableRef.current;
    if (currentDatatable && selectedCell) {
      currentDatatable.updateCell(newValue, selectedCell.row, selectedCell.col);
    }
  }
  , [selectedCell]);

  /**
   * handleMoveSelectionDown is triggered if:
   * - Enter key is pressed in the FormulaBar
   *
   * Moves the cell selection one row down
   */
  const handleMoveSelectionDown = useCallback(() => {
    const currentDatatable: DatatableHandle | null = datatableRef.current;
    if (currentDatatable && selectedCell) {
      currentDatatable.selectCell(selectedCell.row + 1, selectedCell.col);
    }
  }, [selectedCell]);

  /**
   * handleImport is triggered when:
   * - User imports an Excel file via the TopBar
   *
   * Loads the imported sheets and displays the first sheet
   * @param importedSheets - Array of sheets with their data
   */
  // TODO: save / import data into hyperformula Instance
  const handleImport = useCallback((importedSheets: Sheet[]) => {
    const currentDatatable: DatatableHandle | null = datatableRef.current;
    if (currentDatatable && importedSheets.length > 0) {
      setSheets(importedSheets);
      setActiveSheetId(importedSheets[0].id);
      currentDatatable.loadData(importedSheets[0].data);
      setSelectedCell(null);
      setSelectedCellValue('');
    }
  }, []);

  /**
   * handleSheetChange is triggered when:
   * - User clicks on a sheet tab
   *
   * Switches to the selected sheet and loads its data
   * @param sheetId - ID of the sheet to switch to
   */
  const handleSheetChange = useCallback((sheetId: string) => {
    const currentDatatable: DatatableHandle | null = datatableRef.current;
    const sheet : Sheet | undefined = sheets.find(s => s.id === sheetId);
    if (currentDatatable && sheet) {
      setActiveSheetId(sheetId);
      currentDatatable.loadData(sheet.data);
      setSelectedCell(null);
      setSelectedCellValue('');
    }
  }, [sheets]);

  return (
    <div className="app-container">
      <TopBar onImport={handleImport} />
      <FormulaBar value={selectedCellValue} onChange={updateSelectedCellValueState} onEnterPress={handleMoveSelectionDown}/>
      <div className="datatable-container">
        <Datatable onCellSelect={updateSelectionState} hfInstance={hfInstance} ref={datatableRef}/>
        {sheets.length > 0 && (
          <SheetTabs
            sheets={sheets}
            activeSheetId={activeSheetId}
            onSheetChange={handleSheetChange}
          />
        )}
      </div>
    </div>
  )
}

export default App
