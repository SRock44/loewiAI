import { useRef, useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/Layout'
import Hero from './components/Hero'
import Features from './components/Features'
import Dashboard from './pages/Dashboard'
import './App.css'

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
                       <>
                         <Hero />
                         <Features />
                       </>
                     } />
                     <Route path="/dashboard" element={
                       <Dashboard ref={dashboardRef} onNewSessionCreated={handleNewSessionCreated} />
                     } />
            </Routes>
          </Layout>
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App