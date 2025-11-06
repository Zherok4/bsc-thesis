import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';

import Handsontable from 'handsontable/base';
import { registerAllModules } from 'handsontable/registry';

registerAllModules();

createRoot(document.getElementById('root')!).render(
  // StrictMode temporarily disabled due to Handsontable compatibility issues
  <StrictMode>
    <App />
  </StrictMode>,
)
