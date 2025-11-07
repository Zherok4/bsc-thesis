import './App.css'
import Datatable from './components/Datatable';
import FormulaBar from './components/FormulaBar';

function App() {
  return (
    <div className="app-container">
      <FormulaBar />
      <div className="datatable-container">
        <Datatable />
      </div>
    </div>
  )
}

export default App
