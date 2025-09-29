import { useState, useEffect, useCallback } from 'react';
import { FlashcardSet } from '../types/flashcard';
import { flashcardService } from '../services/flashcardService';
import { firebaseAuthService } from '../services/firebaseAuthService';

// Custom event for flashcard updates (kept for potential future use)
// class FlashcardUpdateEvent extends Event {
//   constructor(public flashcardSets: FlashcardSet[]) {
//     super('allFlashcardUpdate');
//   }
// }

// Global event dispatcher
const allFlashcardEventTarget = new EventTarget();

export const useAllFlashcards = () => {
  const [flashcardSets, setFlashcardSets] = useState<FlashcardSet[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load flashcards from Firebase (user-specific)
  const loadAllFlashcards = useCallback(async () => {
    setIsLoading(true);
    try {
      // Loading flashcards from Firebase
      
      // Get flashcard sets directly from Firebase
      const sets = await flashcardService.getFlashcardSets();
      
      // Loaded flashcard sets from Firebase
      
      // Sort by creation date (newest first)
      sets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setFlashcardSets(sets);
    } catch (error) {
      console.error('Error loading flashcards:', error);
      setFlashcardSets([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save flashcards to Firebase
  const saveFlashcardSet = useCallback(async (flashcardSet: FlashcardSet) => {
    try {
      await flashcardService.saveFlashcardSet(flashcardSet);
      
      // Reload from Firebase to get the latest data
      await loadAllFlashcards();
    } catch (error) {
      console.error('Error saving flashcard set:', error);
      // Reload flashcards to ensure we have the correct state
      await loadAllFlashcards();
    }
  }, [loadAllFlashcards]);

  // Update an existing flashcard set
  const updateFlashcardSet = useCallback(async (updatedSet: FlashcardSet) => {
    try {
      await flashcardService.saveFlashcardSet(updatedSet);
      
      // Reload from Firebase to get the latest data
      await loadAllFlashcards();
    } catch (error) {
      console.error('Error updating flashcard set:', error);
      // Reload flashcards to ensure we have the correct state
      await loadAllFlashcards();
    }
  }, [loadAllFlashcards]);

  // Remove a flashcard set
  const removeFlashcardSet = useCallback(async (setId: string) => {
    try {
      // Delete from Firebase
      await flashcardService.deleteFlashcardSet(setId);
      
      // Reload from Firebase to get the latest data
      await loadAllFlashcards();
    } catch (error) {
      console.error('Error removing flashcard set:', error);
      // Reload flashcards to ensure we have the correct state
      await loadAllFlashcards();
    }
  }, [loadAllFlashcards]);

  // Load flashcards on mount and when auth state changes
  useEffect(() => {
    loadAllFlashcards();
  }, [loadAllFlashcards]);

  // Listen for authentication state changes and retry loading if needed
  useEffect(() => {
    const unsubscribe = firebaseAuthService.onAuthStateChange((user) => {
      if (user && flashcardSets.length === 0 && !isLoading) {
        // User is authenticated but we have no flashcard sets, retry loading
        // User authenticated, retrying flashcard load
        loadAllFlashcards();
      }
    });

    return unsubscribe;
  }, [flashcardSets.length, isLoading, loadAllFlashcards]);


  // Listen for flashcard update events
  useEffect(() => {
    const handleFlashcardUpdateFromChat = async () => {
      // When flashcards are generated from chat, reload all flashcards
      // This ensures newly generated flashcards appear in history
      await loadAllFlashcards();
    };

    allFlashcardEventTarget.addEventListener('flashcardUpdate', handleFlashcardUpdateFromChat);
    
    return () => {
      allFlashcardEventTarget.removeEventListener('flashcardUpdate', handleFlashcardUpdateFromChat);
    };
  }, [loadAllFlashcards]);

  return {
    flashcardSets,
    isLoading,
    saveFlashcardSet,
    updateFlashcardSet,
    removeFlashcardSet,
    refreshFlashcards: loadAllFlashcards,
    forceReload: loadAllFlashcards
  };
};

// Export the event dispatcher for use in other components
export { allFlashcardEventTarget };
