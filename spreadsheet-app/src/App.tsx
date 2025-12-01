import { useState, useCallback, useRef, useMemo } from 'react'
import './App.css'
import Datatable from './components/Datatable';
import type { DatatableHandle } from './components/Datatable';
import FormulaBar from './components/FormulaBar';
import TopBar from './components/TopBar';
import SheetTabs from './components/SheetTabs';
import { HyperFormula, AlwaysSparse } from 'hyperformula';
import ExcelJS from 'exceljs';
import Sidebar from './components/Sidebar';

const options : {licenseKey : string} = {
  licenseKey: 'gpl-v3',
};

const DEFAULT_ROW_COUNT : number = 100;
const DEFAULT_COL_COUNT : number = 26;
const DEFAULT_DATA = Array(DEFAULT_ROW_COUNT).fill('').map(() => Array(DEFAULT_COL_COUNT).fill(''));

function App() {
  const datatableRef = useRef<DatatableHandle>(null);
  
  const hfInstance = useMemo(() => {
    return HyperFormula.buildFromSheets({'Tabelle1': DEFAULT_DATA}, options);
  }, [])

  const [selectedCell, setSelectedCell] = useState<{row: number, col: number} | null>(null);
  const [selectedCellValue, setSelectedCellValue] = useState<string>('');
  const [activeSheetName, setActiveSheetName] = useState<string>('Tabelle1');
  const [sheetsVersion, setSheetsVersion] = useState(0);

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
   * handleSheetChange is triggered when:
   * - User clicks on a sheet tab
   *
   * Switches to the selected sheet and loads its data
   * @param sheetName - name of the sheet to switch to
   */
  const handleSheetChange = useCallback((sheetName: string) => {
    setActiveSheetName(sheetName);
  }, []);

  /**
   * handleImport is triggered when:
   * - User imports an Excel file via the TopBar
   *
   * Loads the imported sheets and displays the first sheet
   * @param importedSheets - Array of sheets with their data
   */
  const handleImport = useCallback((sheetsAsJavascriptArrays: {[key: string]: (any)[][]}) => {
    if (sheetsAsJavascriptArrays) {
      hfInstance.batch(() => {
        // Remove all active Sheets
        const sheetNames = hfInstance.getSheetNames();
        for (const sheetName of sheetNames) {
          const sheetId = hfInstance.getSheetId(sheetName);
          if (sheetId !== undefined) {
            hfInstance.removeSheet(sheetId);
          }
        }

        // Add all new sheets
        for (const [sheetName, sheetData] of Object.entries(sheetsAsJavascriptArrays)) {
          if (hfInstance.isItPossibleToAddSheet(sheetName)) {
            hfInstance.addSheet(sheetName);
            const sheetId = hfInstance.getSheetId(sheetName);
            if (sheetId !== undefined) {
              // TODO: First normalize data ==> first row has to be equal length of longest row
              hfInstance.setSheetContent(sheetId, sheetData);
            }
          }
        }
      });
      // Update states
      setSheetsVersion(prev => prev + 1);
      handleSheetChange(Object.keys(sheetsAsJavascriptArrays)[0]);
    }
  }, [handleSheetChange]);

  return (
    <div className="app-container">
      <TopBar onImport={handleImport} />
      <FormulaBar value={selectedCellValue} onChange={updateSelectedCellValueState} onEnterPress={handleMoveSelectionDown}/>
      <div className="main-container">
        <div className="datatable-container">
          <div className="hottable-wrapper">
            <Datatable 
              onCellSelect={updateSelectionState} 
              hfInstance={hfInstance} 
              activeSheetName={activeSheetName}
              sheetsVersion={sheetsVersion}
              ref={datatableRef}
            />
          </div>
          <SheetTabs
            hfInstance={hfInstance}
            activeSheetId={activeSheetName}
            onSheetChange={handleSheetChange}
          />
        </div>
        <div className="sidebar-container">
          <Sidebar/>
        </div>
      </div>
    </div>
  )
}

export default App
