import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flashcardService } from '../flashcardService'
import { Flashcard, FlashcardSet } from '../../types/flashcard'
import { firebaseService } from '../firebaseService'
import { firebaseAuthService } from '../firebaseAuthService'
import { UserProfileService } from '../userProfileService'

// Mock dependencies
vi.mock('../firebaseService', () => ({
  firebaseService: {
    getFlashcardSets: vi.fn(),
    saveFlashcardSet: vi.fn(),
    updateFlashcardSet: vi.fn(),
    deleteFlashcardSet: vi.fn(),
  },
}))

vi.mock('../firebaseAuthService', () => ({
  firebaseAuthService: {
    getCurrentUser: vi.fn(),
    onAuthStateChange: vi.fn(),
  },
}))

vi.mock('../userProfileService', () => ({
  UserProfileService: {
    buildPersonalizationContext: vi.fn(),
  },
}))

describe('flashcardService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    
    // Default mock implementations
    vi.mocked(firebaseAuthService.getCurrentUser).mockReturnValue(null)
    vi.mocked(firebaseAuthService.onAuthStateChange).mockImplementation(() => () => {})
    vi.mocked(UserProfileService.buildPersonalizationContext).mockResolvedValue('')
  })

  describe('createFlashcardSet', () => {
    it('should create a flashcard set with provided data', () => {
      const flashcards: Flashcard[] = [
        {
          id: 'card1',
          question: 'What is React?',
          answer: 'A JavaScript library',
          category: 'Web Development',
          difficulty: 'medium',
          tags: ['react', 'javascript'],
          createdAt: new Date(),
          reviewCount: 0,
          masteryLevel: 0,
        },
      ]

      const set = flashcardService.createFlashcardSet(
        'Test Set',
        'Test Description',
        flashcards,
        ['doc1']
      )

      expect(set.title).toBe('Test Set')
      expect(set.description).toBe('Test Description')
      expect(set.flashcards).toEqual(flashcards)
      expect(set.sourceDocumentIds).toEqual(['doc1'])
      expect(set.createdAt).toBeInstanceOf(Date)
      expect(set.updatedAt).toBeInstanceOf(Date)
    })

    it('should create a flashcard set with empty description', () => {
      const flashcards: Flashcard[] = []
      const set = flashcardService.createFlashcardSet('Test Set', '', flashcards)

      expect(set.title).toBe('Test Set')
      expect(set.description).toBe('')
      expect(set.flashcards).toEqual([])
    })
  })

  describe('getFlashcardSets', () => {
    it('should return empty array when user is not authenticated', async () => {
      const sets = await flashcardService.getFlashcardSets()
      expect(sets).toEqual([])
    })

    it('should return flashcard sets from Firebase for authenticated users', async () => {
      const mockUser = { id: 'user1', email: 'test@example.com', name: 'Test User', picture: '', provider: 'google' as const, createdAt: new Date(), lastLoginAt: new Date() }
      vi.mocked(firebaseAuthService.getCurrentUser).mockReturnValue(mockUser)

      const mockSets: FlashcardSet[] = [
        {
          id: 'set1',
          title: 'Firebase Set',
          description: 'Firebase Description',
          flashcards: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      vi.mocked(firebaseService.getFlashcardSets).mockResolvedValue(mockSets)

      const sets = await flashcardService.getFlashcardSets()
      expect(sets).toEqual(mockSets)
      expect(firebaseService.getFlashcardSets).toHaveBeenCalledWith('user1')
    })
  })

  describe('saveFlashcardSet', () => {
    it('should save to Firebase for authenticated users', async () => {
      const mockUser = { id: 'user1', email: 'test@example.com', name: 'Test User', picture: '', provider: 'google' as const, createdAt: new Date(), lastLoginAt: new Date() }
      vi.mocked(firebaseAuthService.getCurrentUser).mockReturnValue(mockUser)
      vi.mocked(firebaseService.saveFlashcardSet).mockResolvedValue('firebase-id')

      const mockSet: FlashcardSet = {
        id: '',
        title: 'Test Set',
        description: 'Test Description',
        flashcards: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      await flashcardService.saveFlashcardSet(mockSet)

      expect(firebaseService.saveFlashcardSet).toHaveBeenCalledWith(mockSet, 'user1')
      expect(mockSet.id).toBe('firebase-id')
    })
  })

  describe('deleteFlashcardSet', () => {
    it('should delete from Firebase for authenticated users', async () => {
      const mockUser = { id: 'user1', email: 'test@example.com', name: 'Test User', picture: '', provider: 'google' as const, createdAt: new Date(), lastLoginAt: new Date() }
      vi.mocked(firebaseAuthService.getCurrentUser).mockReturnValue(mockUser)
      vi.mocked(firebaseService.deleteFlashcardSet).mockResolvedValue(undefined)

      await flashcardService.deleteFlashcardSet('firebase-id')

      expect(firebaseService.deleteFlashcardSet).toHaveBeenCalledWith('firebase-id', 'user1')
    })
  })
})
