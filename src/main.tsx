import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// NOTE: Intentionally no background cleanup jobs.
// We keep all chat/flashcard data permanently, and we already avoid persisting empty chat sessions.

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
