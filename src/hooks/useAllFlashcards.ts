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

  // Load flashcards from Firebase (user-specific)
  const loadAllFlashcards = useCallback(() => {
    setIsLoading(true);
    try {
      // Get flashcard sets from Firebase (user-specific)
      const sets = flashcardService.getFlashcardSets();
      console.log('📚 Loaded flashcard sets:', sets.length, sets);
      
      // Sort by creation date (newest first)
      sets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setFlashcardSets(sets);
    } catch (error) {
      console.error('❌ Error loading flashcards:', error);
      // Error loading flashcards
      setFlashcardSets([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save flashcards to Firebase
  const saveFlashcardSet = useCallback(async (flashcardSet: FlashcardSet) => {
    try {
      await flashcardService.saveFlashcardSet(flashcardSet);
      
      // Reload all flashcards to get updated list
      loadAllFlashcards();
      
      // Dispatch event to notify other components
      allFlashcardEventTarget.dispatchEvent(new FlashcardUpdateEvent(flashcardSets));
    } catch (error) {
      // Error saving flashcard set
    }
  }, [flashcardSets, loadAllFlashcards]);

  // Update an existing flashcard set
  const updateFlashcardSet = useCallback(async (updatedSet: FlashcardSet) => {
    try {
      await flashcardService.saveFlashcardSet(updatedSet);
      
      // Reload all flashcards
      loadAllFlashcards();
      
      // Dispatch event
      allFlashcardEventTarget.dispatchEvent(new FlashcardUpdateEvent(flashcardSets));
    } catch (error) {
      // Error updating flashcard set
    }
  }, [flashcardSets, loadAllFlashcards]);

  // Remove a flashcard set
  const removeFlashcardSet = useCallback(async (setId: string) => {
    try {
      await flashcardService.deleteFlashcardSet(setId);
      
      // Reload all flashcards
      loadAllFlashcards();
      
      // Dispatch event
      allFlashcardEventTarget.dispatchEvent(new FlashcardUpdateEvent(flashcardSets));
    } catch (error) {
      // Error removing flashcard set
    }
  }, [flashcardSets, loadAllFlashcards]);

  // Load flashcards on mount
  useEffect(() => {
    loadAllFlashcards();
  }, [loadAllFlashcards]);

  // Fallback: Poll for updates every 5 seconds (in case events don't work)
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('🔄 Polling for flashcard updates...');
      loadAllFlashcards();
    }, 5000);

    return () => clearInterval(interval);
  }, [loadAllFlashcards]);

  // Listen for flashcard update events
  useEffect(() => {
    const handleFlashcardUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.flashcardSets) {
        setFlashcardSets(customEvent.detail.flashcardSets);
      }
    };

    const handleFlashcardUpdateFromChat = async () => {
      // When flashcards are generated from chat, reload all flashcards
      console.log('🔄 Received flashcardUpdate event, reloading flashcards...');
      
      // Force reload from the service (which will reload from Firebase)
      try {
        await flashcardService.loadFlashcardSets();
        console.log('✅ Service reloaded, now reloading in hook...');
      } catch (error) {
        console.error('❌ Error reloading service:', error);
      }
      
      // Then reload in the hook
      loadAllFlashcards();
    };

    const handleTestEvent = () => {
      console.log('🧪 Received test event - event system is working!');
    };

    allFlashcardEventTarget.addEventListener('allFlashcardUpdate', handleFlashcardUpdate);
    allFlashcardEventTarget.addEventListener('flashcardUpdate', handleFlashcardUpdateFromChat);
    allFlashcardEventTarget.addEventListener('testEvent', handleTestEvent);
    
    return () => {
      allFlashcardEventTarget.removeEventListener('allFlashcardUpdate', handleFlashcardUpdate);
      allFlashcardEventTarget.removeEventListener('flashcardUpdate', handleFlashcardUpdateFromChat);
      allFlashcardEventTarget.removeEventListener('testEvent', handleTestEvent);
    };
  }, [loadAllFlashcards]);

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
