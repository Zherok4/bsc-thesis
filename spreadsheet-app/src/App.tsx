import { useState, useCallback, useRef, useMemo } from 'react'
import './App.css'
import Datatable from './components/Datatable';
import type { DatatableHandle } from './components/Datatable';
import FormulaBar from './components/FormulaBar';
import TopBar from './components/TopBar';
import type { ImportResult, MergeCellSettings } from './components/TopBar';
import SheetTabs from './components/SheetTabs';
import { HyperFormula } from 'hyperformula';
import Sidebar from './components/Sidebar';
import type { FormulaNode } from './parser';
import { parseFormula } from './parser';
import type { SelectedRange } from './components/context/HyperFormulaContext';

const options : {licenseKey : string, useArrayArithmetic: boolean} = {
  licenseKey: 'gpl-v3',
  useArrayArithmetic: true,
};



const DEFAULT_ROW_COUNT : number = 100;
const DEFAULT_COL_COUNT : number = 26;
const DEFAULT_DATA = Array(DEFAULT_ROW_COUNT).fill('').map(() => Array(DEFAULT_COL_COUNT).fill(''));

function isFormula(text: string) : boolean {
  return typeof text === 'string' && text.trim().startsWith('=')
}

function App() {
  const datatableRef = useRef<DatatableHandle>(null);
  
  const hfInstance = useMemo(() => {
    return HyperFormula.buildFromSheets({'Tabelle1': DEFAULT_DATA}, options);
  }, []);

  const [selectedCell, setSelectedCell] = useState<{row: number, col: number} | null>(null);
  const [selectedRange, setSelectedRange] = useState<SelectedRange | null>(null);
  const [selectedCellValue, setSelectedCellValue] = useState<string>('');
  const [activeSheetName, setActiveSheetName] = useState<string>('Tabelle1');
  const [sheetsVersion, setSheetsVersion] = useState(0);
  const [sheetMergeData, setSheetMergeData] = useState<{ [key: string]: MergeCellSettings[] }>({});


  const selectedCellValueAST: FormulaNode | undefined = useMemo(() => {
    // TODO: prevent unnecessary parsing when in editing mode =>
    if (isFormula(selectedCellValue)) {
      try {
        const ast: FormulaNode = parseFormula(selectedCellValue);
        console.log(ast);
        return ast;  
      } catch (error) {
        console.log(error)
        return undefined;
      }
    }
  }, [selectedCellValue]);

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
    const currentDatatable = datatableRef.current;
    if (currentDatatable) {
      currentDatatable.clearHighlight();
    }
  }, []);

  /**
   * updateRangeSelection is triggered when a range is selected in the Datatable.
   * Includes single cell selection as a 1x1 range.
   */
  const updateRangeSelection = useCallback((
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
  ) => {
    setSelectedRange({ startRow, startCol, endRow, endCol });
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
    // Clear selection to prevent accessing non-existent cells on the new sheet
    setSelectedCell(null);
    setSelectedCellValue('');
  }, []);

  /** scrollToCell is triggered if:
   *  - user clicks on a cell reference node
   *  - user click on a range reference node
   * 
   *  moves the viewport of the handsontable spreadsheet to the corresponding cell
   */
  const scrollToCell = useCallback((row: number, col: number, sheet?: string) => {
    if (sheet !== undefined) {
      handleSheetChange(sheet);
    }
    datatableRef.current?.scrollToCell(row, col);
  }, [handleSheetChange]);

  /** highlightCells assumes that the highlight should be in the activeSheet */
  const highlightCells = useCallback((startRow: number, startCol: number, endRow: number, endCol: number, sheet?: string) => {
    const currentDatatable = datatableRef.current;

    if (currentDatatable) {
      currentDatatable.highlightCells(startRow, startCol, endRow, endCol, sheet);
    }
  }, []);

  const handleClearHighlight = useCallback(() => {
    const currentDatatable = datatableRef.current;

    if (currentDatatable) {
      currentDatatable.clearHighlight();
    }
  }, []);

  /** Set the viewed cell highlight (dotted border) for the cell currently displayed in the graph */
  const setViewedCellHighlight = useCallback((row: number, col: number, sheet: string) => {
    const currentDatatable = datatableRef.current;
    if (currentDatatable) {
      currentDatatable.setViewedCellHighlight(row, col, sheet);
    }
  }, []);

  /** Clear the viewed cell highlight */
  const clearViewedCellHighlight = useCallback(() => {
    const currentDatatable = datatableRef.current;
    if (currentDatatable) {
      currentDatatable.clearViewedCellHighlight();
    }
  }, []);

  /**
   * Handles node edits from the graph view.
   * Updates the cell with the new formula and refreshes the state.
   * @param newFormula - The new formula string to set
   * @param row - The row of the cell to update
   * @param col - The column of the cell to update
   * @param sheet - The sheet containing the cell to update
   */
  const handleNodeEdit = useCallback((newFormula: string, row: number, col: number, sheet: string) => {
    // Switch to the target sheet if different from current
    if (sheet !== activeSheetName) {
      handleSheetChange(sheet);
    }

    const currentDatatable = datatableRef.current;
    if (currentDatatable) {
      currentDatatable.updateCell(newFormula, row, col);
    }

    // Update selected cell value if the edited cell is currently selected
    if (selectedCell && selectedCell.row === row && selectedCell.col === col && sheet === activeSheetName) {
      setSelectedCellValue(newFormula);
    }
  }, [activeSheetName, handleSheetChange, selectedCell]);

  /**
   * handleImport is triggered when:
   * - User imports an Excel file via the TopBar
   *
   * Loads the imported sheets and displays the first sheet
   * @param result - Import result containing sheet data and merge information
   */
  const handleImport = useCallback((result: ImportResult) => {
    const { sheetData, mergeData } = result;
    if (sheetData) {
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
        for (const [sheetName, data] of Object.entries(sheetData)) {
          if (hfInstance.isItPossibleToAddSheet(sheetName)) {
            hfInstance.addSheet(sheetName);
            const sheetId = hfInstance.getSheetId(sheetName);
            if (sheetId !== undefined) {
              // TODO: First normalize data ==> first row has to be equal length of longest row
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              hfInstance.setSheetContent(sheetId, data as any);
            }
          }
        }
      });
      // Update states
      setSheetMergeData(mergeData);
      setSheetsVersion(prev => prev + 1);
      handleSheetChange(Object.keys(sheetData)[0]);
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
              onRangeSelect={updateRangeSelection}
              hfInstance={hfInstance}
              activeSheetName={activeSheetName}
              sheetsVersion={sheetsVersion}
              sheetMergeData={sheetMergeData}
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
          <Sidebar
            ast={selectedCellValueAST}
            hfInstance={hfInstance}
            activeSheetName={activeSheetName}
            selectedCell={selectedCell}
            selectedRange={selectedRange}
            scrollToCell={scrollToCell}
            highlightCells={highlightCells}
            clearHighlight={handleClearHighlight}
            setViewedCellHighlight={setViewedCellHighlight}
            clearViewedCellHighlight={clearViewedCellHighlight}
            onNodeEdit={handleNodeEdit}
          />
        </div>
      </div>
    </div>
  )
}

export default App
