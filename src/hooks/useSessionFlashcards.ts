import { useState, useEffect, useCallback } from 'react';
import { FlashcardSet } from '../types/flashcard';

// Custom event for flashcard updates
class FlashcardUpdateEvent extends Event {
  constructor(public sessionId: string, public flashcardSets: FlashcardSet[]) {
    super('flashcardUpdate');
  }
}

// Global event dispatcher
const flashcardEventTarget = new EventTarget();

export const useSessionFlashcards = (sessionId: string | undefined) => {
  const [flashcardSets, setFlashcardSets] = useState<FlashcardSet[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load flashcards from sessionStorage
  const loadFlashcards = useCallback(() => {
    if (!sessionId) {
      setFlashcardSets([]);
      return;
    }

    setIsLoading(true);
    try {
      const sessionFlashcards = sessionStorage.getItem(`flashcards_${sessionId}`);
      if (sessionFlashcards) {
        const parsed = JSON.parse(sessionFlashcards);
        setFlashcardSets(parsed);
      } else {
        setFlashcardSets([]);
      }
    } catch (error) {
      console.error('Error loading session flashcards:', error);
      setFlashcardSets([]);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  // Save flashcards to sessionStorage
  const saveFlashcards = useCallback((sets: FlashcardSet[]) => {
    if (!sessionId) return;

    try {
      sessionStorage.setItem(`flashcards_${sessionId}`, JSON.stringify(sets));
      setFlashcardSets(sets);
      
      // Dispatch event to notify other components
      flashcardEventTarget.dispatchEvent(new FlashcardUpdateEvent(sessionId, sets));
    } catch (error) {
      console.error('Error saving session flashcards:', error);
    }
  }, [sessionId]);

  // Add a new flashcard set
  const addFlashcardSet = useCallback((newSet: FlashcardSet) => {
    const updatedSets = [newSet, ...flashcardSets];
    saveFlashcards(updatedSets);
  }, [flashcardSets, saveFlashcards]);

  // Update an existing flashcard set
  const updateFlashcardSet = useCallback((updatedSet: FlashcardSet) => {
    const updatedSets = flashcardSets.map(set => 
      set.id === updatedSet.id ? updatedSet : set
    );
    saveFlashcards(updatedSets);
  }, [flashcardSets, saveFlashcards]);

  // Remove a flashcard set
  const removeFlashcardSet = useCallback((setId: string) => {
    const updatedSets = flashcardSets.filter(set => set.id !== setId);
    saveFlashcards(updatedSets);
  }, [flashcardSets, saveFlashcards]);

  // Load flashcards when session changes
  useEffect(() => {
    loadFlashcards();
  }, [loadFlashcards]);

  // Listen for flashcard update events
  useEffect(() => {
    const handleFlashcardUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.sessionId === sessionId) {
        setFlashcardSets(customEvent.detail.flashcardSets);
      }
    };

    flashcardEventTarget.addEventListener('flashcardUpdate', handleFlashcardUpdate);
    
    return () => {
      flashcardEventTarget.removeEventListener('flashcardUpdate', handleFlashcardUpdate);
    };
  }, [sessionId]);

  return {
    flashcardSets,
    isLoading,
    addFlashcardSet,
    updateFlashcardSet,
    removeFlashcardSet,
    refreshFlashcards: loadFlashcards
  };
};

// Export the event dispatcher for use in other components
export { flashcardEventTarget };
