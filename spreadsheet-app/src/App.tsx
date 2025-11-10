import { useState } from 'react'
import { HyperFormula } from 'hyperformula';
import './App.css'
import Datatable from './components/Datatable';
import FormulaBar from './components/FormulaBar';


function App() {
  const hyperformulaInstance = HyperFormula.buildEmpty({
    licenseKey: 'internal-use-in-handsontable',
  });

  const [selectedCellValue, setSelectedCellValue] = useState<string>('');



  return (
    <div className="app-container">
      <FormulaBar value={selectedCellValue} handleOnChange={setSelectedCellValue}/>
      <div className="datatable-container">
        <Datatable onCellSelect={setSelectedCellValue}/>
      </div>
    </div>
  )
}

export default App
