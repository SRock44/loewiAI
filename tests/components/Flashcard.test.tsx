import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react' // eslint-disable-line @typescript-eslint/no-redeclare
import Flashcard from '../../src/components/Flashcard'
import { Flashcard as FlashcardType } from '../../src/types/flashcard'

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
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
    render(<Flashcard flashcard={mockFlashcard} number={1} total={1} />)
    
    // Check for "Question 1 of 1" text (the header shows this)
    expect(screen.getByText(/Question 1 of 1/i)).toBeInTheDocument()
    expect(screen.getByText('What is React?')).toBeInTheDocument()
  })

  it('should render flashcard difficulty when provided', () => {
    render(<Flashcard flashcard={mockFlashcard} number={1} total={1} />)
    
    // Difficulty is displayed as capitalized "Medium" not "medium"
    // Both front and back sides render the difficulty, so use getAllByText
    const difficulties = screen.getAllByText('Medium')
    expect(difficulties.length).toBeGreaterThan(0)
  })

  it('should render difficulty badge for easy flashcards', () => {
    const easyFlashcard = { ...mockFlashcard, difficulty: 'easy' }
    render(<Flashcard flashcard={easyFlashcard} number={1} total={1} />)
    
    // Both front and back sides render the difficulty
    const difficulties = screen.getAllByText('Easy')
    expect(difficulties.length).toBeGreaterThan(0)
  })

  it('should render difficulty badge for hard flashcards', () => {
    const hardFlashcard = { ...mockFlashcard, difficulty: 'hard' }
    render(<Flashcard flashcard={hardFlashcard} number={1} total={1} />)
    
    // Both front and back sides render the difficulty
    const difficulties = screen.getAllByText('Hard')
    expect(difficulties.length).toBeGreaterThan(0)
  })

  it('should display answer side when flipped', () => {
    render(<Flashcard flashcard={mockFlashcard} number={1} total={1} isFlipped={true} />)
    
    // When flipped, should show "Answer 1 of 1"
    expect(screen.getByText(/Answer 1 of 1/i)).toBeInTheDocument()
    expect(screen.getByText('A JavaScript library for building user interfaces')).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    const { container } = render(<Flashcard flashcard={mockFlashcard} className="custom-class" number={1} total={1} />)
    
    // className is applied to .flashcard-wrapper
    const wrapperElement = container.querySelector('.flashcard-wrapper')
    expect(wrapperElement).toHaveClass('custom-class')
  })

  it('should handle empty question gracefully', () => {
    const emptyFlashcard = { ...mockFlashcard, question: '' }
    render(<Flashcard flashcard={emptyFlashcard} number={1} total={1} />)
    
    // Should still show the Question header
    expect(screen.getByText(/Question 1 of 1/i)).toBeInTheDocument()
  })

  it('should handle empty answer gracefully', () => {
    const emptyFlashcard = { ...mockFlashcard, answer: '' }
    render(<Flashcard flashcard={emptyFlashcard} number={1} total={1} isFlipped={true} />)
    
    // Should still show the Answer header when flipped
    expect(screen.getByText(/Answer 1 of 1/i)).toBeInTheDocument()
  })

  it('should display footer hints correctly', () => {
    render(<Flashcard flashcard={mockFlashcard} number={1} total={1} />)
    
    // Front side should show "Click to reveal answer"
    expect(screen.getByText('Click to reveal answer')).toBeInTheDocument()
  })

  it('should display answer side footer hint when flipped', () => {
    render(<Flashcard flashcard={mockFlashcard} number={1} total={1} isFlipped={true} />)
    
    // Back side should show "Click to see question"
    expect(screen.getByText('Click to see question')).toBeInTheDocument()
  })

  it('should render both front and back sides', () => {
    render(<Flashcard flashcard={mockFlashcard} number={1} total={1} />)
    
    // Both sides are rendered (front and back), just one is visible
    // Check that both question and answer content are in the DOM
    expect(screen.getByText('What is React?')).toBeInTheDocument()
    expect(screen.getByText('A JavaScript library for building user interfaces')).toBeInTheDocument()
  })

  it('should handle undefined number and total props', () => {
    render(<Flashcard flashcard={mockFlashcard} />)
    
    // Should still render without number/total
    expect(screen.getByText('What is React?')).toBeInTheDocument()
  })

  it('should display difficulty badge on both sides', () => {
    render(<Flashcard flashcard={mockFlashcard} number={1} total={1} />)
    
    // Both front and back should show difficulty
    const difficulties = screen.getAllByText('Medium')
    expect(difficulties.length).toBeGreaterThanOrEqual(1)
  })

  it('should handle flashcard with no tags', () => {
    const flashcardNoTags = { ...mockFlashcard, tags: [] }
    render(<Flashcard flashcard={flashcardNoTags} number={1} total={1} />)
    
    expect(screen.getByText('What is React?')).toBeInTheDocument()
  })
})
