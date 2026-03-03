import { useRef, useState, Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/Layout'
import { ChatSession } from './types/chat'
import './App.css'

// lazy load components for better performance - these only load when needed
// this makes the initial page load faster since we don't bundle everything upfront
const Hero = lazy(() => import('./components/Hero'))
const Features = lazy(() => import('./components/Features'))
const Dashboard = lazy(() => import('./pages/Dashboard'))

function App() {
  // this ref lets us call methods on the dashboard from the layout component
  // like when user clicks "new chat" in the sidebar, we need to tell dashboard to create one
  const dashboardRef = useRef<{ createNewChat: () => void; switchToChat: (chatId: string) => void }>(null);
  // track which chat session is currently active so we can highlight it in the sidebar
  const [currentChatId, setCurrentChatId] = useState<string | undefined>();

  // when user clicks "new chat" button in the sidebar
  const handleCreateNewChat = () => {
    if (dashboardRef.current?.createNewChat) {
      dashboardRef.current.createNewChat();
      // clear current chat id when creating a new chat so sidebar doesn't highlight old one
      setCurrentChatId(undefined);
    }
  };

  // callback when a new chat session gets created - we track it so sidebar can highlight it
  const handleNewSessionCreated = (session: ChatSession) => {
    setCurrentChatId(session.id);
  };

  // when user clicks on a chat in the sidebar to switch to it
  const handleChatSelect = (chatId: string) => {
    setCurrentChatId(chatId);
    if (dashboardRef.current?.switchToChat) {
      dashboardRef.current.switchToChat(chatId);
    }
  };

  // when user deletes a chat - if it was the current one, we need to create a new empty chat
  // otherwise user would be stuck with no chat open
  const handleChatDelete = (chatId: string) => {
    if (currentChatId === chatId) {
      setCurrentChatId(undefined);
      // create a new chat to replace the deleted one so user always has a chat open
      if (dashboardRef.current?.createNewChat) {
        dashboardRef.current.createNewChat();
      }
    }
  };

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