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
  const loadAllFlashcards = useCallback(async () => {
    console.log('🔍 DEBUG: loadAllFlashcards called');
    setIsLoading(true);
    try {
      // First load from Firebase to ensure we have the latest data
      await flashcardService.loadFlashcardSets();
      
      // Then get the updated sets from the service
      const sets = flashcardService.getFlashcardSets();
      console.log('🔍 DEBUG: Got sets from service:', sets.length, 'sets');
      
      // Sort by creation date (newest first)
      sets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setFlashcardSets(sets);
      console.log('🔍 DEBUG: Set flashcard sets state with', sets.length, 'sets');
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
      
      // Update local state immediately
      setFlashcardSets(prev => prev.filter(set => set.id !== setId));
      
      // Dispatch event with updated data to notify other components
      const updatedSets = flashcardSets.filter(set => set.id !== setId);
      allFlashcardEventTarget.dispatchEvent(new FlashcardUpdateEvent(updatedSets));
    } catch (error) {
      // Error removing flashcard set
    }
  }, [flashcardSets]);

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

    const handleFlashcardUpdateFromChat = async () => {
      // When flashcards are generated from chat, reload all flashcards
      // This ensures newly generated flashcards appear in history
      // Add a small delay to prevent race conditions with deletions
      setTimeout(async () => {
        await loadAllFlashcards();
      }, 100);
    };

    allFlashcardEventTarget.addEventListener('allFlashcardUpdate', handleFlashcardUpdate);
    allFlashcardEventTarget.addEventListener('flashcardUpdate', handleFlashcardUpdateFromChat);
    
    return () => {
      allFlashcardEventTarget.removeEventListener('allFlashcardUpdate', handleFlashcardUpdate);
      allFlashcardEventTarget.removeEventListener('flashcardUpdate', handleFlashcardUpdateFromChat);
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
