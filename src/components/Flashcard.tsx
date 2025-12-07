import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Flashcard as FlashcardType } from '../types/flashcard';
import { renderMarkdownSafe } from '../utils/markdownRenderer';
import './Flashcard.css';

interface FlashcardProps {
  flashcard: FlashcardType;
  className?: string;
  isFlipped?: boolean;
  onFlipChange?: (flipped: boolean) => void;
  number?: number;
  total?: number;
}

const Flashcard: React.FC<FlashcardProps> = ({ 
  flashcard, 
  className = '',
  isFlipped: externalIsFlipped,
  onFlipChange,
  number,
  total
}) => {
  const [internalIsFlipped, setInternalIsFlipped] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Use external flip state if provided, otherwise use internal state
  const isFlipped = externalIsFlipped !== undefined ? externalIsFlipped : internalIsFlipped;

  const handleScroll = () => {
    setIsScrolling(true);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 200);
  };

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const handleFlip = () => {
    // Don't flip if scrolling
    if (isScrolling) {
      return;
    }
    const newFlippedState = !isFlipped;
    if (onFlipChange) {
      onFlipChange(newFlippedState);
    } else {
      setInternalIsFlipped(newFlippedState);
    }
  };

  const getDifficultyDisplay = (difficulty?: string): 'Easy' | 'Medium' | 'Hard' => {
    if (!difficulty) return 'Medium';
    const lower = difficulty.toLowerCase();
    if (lower === 'easy') return 'Easy';
    if (lower === 'hard') return 'Hard';
    return 'Medium';
  };

  const difficulty = getDifficultyDisplay(flashcard.difficulty);
  const difficultyColors = {
    Easy: 'bg-green-100 text-green-700',
    Medium: 'bg-yellow-100 text-yellow-700',
    Hard: 'bg-red-100 text-red-700'
  };

  const cardNumber = number !== undefined ? number : 1;
  const cardTotal = total !== undefined ? total : 1;

  return (
    <div className={`flashcard-wrapper ${className}`}>
      <motion.div
        className="flashcard-motion-container"
        onClick={handleFlip}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: "spring", stiffness: 100 }}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Front Side - Question */}
        <div
          className="flashcard flashcard-front"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
        >
          {/* Header */}
          <div className="flashcard-header-new">
            {number !== undefined && total !== undefined && (
              <span className="flashcard-number">Question {cardNumber} of {cardTotal}</span>
            )}
            <span className={`flashcard-difficulty-badge ${difficultyColors[difficulty]}`}>
              {difficulty}
            </span>
          </div>

          {/* Question Content */}
          <div className="flashcard-content-new" onScroll={handleScroll}>
            <div 
              className="flashcard-text-new" 
              dangerouslySetInnerHTML={{ __html: renderMarkdownSafe(flashcard.question || '') }}
            />
          </div>

          {/* Footer */}
          <div className="flashcard-footer-new">
            <span className="flashcard-hint-new">Click to reveal answer</span>
          </div>
        </div>

        {/* Back Side - Answer */}
        <div
          className="flashcard flashcard-back"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          {/* Header */}
          <div className="flashcard-header-new">
            {number !== undefined && total !== undefined && (
              <span className="flashcard-number">Answer {cardNumber} of {cardTotal}</span>
            )}
            <span className={`flashcard-difficulty-badge ${difficultyColors[difficulty]}`}>
              {difficulty}
            </span>
          </div>

          {/* Answer Content */}
          <div className="flashcard-content-new" onScroll={handleScroll}>
            <div 
              className="flashcard-text-new" 
              dangerouslySetInnerHTML={{ __html: renderMarkdownSafe(flashcard.answer || '') }}
            />
          </div>

          {/* Footer - Identical to question side */}
          <div className="flashcard-footer-new">
            <span className="flashcard-hint-new">Click to see question</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Flashcard;
