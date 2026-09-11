import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './autonomy-safety-gate.js'
import App from './App.jsx'
import './prototype-dashboard.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
