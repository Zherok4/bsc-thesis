import { useState } from 'react'
import './App.css'
import Datatable from './components/Datatable';
import FormulaBar from './components/FormulaBar';


function App() {
  const [selectedCellValue, setSelectedCellValue] = useState<any>('');



  return (
    <div className="app-container">
      <FormulaBar value={selectedCellValue}/>
      <div className="datatable-container">
        <Datatable onCellSelect={setSelectedCellValue}/>
      </div>
    </div>
  )
}

export default App
