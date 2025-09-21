import { useState, useEffect, useCallback } from 'react';
import { FlashcardSet } from '../types/flashcard';
import { flashcardService } from '../services/flashcardService';

// Custom event for flashcard updates
class FlashcardUpdateEvent extends Event {
  constructor(public flashcardSets: FlashcardSet[]) {
    super('allFlashcardUpdate');
  }
}

// Global event dispatcher
const allFlashcardEventTarget = new EventTarget();

export const useAllFlashcards = () => {
  const [flashcardSets, setFlashcardSets] = useState<FlashcardSet[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load flashcards from both localStorage (global) and sessionStorage (per session)
  const loadAllFlashcards = useCallback(() => {
    setIsLoading(true);
    try {
      // Get global flashcard sets from localStorage
      const globalSets = flashcardService.getFlashcardSets();
      
      // Get session-based flashcard sets from all sessions
      const sessionSets: FlashcardSet[] = [];
      
      // Iterate through all sessionStorage keys to find flashcard data
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('flashcards_')) {
          try {
            const sessionData = sessionStorage.getItem(key);
            if (sessionData) {
              const parsed = JSON.parse(sessionData);
              if (Array.isArray(parsed)) {
                sessionSets.push(...parsed);
              }
            }
          } catch (error) {
            console.error('Error parsing session flashcard data:', error);
          }
        }
      }
      
      // Combine and deduplicate flashcard sets
      const allSets = [...globalSets, ...sessionSets];
      const uniqueSets = allSets.filter((set, index, self) => 
        index === self.findIndex(s => s.id === set.id)
      );
      
      // Sort by creation date (newest first)
      uniqueSets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setFlashcardSets(uniqueSets);
      console.log('📚 Loaded all flashcard sets:', uniqueSets.length, '(Global:', globalSets.length, 'Session:', sessionSets.length, ')');
    } catch (error) {
      console.error('Error loading all flashcards:', error);
      setFlashcardSets([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save flashcards to appropriate storage
  const saveFlashcardSet = useCallback((flashcardSet: FlashcardSet) => {
    try {
      // Save to global storage
      flashcardService.saveFlashcardSet(flashcardSet);
      
      // Reload all flashcards to get updated list
      loadAllFlashcards();
      
      // Dispatch event to notify other components
      allFlashcardEventTarget.dispatchEvent(new FlashcardUpdateEvent(flashcardSets));
    } catch (error) {
      console.error('Error saving flashcard set:', error);
    }
  }, [flashcardSets, loadAllFlashcards]);

  // Update an existing flashcard set
  const updateFlashcardSet = useCallback((updatedSet: FlashcardSet) => {
    try {
      // Update in global storage
      flashcardService.updateFlashcardMastery(updatedSet.id, 0); // This might need to be updated
      
      // Update in session storage if it exists there
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('flashcards_')) {
          try {
            const sessionData = sessionStorage.getItem(key);
            if (sessionData) {
              const parsed = JSON.parse(sessionData);
              if (Array.isArray(parsed)) {
                const updatedSessionData = parsed.map((set: FlashcardSet) => 
                  set.id === updatedSet.id ? updatedSet : set
                );
                sessionStorage.setItem(key, JSON.stringify(updatedSessionData));
              }
            }
          } catch (error) {
            console.error('Error updating session flashcard data:', error);
          }
        }
      }
      
      // Reload all flashcards
      loadAllFlashcards();
      
      // Dispatch event
      allFlashcardEventTarget.dispatchEvent(new FlashcardUpdateEvent(flashcardSets));
    } catch (error) {
      console.error('Error updating flashcard set:', error);
    }
  }, [flashcardSets, loadAllFlashcards]);

  // Remove a flashcard set
  const removeFlashcardSet = useCallback((setId: string) => {
    try {
      // Remove from global storage
      flashcardService.deleteFlashcardSet(setId);
      
      // Remove from session storage
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('flashcards_')) {
          try {
            const sessionData = sessionStorage.getItem(key);
            if (sessionData) {
              const parsed = JSON.parse(sessionData);
              if (Array.isArray(parsed)) {
                const filteredSessionData = parsed.filter((set: FlashcardSet) => set.id !== setId);
                sessionStorage.setItem(key, JSON.stringify(filteredSessionData));
              }
            }
          } catch (error) {
            console.error('Error removing from session flashcard data:', error);
          }
        }
      }
      
      // Reload all flashcards
      loadAllFlashcards();
      
      // Dispatch event
      allFlashcardEventTarget.dispatchEvent(new FlashcardUpdateEvent(flashcardSets));
    } catch (error) {
      console.error('Error removing flashcard set:', error);
    }
  }, [flashcardSets, loadAllFlashcards]);

  // Load flashcards on mount
  useEffect(() => {
    loadAllFlashcards();
  }, [loadAllFlashcards]);

  // Listen for flashcard update events
  useEffect(() => {
    const handleFlashcardUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.flashcardSets) {
        setFlashcardSets(customEvent.detail.flashcardSets);
      }
    };

    allFlashcardEventTarget.addEventListener('allFlashcardUpdate', handleFlashcardUpdate);
    
    return () => {
      allFlashcardEventTarget.removeEventListener('allFlashcardUpdate', handleFlashcardUpdate);
    };
  }, []);

  return {
    flashcardSets,
    isLoading,
    saveFlashcardSet,
    updateFlashcardSet,
    removeFlashcardSet,
    refreshFlashcards: loadAllFlashcards
  };
};

// Export the event dispatcher for use in other components
export { allFlashcardEventTarget };
