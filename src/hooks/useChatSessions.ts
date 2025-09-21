import { useState, useEffect, useCallback } from 'react';
import { ChatSession } from '../types/chat';
import { chatService } from '../services/chatService';
import { authService } from '../services/authService';

// Custom event for session updates
class SessionUpdateEvent extends Event {
  constructor(public sessions: ChatSession[]) {
    super('sessionUpdate');
  }
}

// Global event dispatcher
const sessionEventTarget = new EventTarget();

export const useChatSessions = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load sessions from chat service
  const loadSessions = useCallback(() => {
    const user = authService.getCurrentUser();
    if (!user) {
      setSessions([]);
      return;
    }
    
    setIsLoading(true);
    try {
      const chatSessions = chatService.getSessions();
      setSessions(chatSessions);
      
      // Dispatch event to notify other components
      sessionEventTarget.dispatchEvent(new SessionUpdateEvent(chatSessions));
    } catch (error) {
      console.error('Error loading chat sessions:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Listen for session update events
  useEffect(() => {
    const handleSessionUpdate = (event: Event) => {
      const sessionEvent = event as SessionUpdateEvent;
      setSessions(sessionEvent.sessions);
    };

    sessionEventTarget.addEventListener('sessionUpdate', handleSessionUpdate);
    
    return () => {
      sessionEventTarget.removeEventListener('sessionUpdate', handleSessionUpdate);
    };
  }, []);

  return {
    sessions,
    isLoading,
    refreshSessions: loadSessions
  };
};

// Export the event dispatcher for use in other components
export { sessionEventTarget };
