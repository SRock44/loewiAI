import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import UserSettings from './UserSettings';
import { Home, ChatSquare, AddSquare, Card, Document } from 'solar-icons';
import FlashcardList from './FlashcardList';
import { useAllFlashcards } from '../hooks/useAllFlashcards';
import { chatService } from '../services/chatService';
import { ChatSession } from '../types/chat';
import './Layout.css';

// Remove the custom ChatHistoryItem interface - we'll use ChatSession directly

// Topic detection utility function
const detectTopicFromFlashcards = (flashcards: any[]): string => {
  if (!flashcards || flashcards.length === 0) {
    return 'General';
  }

  // Collect all categories and tags
  const categories = new Set<string>();
  const tags = new Set<string>();
  const allText = new Set<string>();

  flashcards.forEach((card) => {
    if (card.category) {
      categories.add(card.category.toLowerCase());
    }
    if (card.tags && Array.isArray(card.tags)) {
      card.tags.forEach((tag: string) => tags.add(tag.toLowerCase()));
    }
    // Also analyze question and answer text for keywords
    const questionWords = card.question?.toLowerCase().split(/\s+/) || [];
    const answerWords = card.answer?.toLowerCase().split(/\s+/) || [];
    [...questionWords, ...answerWords].forEach(word => {
      if (word.length > 3) { // Only consider words longer than 3 characters
        allText.add(word);
      }
    });
  });

  // Topic mapping based on keywords - ordered by specificity (most specific first)
  const topicKeywords = {
    'Calculus': ['derivative', 'integral', 'limit', 'calculus', 'differentiation', 'integration', 'chain rule', 'product rule', 'quotient rule', 'trigonometric', 'exponential', 'logarithmic', 'antiderivative', 'definite', 'indefinite', 'continuity', 'asymptote', 'critical point', 'optimization', 'related rates', 'calculus 1', 'calculus 2', 'calculus 3', 'multivariable', 'partial derivative', 'double integral', 'triple integral', 'line integral', 'surface integral', 'gradient', 'divergence', 'curl', 'taylor series', 'power series', 'convergence', 'divergence test', 'ratio test', 'root test', 'comparison test', 'limit comparison test', 'alternating series test', 'integral test', 'p-series test', 'geometric series', 'harmonic series', 'telescoping series', 'radius of convergence', 'interval of convergence', 'absolute convergence', 'conditional convergence', 'parametric equations', 'polar coordinates', 'cylindrical coordinates', 'spherical coordinates', 'jacobian', 'change of variables', 'green theorem', 'stokes theorem', 'divergence theorem', 'fundamental theorem of calculus', 'mean value theorem', 'intermediate value theorem', 'extreme value theorem', 'rolle theorem', 'lhopital rule', 'squeeze theorem', 'epsilon delta', 'riemann sum', 'trapezoidal rule', 'simpson rule', 'midpoint rule', 'left endpoint rule', 'right endpoint rule', 'improper integral', 'infinite series', 'sequence', 'convergent', 'divergent', 'bounded', 'monotonic', 'increasing', 'decreasing', 'concave up', 'concave down', 'inflection point', 'local maximum', 'local minimum', 'global maximum', 'global minimum', 'saddle point', 'critical number', 'first derivative test', 'second derivative test', 'newton method', 'bisection method', 'secant method', 'fixed point iteration', 'euler method', 'runge kutta', 'differential equation', 'separable', 'linear', 'homogeneous', 'nonhomogeneous', 'exact', 'integrating factor', 'bernoulli', 'riccati', 'clairaut', 'lagrange', 'cauchy euler', 'variation of parameters', 'undetermined coefficients', 'laplace transform', 'inverse laplace transform', 'convolution', 'heaviside function', 'dirac delta', 'fourier transform', 'inverse fourier transform', 'discrete fourier transform', 'fast fourier transform', 'z transform', 'inverse z transform', 'partial differential equation', 'heat equation', 'wave equation', 'laplace equation', 'poisson equation', 'helmholtz equation', 'schrodinger equation', 'maxwell equations', 'navier stokes', 'euler equations', 'bernoulli equation', 'continuity equation', 'conservation law', 'boundary condition', 'initial condition', 'dirichlet', 'neumann', 'robin', 'mixed boundary', 'periodic boundary', 'free boundary', 'moving boundary', 'interface', 'shock wave', 'rarefaction wave', 'contact discontinuity', 'entropy condition', 'rankine hugoniot', 'method of characteristics', 'separation of variables', 'eigenvalue', 'eigenfunction', 'sturm liouville', 'orthogonal', 'orthonormal', 'fourier series', 'fourier coefficients', 'parseval theorem', 'bessel function', 'legendre polynomial', 'chebyshev polynomial', 'hermite polynomial', 'laguerre polynomial', 'gamma function', 'beta function', 'zeta function', 'riemann zeta', 'dirichlet eta', 'euler constant', 'euler maclaurin', 'stirling formula', 'wallis formula', 'leibniz formula', 'newton leibniz'],
    'Biology': ['photosynthesis', 'cell', 'dna', 'rna', 'protein', 'enzyme', 'mitosis', 'meiosis', 'evolution', 'genetics', 'organism', 'tissue', 'organ', 'ecosystem', 'biome', 'species', 'taxonomy', 'chloroplast', 'mitochondria', 'nucleus', 'chromosome', 'allele', 'phenotype', 'genotype'],
    'Chemistry': ['molecule', 'atom', 'element', 'compound', 'reaction', 'bond', 'acid', 'base', 'ph', 'oxidation', 'reduction', 'catalyst', 'synthesis', 'decomposition', 'stoichiometry', 'ionic', 'covalent', 'periodic table', 'valence', 'electronegativity', 'molarity'],
    'Physics': ['force', 'energy', 'momentum', 'velocity', 'acceleration', 'gravity', 'electricity', 'magnetism', 'wave', 'quantum', 'thermodynamics', 'mechanics', 'optics', 'relativity', 'newton', 'einstein', 'electromagnetic', 'kinetic', 'potential', 'friction', 'inertia'],
    'Mathematics': ['algebra', 'geometry', 'trigonometry', 'statistics', 'probability', 'matrix', 'vector', 'equation', 'theorem', 'proof', 'fraction', 'decimal', 'percentage', 'polynomial', 'quadratic', 'linear', 'slope', 'intercept', 'parabola', 'hypotenuse'],
    'Computer Science': ['algorithm', 'programming', 'code', 'variable', 'loop', 'array', 'object', 'class', 'method', 'database', 'network', 'software', 'hardware', 'python', 'javascript', 'java', 'c++', 'html', 'css', 'sql', 'api', 'debugging', 'compiler'],
    'History': ['war', 'battle', 'revolution', 'empire', 'kingdom', 'civilization', 'ancient', 'medieval', 'renaissance', 'industrial', 'world war', 'treaty', 'constitution', 'monarchy', 'democracy', 'republic', 'colony', 'independence', 'reformation'],
    'Literature': ['novel', 'poem', 'poetry', 'author', 'character', 'theme', 'symbolism', 'metaphor', 'alliteration', 'rhyme', 'stanza', 'narrative', 'plot', 'shakespeare', 'drama', 'fiction', 'protagonist', 'antagonist', 'setting', 'conflict'],
    'Psychology': ['behavior', 'cognitive', 'memory', 'learning', 'emotion', 'personality', 'consciousness', 'unconscious', 'therapy', 'mental', 'brain', 'neuron', 'psychology', 'behavioral', 'developmental', 'conditioning', 'reinforcement', 'stimulus'],
    'Economics': ['supply', 'demand', 'market', 'price', 'inflation', 'gdp', 'unemployment', 'monetary', 'fiscal', 'trade', 'investment', 'capital', 'profit', 'macroeconomics', 'microeconomics', 'economy', 'recession', 'depression', 'monopoly']
  };

  // Score-based topic detection to avoid conflicts
  const topicScores: { [key: string]: number } = {};

  // Check categories first (highest weight)
  for (const category of categories) {
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      for (const keyword of keywords) {
        if (category.includes(keyword)) {
          topicScores[topic] = (topicScores[topic] || 0) + 10; // High weight for categories
        }
      }
    }
  }

  // Check tags (medium weight)
  for (const tag of tags) {
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      for (const keyword of keywords) {
        if (tag.includes(keyword)) {
          topicScores[topic] = (topicScores[topic] || 0) + 5; // Medium weight for tags
        }
      }
    }
  }

  // Check text content (lower weight)
  for (const text of allText) {
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          topicScores[topic] = (topicScores[topic] || 0) + 1; // Lower weight for text
        }
      }
    }
  }

  // Return the topic with the highest score
  const sortedTopics = Object.entries(topicScores).sort((a, b) => b[1] - a[1]);
  if (sortedTopics.length > 0 && sortedTopics[0][1] > 0) {
    const winningTopic = sortedTopics[0][0];
    return winningTopic;
  }

  // If no specific topic found, try to infer from categories
  if (categories.size > 0) {
    const categoryArray = Array.from(categories);
    // Capitalize first letter of the first category
    const inferredTopic = categoryArray[0].charAt(0).toUpperCase() + categoryArray[0].slice(1);
    return inferredTopic;
  }

  return 'General';
};

interface LayoutProps {
  children: React.ReactNode;
  onCreateNewChat?: () => void;
  onChatSelect?: (chatId: string) => void;
  currentChatId?: string;
}

const Layout: React.FC<LayoutProps> = ({ children, onCreateNewChat, onChatSelect, currentChatId }) => {
  const location = useLocation();
  const { isAuthenticated, user, signInWithGoogle, signOut, isLoading } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [showFlashcardList, setShowFlashcardList] = useState(false);
  const [showIndividualFlashcard, setShowIndividualFlashcard] = useState(false);
  const [currentFlashcardSet, setCurrentFlashcardSet] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [flashcardToDelete, setFlashcardToDelete] = useState<any>(null);
  const [isGridScrollable, setIsGridScrollable] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  
  // Use custom hooks for efficient state management
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const { flashcardSets, updateFlashcardSet, removeFlashcardSet } = useAllFlashcards();
  
  // Wrapper function to update both global flashcard sets and current flashcard set
  const handleFlashcardSetUpdate = (updatedSet: any) => {
    // Update the global flashcard sets
    updateFlashcardSet(updatedSet);
    
    // Update the current flashcard set if it's the same set
    if (currentFlashcardSet && currentFlashcardSet.id === updatedSet.id) {
      setCurrentFlashcardSet(updatedSet);
    }
  };
  
  // Load chat sessions
  useEffect(() => {
    if (isAuthenticated) {
      const sessions = chatService.getSessions();
      setChatSessions(sessions);
    } else {
      setChatSessions([]);
    }
  }, [isAuthenticated]);

  // Check if flashcard grid is scrollable
  useEffect(() => {
    const checkScrollable = () => {
      if (gridRef.current) {
        const isScrollable = gridRef.current.scrollHeight > gridRef.current.clientHeight;
        setIsGridScrollable(isScrollable);
      }
    };

    checkScrollable();
    
    // Check again when flashcard sets change
    const timer = setTimeout(checkScrollable, 100);
    
    return () => clearTimeout(timer);
  }, [flashcardSets]);

  // Listen for session updates (when new chats are created)
  useEffect(() => {
    const handleStorageChange = () => {
      if (isAuthenticated) {
        const sessions = chatService.getSessions();
        setChatSessions(sessions);
      }
    };

    // Listen for localStorage changes (where chat sessions are stored)
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom events if the chat service dispatches them
    const handleSessionUpdate = () => {
      if (isAuthenticated) {
        const sessions = chatService.getSessions();
        setChatSessions(sessions);
      }
    };
    
    window.addEventListener('sessionUpdated', handleSessionUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('sessionUpdated', handleSessionUpdate);
    };
  }, [isAuthenticated]);

  const handleChatSelect = (chatId: string) => {
    if (onChatSelect) {
      onChatSelect(chatId);
    }
  };

  const handleDeleteFlashcard = (flashcardSet: any, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent opening the flashcard set
    setFlashcardToDelete(flashcardSet);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (flashcardToDelete) {
      removeFlashcardSet(flashcardToDelete.id);
      setShowDeleteConfirm(false);
      setFlashcardToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setFlashcardToDelete(null);
  };


  const navigationItems = [
    { 
      path: '/', 
      label: 'Home', 
      icon: <Home size={20} />
    },
    { 
      path: '/dashboard', 
      label: 'Chat', 
      icon: <ChatSquare size={20} />
    },
  ];

  return (
    <div className="layout">
      {/* Left Sidebar */}
      <aside className="sidebar">
        <nav className="sidebar-nav">
          {!isAuthenticated && (
            <div className="sign-in-section">
              <button
                className="sidebar-sign-in-btn"
                onClick={() => {
                  console.log('Sign in button clicked');
                  signInWithGoogle().catch(error => {
                    console.error('Sign in error:', error);
                  });
                }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="spinner"></div>
                ) : (
                  <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
              </button>
            </div>
          )}
          {navigationItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
            </Link>
          ))}
          
          {/* New Chat button - only show on chat page */}
          {location.pathname === '/dashboard' && onCreateNewChat && (
            <button
              className="nav-item new-chat-nav-btn"
              onClick={onCreateNewChat}
              title="New Chat"
            >
              <span className="nav-icon">
                <AddSquare size={16} />
              </span>
            </button>
          )}
          
          {/* Chat History Section - only show when chats exist */}
          {location.pathname === '/dashboard' && chatSessions.length > 0 && (
            <div className="chat-history-section">
              {chatSessions.slice(0, 10).map((session, index) => {
                const firstMessage = session.messages.find(m => m.role === 'user');
                const summary = firstMessage ? `Chat about: ${firstMessage.content.substring(0, 100)}${firstMessage.content.length > 100 ? '...' : ''}` : 'New conversation';
                
                return (
                  <button
                    key={session.id}
                    className={`nav-item chat-history-item ${currentChatId === session.id ? 'active' : ''}`}
                    onClick={() => handleChatSelect(session.id)}
                    title={summary}
                  >
                    <span className="nav-icon chat-number">
                      {index + 1}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          
          {/* Flashcard Button */}
          {location.pathname === '/dashboard' && (
            <div>
              <button
                className="nav-item flashcard-nav-btn"
                onClick={() => setShowFlashcardList(true)}
                title={flashcardSets.length > 0 ? `View your flashcard sets (${flashcardSets.length})` : "No flashcards yet - click to create some"}
              >
                <span className="nav-icon">
                  {flashcardSets.length > 0 ? <Card size={16} /> : <Document size={16} />}
                </span>
              </button>
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          {isAuthenticated && (
            <button 
              className="profile-icon-only"
              onClick={() => setShowSettings(true)}
              title="User Settings"
            >
              <div className="user-profile-icon">
              </div>
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {children}
      </main>

      {/* User Settings Modal */}
      <UserSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSignOut={signOut}
      />

      {/* Flashcard Modal */}
      {showFlashcardList && (
        <div className="flashcard-list-overlay">
          <div className="flashcard-list-modal">
            <button 
              className="floating-close-btn" 
              onClick={() => setShowFlashcardList(false)}
            >
              ✕
            </button>
            <div className="flashcard-list-content">
              {flashcardSets.length === 0 ? (
                <div className="no-flashcards">
                  <h3>No Flashcards Yet</h3>
                  <p>Generate some flashcards by asking Newton 1.0 to create them from your documents or text!</p>
                </div>
              ) : (
                <div className="flashcard-selection">
                  <h3>Select Flashcard Set</h3>
                  <div 
                    ref={gridRef}
                    className={`flashcard-sets-grid ${isGridScrollable ? 'scrollable' : ''}`}
                  >
                    {flashcardSets.map((set) => (
                      <div key={set.id} className="flashcard-set-card-container">
                        <button
                          className="flashcard-set-card"
                          onClick={() => {
                            setCurrentFlashcardSet(set);
                            setShowFlashcardList(false);
                            setShowIndividualFlashcard(true);
                          }}
                        >
                          <div className="set-stats">
                            <span>{set.flashcards.length} cards</span>
                            <span>{detectTopicFromFlashcards(set.flashcards)}</span>
                          </div>
                        </button>
                        <button
                          className="delete-flashcard-btn"
                          onClick={(e) => handleDeleteFlashcard(set, e)}
                          title="Delete flashcard set"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Individual Flashcard Modal */}
      {showIndividualFlashcard && currentFlashcardSet && (
        <div className="flashcard-list-overlay">
          <div className="flashcard-list-modal">
            <button 
              className="back-arrow-btn" 
              onClick={() => {
                setShowIndividualFlashcard(false);
                setShowFlashcardList(true);
              }}
              title="Back to flashcard history"
            >
              ←
            </button>
            <button 
              className="floating-close-btn" 
              onClick={() => setShowIndividualFlashcard(false)}
            >
              ✕
            </button>
            <div className="flashcard-list-content">
              <FlashcardList
                flashcardSet={currentFlashcardSet}
                onSetUpdate={handleFlashcardSetUpdate}
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="delete-confirm-overlay">
          <div className="delete-confirm-modal">
            <h3>Delete Flashcard Set</h3>
            <p>Are you sure you want to delete <strong>"{flashcardToDelete?.title}"</strong>?</p>
            <p className="warning-text">This action cannot be undone.</p>
            <div className="delete-confirm-actions">
              <button className="cancel-btn" onClick={cancelDelete}>
                Cancel
              </button>
              <button className="delete-btn" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
