import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Flashcard from '../Flashcard'
import { Flashcard as FlashcardType } from '../../types/flashcard'

// Mock react-card-flip
vi.mock('react-card-flip', () => ({
  default: ({ children, isFlipped }: any) => (
    <div data-testid="card-flip" data-flipped={isFlipped}>
      {children}
    </div>
  ),
}))

describe('Flashcard', () => {
  const mockFlashcard: FlashcardType = {
    id: 'card1',
    question: 'What is React?',
    answer: 'A JavaScript library for building user interfaces',
    category: 'Web Development',
    difficulty: 'medium',
    tags: ['react', 'javascript'],
    createdAt: new Date(),
    reviewCount: 0,
    masteryLevel: 0,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the flashcard component', () => {
    render(<Flashcard flashcard={mockFlashcard} />)
    
    expect(screen.getByText('Question')).toBeInTheDocument()
    expect(screen.getByText('What is React?')).toBeInTheDocument()
  })

  it('should render flashcard category when provided', () => {
    render(<Flashcard flashcard={mockFlashcard} />)
    
    // ReactCardFlip renders both front and back, so check that it appears at least once
    const categories = screen.getAllByText('Web Development')
    expect(categories.length).toBeGreaterThan(0)
  })

  it('should render flashcard difficulty when provided', () => {
    render(<Flashcard flashcard={mockFlashcard} />)
    
    // ReactCardFlip renders both front and back, so check that it appears at least once
    const difficulties = screen.getAllByText('medium')
    expect(difficulties.length).toBeGreaterThan(0)
  })

  it('should not render category when not provided', () => {
    const flashcardWithoutCategory = { ...mockFlashcard, category: undefined }
    render(<Flashcard flashcard={flashcardWithoutCategory} />)
    
    expect(screen.queryByText('Web Development')).not.toBeInTheDocument()
  })

  it('should display mastery level indicator', () => {
    render(<Flashcard flashcard={mockFlashcard} />)
    
    // ReactCardFlip renders both front and back, so check that it appears at least once
    const indicators = screen.getAllByText('Unassigned')
    expect(indicators.length).toBeGreaterThan(0)
  })

  it('should apply custom className', () => {
    const { container } = render(<Flashcard flashcard={mockFlashcard} className="custom-class" />)
    
    const containerElement = container.querySelector('.flashcard-container')
    expect(containerElement).toHaveClass('custom-class')
  })

  it('should handle empty question gracefully', () => {
    const emptyFlashcard = { ...mockFlashcard, question: '' }
    render(<Flashcard flashcard={emptyFlashcard} />)
    
    expect(screen.getByText('Question')).toBeInTheDocument()
  })

  it('should handle empty answer gracefully', () => {
    const emptyFlashcard = { ...mockFlashcard, answer: '' }
    render(<Flashcard flashcard={emptyFlashcard} />)
    
    // Component should still render
    expect(screen.getByText('Question')).toBeInTheDocument()
  })
})
