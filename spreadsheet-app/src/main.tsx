import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  // StrictMode temporarily disabled due to Handsontable compatibility issues
  <StrictMode>
    <App />
  </StrictMode>,
)
