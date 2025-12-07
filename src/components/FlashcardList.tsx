import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Flashcard from './Flashcard';
import { FlashcardSet } from '../types/flashcard';
import './FlashcardList.css';

interface FlashcardListProps {
  flashcardSet: FlashcardSet;
  onSetUpdate?: (updatedSet: FlashcardSet) => void;
}

const FlashcardList: React.FC<FlashcardListProps> = ({
  flashcardSet
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [direction, setDirection] = useState(0);
  // Filter state variables kept for future implementation
  const [filterDifficulty] = useState<string>('all');
  const [studyMode] = useState<'sequential' | 'random'>('sequential');

  // Filter flashcards based on selected criteria
  const filteredFlashcards = useMemo(() => {
    if (!flashcardSet?.flashcards || flashcardSet.flashcards.length === 0) {
      return [];
    }
    
    let filtered = [...flashcardSet.flashcards];

    if (filterDifficulty !== 'all') {
      filtered = filtered.filter(card => card.difficulty === filterDifficulty);
    }

    switch (studyMode) {
      case 'random':
        return filtered.sort(() => Math.random() - 0.5);
      default:
        return filtered;
    }
  }, [flashcardSet?.flashcards, filterDifficulty, studyMode]);

  // Reset index if it's out of bounds
  useEffect(() => {
    if (filteredFlashcards.length > 0 && currentIndex >= filteredFlashcards.length) {
      setCurrentIndex(0);
    }
  }, [filteredFlashcards.length, currentIndex]);

  const currentFlashcard = filteredFlashcards.length > 0 && currentIndex < filteredFlashcards.length 
    ? filteredFlashcards[currentIndex] 
    : null;

  const goToNext = () => {
    setDirection(1);
    setCurrentIndex((prev) => Math.min(prev + 1, filteredFlashcards.length - 1));
    setIsFlipped(false); // Reset to question side
  };

  const goToPrevious = () => {
    setDirection(-1);
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
    setIsFlipped(false); // Reset to question side
  };

  const goToCard = (index: number) => {
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
    setIsFlipped(false); // Reset to question side
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -300 : 300,
      opacity: 0
    })
  };

  // Chevron Left Icon Component
  const ChevronLeft = ({ size = 20 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6"/>
    </svg>
  );

  // Chevron Right Icon Component
  const ChevronRight = ({ size = 20 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6"/>
    </svg>
  );

  if (!flashcardSet || !flashcardSet.flashcards || filteredFlashcards.length === 0) {
    return (
      <div className="flashcard-list-container-new">
        <div className="no-cards-message">
          <div className="no-cards-icon">📚</div>
          <h3>No flashcards available</h3>
          <p>No flashcards in this set.</p>
        </div>
      </div>
    );
  }

  if (!currentFlashcard) {
    return (
      <div className="flashcard-list-container-new">
        <div className="no-cards-message">
          <div className="no-cards-icon">📚</div>
          <h3>Loading flashcard...</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="flashcard-list-container-new">
      {/* Flashcard Display */}
      <div className="flashcard-display-container">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              duration: 0.15,
              ease: [0.4, 0.0, 0.2, 1]
            }}
            className="flashcard-slide-wrapper"
          >
            {currentFlashcard && (
              <Flashcard
                flashcard={currentFlashcard}
                isFlipped={isFlipped}
                onFlipChange={setIsFlipped}
                number={currentIndex + 1}
                total={filteredFlashcards.length}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flashcard-navigation-new">
        <button
          onClick={goToPrevious}
          disabled={currentIndex === 0}
          className="nav-button-new nav-button-prev"
        >
          <ChevronLeft size={20} />
          <span>Previous</span>
        </button>

        <div className="nav-center-new">
          <p className="nav-counter-new">
            {currentIndex + 1} of {filteredFlashcards.length}
          </p>
          <div className="nav-dots-new">
            {filteredFlashcards.map((_, index) => (
              <button
                key={index}
                onClick={() => goToCard(index)}
                className={`nav-dot-new ${index === currentIndex ? 'active' : ''}`}
              />
            ))}
          </div>
        </div>

        <button
          onClick={goToNext}
          disabled={currentIndex === filteredFlashcards.length - 1}
          className="nav-button-new nav-button-next"
        >
          <span>Next</span>
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Keyboard Shortcuts Hint */}
      <p className="flashcard-hint-footer">
        Click card to flip • Use arrows to navigate
      </p>
    </div>
  );
};

export default FlashcardList;
