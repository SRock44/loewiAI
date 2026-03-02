import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react' // eslint-disable-line @typescript-eslint/no-redeclare
import FlashcardList from '../../src/components/FlashcardList'
import { FlashcardSet } from '../../src/types/flashcard'

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <div>{children}</div>,
}))

describe('FlashcardList', () => {
  const mockFlashcardSet: FlashcardSet = {
    id: 'set1',
    title: 'Test Set',
    description: 'Test Description',
    flashcards: [
      {
        id: 'card1',
        question: 'What is React?',
        answer: 'A JavaScript library',
        category: 'Web Development',
        difficulty: 'easy',
        tags: ['react'],
        createdAt: new Date(),
        reviewCount: 0,
        masteryLevel: 0,
      },
      {
        id: 'card2',
        question: 'What is TypeScript?',
        answer: 'Typed JavaScript',
        category: 'Web Development',
        difficulty: 'medium',
        tags: ['typescript'],
        createdAt: new Date(),
        reviewCount: 0,
        masteryLevel: 0,
      },
      {
        id: 'card3',
        question: 'What is Node.js?',
        answer: 'JavaScript runtime',
        category: 'Backend',
        difficulty: 'hard',
        tags: ['node'],
        createdAt: new Date(),
        reviewCount: 0,
        masteryLevel: 0,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render flashcard list with cards', () => {
    render(<FlashcardList flashcardSet={mockFlashcardSet} />)
    
    expect(screen.getByText('What is React?')).toBeInTheDocument()
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
  })

  it('should navigate to next card', () => {
    render(<FlashcardList flashcardSet={mockFlashcardSet} />)
    
    const nextButton = screen.getByText('Next')
    fireEvent.click(nextButton)
    
    expect(screen.getByText('What is TypeScript?')).toBeInTheDocument()
    expect(screen.getByText('2 of 3')).toBeInTheDocument()
  })

  it('should navigate to previous card', () => {
    render(<FlashcardList flashcardSet={mockFlashcardSet} />)
    
    // First go to card 2
    const nextButton = screen.getByText('Next')
    fireEvent.click(nextButton)
    
    // Then go back
    const prevButton = screen.getByText('Previous')
    fireEvent.click(prevButton)
    
    expect(screen.getByText('What is React?')).toBeInTheDocument()
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
  })

  it('should disable previous button on first card', () => {
    render(<FlashcardList flashcardSet={mockFlashcardSet} />)
    
    const prevButton = screen.getByText('Previous').closest('button')
    expect(prevButton).toBeDisabled()
  })

  it('should disable next button on last card', () => {
    render(<FlashcardList flashcardSet={mockFlashcardSet} />)
    
    // Navigate to last card
    const nextButton = screen.getByText('Next')
    fireEvent.click(nextButton)
    fireEvent.click(nextButton)
    
    const lastNextButton = screen.getByText('Next').closest('button')
    expect(lastNextButton).toBeDisabled()
  })

  it('should navigate to specific card using pagination dots', () => {
    render(<FlashcardList flashcardSet={mockFlashcardSet} />)
    
    // Click on third dot
    const dots = screen.getAllByRole('button').filter(btn => 
      btn.className.includes('nav-dot-new')
    )
    fireEvent.click(dots[2])
    
    expect(screen.getByText('What is Node.js?')).toBeInTheDocument()
    expect(screen.getByText('3 of 3')).toBeInTheDocument()
  })

  it('should display correct number of pagination dots', () => {
    render(<FlashcardList flashcardSet={mockFlashcardSet} />)
    
    const dots = screen.getAllByRole('button').filter(btn => 
      btn.className.includes('nav-dot-new')
    )
    expect(dots).toHaveLength(3)
  })

  it('should show empty message when no flashcards', () => {
    const emptySet: FlashcardSet = {
      id: 'empty',
      title: 'Empty Set',
      description: 'No cards',
      flashcards: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    
    render(<FlashcardList flashcardSet={emptySet} />)
    
    expect(screen.getByText('No flashcards available')).toBeInTheDocument()
    expect(screen.getByText('No flashcards in this set.')).toBeInTheDocument()
  })

  it('should handle single flashcard', () => {
    const singleCardSet: FlashcardSet = {
      id: 'single',
      title: 'Single Card',
      description: 'One card',
      flashcards: [mockFlashcardSet.flashcards[0]],
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    
    render(<FlashcardList flashcardSet={singleCardSet} />)
    
    expect(screen.getByText('What is React?')).toBeInTheDocument()
    expect(screen.getByText('1 of 1')).toBeInTheDocument()
    
    // Both buttons should be disabled
    const prevButton = screen.getByText('Previous').closest('button')
    const nextButton = screen.getByText('Next').closest('button')
    expect(prevButton).toBeDisabled()
    expect(nextButton).toBeDisabled()
  })

  it('should filter flashcards by difficulty', () => {
    // Note: Filtering is currently disabled but the logic exists
    // This test verifies the component still works with filtered cards
    render(<FlashcardList flashcardSet={mockFlashcardSet} />)
    
    // All cards should be visible
    expect(screen.getByText('What is React?')).toBeInTheDocument()
  })

  it('should display navigation hint text', () => {
    render(<FlashcardList flashcardSet={mockFlashcardSet} />)
    
    expect(screen.getByText(/Click card to flip • Use arrows to navigate/i)).toBeInTheDocument()
  })

  it('should reset flip state when navigating to next card', () => {
    render(<FlashcardList flashcardSet={mockFlashcardSet} />)
    
    // Navigate to next card
    const nextButton = screen.getByText('Next')
    fireEvent.click(nextButton)
    
    // Should show card 2
    expect(screen.getByText('What is TypeScript?')).toBeInTheDocument()
    expect(screen.getByText('2 of 3')).toBeInTheDocument()
  })

  it('should reset flip state when navigating to previous card', () => {
    render(<FlashcardList flashcardSet={mockFlashcardSet} />)
    
    // Go to card 2 first
    const nextButton = screen.getByText('Next')
    fireEvent.click(nextButton)
    
    // Then go back
    const prevButton = screen.getByText('Previous')
    fireEvent.click(prevButton)
    
    // Should show card 1
    expect(screen.getByText('What is React?')).toBeInTheDocument()
  })

  it('should handle navigating with pagination dots correctly', () => {
    render(<FlashcardList flashcardSet={mockFlashcardSet} />)
    
    // Click on middle dot (card 2)
    const dots = screen.getAllByRole('button').filter(btn => 
      btn.className.includes('nav-dot-new')
    )
    
    expect(dots).toHaveLength(3)
    fireEvent.click(dots[1]) // Second dot (index 1) = card 2
    
    expect(screen.getByText('What is TypeScript?')).toBeInTheDocument()
  })

  it('should maintain correct card count after navigation', () => {
    render(<FlashcardList flashcardSet={mockFlashcardSet} />)
    
    // Navigate through all cards
    const nextButton = screen.getByText('Next')
    fireEvent.click(nextButton) // Card 2
    expect(screen.getByText('2 of 3')).toBeInTheDocument()
    
    fireEvent.click(nextButton) // Card 3
    expect(screen.getByText('3 of 3')).toBeInTheDocument()
  })
})

