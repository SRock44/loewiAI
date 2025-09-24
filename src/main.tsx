import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './services/cleanupService' // Initialize cleanup service
import './services/databaseCleanupService' // Initialize database cleanup service
import { automaticCleanupService } from './services/automaticCleanupService' // Initialize automatic cleanup

// Start automatic cleanup service for 24-hour deletion
automaticCleanupService.startAutomaticCleanup();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
