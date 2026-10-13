import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { ProgressProvider } from './progress'
import { RecordsProvider } from './records'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProgressProvider>
      <RecordsProvider>
        <App />
      </RecordsProvider>
    </ProgressProvider>
  </StrictMode>,
)
