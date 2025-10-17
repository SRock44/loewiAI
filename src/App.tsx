import { useRef, useState, Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/Layout'
import './App.css'

// Lazy load components for better performance
const Hero = lazy(() => import('./components/Hero'))
const Features = lazy(() => import('./components/Features'))
const Dashboard = lazy(() => import('./pages/Dashboard'))

function App() {
  const dashboardRef = useRef<{ createNewChat: () => void; switchToChat: (chatId: string) => void }>(null);
  const [currentChatId, setCurrentChatId] = useState<string | undefined>();

  const handleCreateNewChat = () => {
    if (dashboardRef.current?.createNewChat) {
      dashboardRef.current.createNewChat();
      // Clear current chat ID when creating a new chat
      setCurrentChatId(undefined);
    }
  };

  const handleNewSessionCreated = (session: any) => {
    setCurrentChatId(session.id);
  };

  const handleChatSelect = (chatId: string) => {
    setCurrentChatId(chatId);
    if (dashboardRef.current?.switchToChat) {
      dashboardRef.current.switchToChat(chatId);
    }
  };

  const handleChatDelete = (chatId: string) => {
    // If the deleted chat was the current chat, create a new chat
    if (currentChatId === chatId) {
      setCurrentChatId(undefined);
      // Create a new chat to replace the deleted one
      if (dashboardRef.current?.createNewChat) {
        dashboardRef.current.createNewChat();
      }
    }
  };

  // No need for handleAddChatToHistory - we use the actual chat service

  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Layout 
            onCreateNewChat={handleCreateNewChat}
            onChatSelect={handleChatSelect}
            onChatDelete={handleChatDelete}
            currentChatId={currentChatId}
          >
            <Routes>
                     <Route path="/" element={
                       <Suspense fallback={<div className="loading-spinner">Loading...</div>}>
                         <Hero />
                         <Features />
                       </Suspense>
                     } />
                     <Route path="/dashboard" element={
                       <Suspense fallback={<div className="loading-spinner">Loading Dashboard...</div>}>
                         <Dashboard ref={dashboardRef} onNewSessionCreated={handleNewSessionCreated} />
                       </Suspense>
                     } />
            </Routes>
          </Layout>
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App