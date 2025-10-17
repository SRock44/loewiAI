import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Defer non-critical service initialization for better performance
const initializeServices = async () => {
  // Only initialize cleanup services after the app has loaded
  const { automaticCleanupService } = await import('./services/automaticCleanupService');
  await import('./services/cleanupService');
  await import('./services/databaseCleanupService');
  
  // Start automatic cleanup service for 24-hour deletion
  automaticCleanupService.startAutomaticCleanup();
};

// Initialize services after a short delay to prioritize app loading
setTimeout(initializeServices, 1000);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
