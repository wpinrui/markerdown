import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { NewNoteWindow } from './components/NewNoteWindow'
import './new-note-styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NewNoteWindow />
  </StrictMode>
)
