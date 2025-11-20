import { useState, useCallback } from 'react'
import { HyperFormula } from 'hyperformula';
import './App.css'
import Datatable from './components/Datatable';
import FormulaBar from './components/FormulaBar';


function App() {
  const [selectedCell, setSelectedCell] = useState<{row: number, col: number} | null>(null);
  const [selectedCellValue, setSelectedCellValue] = useState<string>('');

  const handleCellSelect = useCallback((
    value: string,
    row: number,
    col: number,
  ) => {
    setSelectedCellValue(value);
    setSelectedCell({row, col});
  }, []);

  return (
    <div className="app-container">
      <p>row: {String(selectedCell?.row)}, col: {String(selectedCell?.col)}</p>
      <FormulaBar value={selectedCellValue} handleOnChange={setSelectedCellValue}/>
      <div className="datatable-container">
        <Datatable onCellSelect={handleCellSelect}/>
      </div>
    </div>
  )
}

export default App
