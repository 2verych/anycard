import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import './index.css'
import App from './App.jsx'
import { LocalizationProvider } from './localization'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LocalizationProvider>
      <DndProvider backend={HTML5Backend}>
        <App />
      </DndProvider>
    </LocalizationProvider>
  </StrictMode>,
)
