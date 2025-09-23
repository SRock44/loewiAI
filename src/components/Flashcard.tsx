import React, { useState } from 'react';
import ReactCardFlip from 'react-card-flip';
import { Flashcard as FlashcardType } from '../types/flashcard';
import './Flashcard.css';

interface FlashcardProps {
  flashcard: FlashcardType;
  onMasteryUpdate?: (flashcardId: string, masteryLevel: number) => void;
  showControls?: boolean;
  className?: string;
  isFlipped?: boolean;
  onFlipChange?: (flipped: boolean) => void;
}

const Flashcard: React.FC<FlashcardProps> = ({ 
  flashcard, 
  onMasteryUpdate, 
  showControls = true,
  className = '',
  isFlipped: externalIsFlipped,
  onFlipChange
}) => {
  const [internalIsFlipped, setInternalIsFlipped] = useState(false);
  
  // Use external flip state if provided, otherwise use internal state
  const isFlipped = externalIsFlipped !== undefined ? externalIsFlipped : internalIsFlipped;

  const handleFlip = () => {
    const newFlippedState = !isFlipped;
    if (onFlipChange) {
      onFlipChange(newFlippedState);
    } else {
      setInternalIsFlipped(newFlippedState);
    }
  };

  const handleMasteryUpdate = (level: number) => {
    if (onMasteryUpdate) {
      onMasteryUpdate(flashcard.id, level);
    }
  };

  const getMasteryColor = (level: number) => {
    if (level === 1) return '#f44336'; // Red - Needs Review
    if (level === 2) return '#ffeb3b'; // Yellow - Needs Improvement
    if (level === 3) return '#4caf50'; // Green - Understand
    return '#e0e0e0'; // Gray - Default/Unassigned
  };

  const getMasteryLabel = (level: number) => {
    if (level === 1) return 'Needs Review';
    if (level === 2) return 'Needs Improvement';
    if (level === 3) return 'Understand';
    return 'Unassigned';
  };

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty) {
      case 'easy': return '#4caf50';
      case 'medium': return '#ff9800';
      case 'hard': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  return (
    <div className={`flashcard-container ${className}`}>
      <ReactCardFlip 
        isFlipped={isFlipped} 
        flipDirection="horizontal"
        flipSpeedBackToFront={0.6}
        flipSpeedFrontToBack={0.6}
      >
        {/* Front of card - Question */}
        <div className="flashcard flashcard-front" onClick={handleFlip}>
          <div className="flashcard-header">
            <div className="flashcard-meta">
              {flashcard.category && (
                <span className="flashcard-category">{flashcard.category}</span>
              )}
              {flashcard.difficulty && (
                <span 
                  className="flashcard-difficulty"
                  style={{ backgroundColor: getDifficultyColor(flashcard.difficulty) }}
                >
                  {flashcard.difficulty}
                </span>
              )}
            </div>
            <div className="flashcard-mastery">
              <div 
                className="mastery-indicator"
                style={{ 
                  backgroundColor: getMasteryColor(flashcard.masteryLevel),
                  color: flashcard.masteryLevel === 0 ? '#666' : 'white',
                  border: flashcard.masteryLevel === 0 ? '1px solid #ddd' : 'none'
                }}
              >
                {getMasteryLabel(flashcard.masteryLevel)}
              </div>
            </div>
          </div>
          
          <div className="flashcard-content">
            <div className="flashcard-icon">❓</div>
            <h3 className="flashcard-title">Question</h3>
            <p className="flashcard-text">{flashcard.question}</p>
          </div>
          
          <div className="flashcard-footer">
            <span className="flashcard-hint">Click to reveal answer</span>
          </div>
        </div>

        {/* Back of card - Answer */}
        <div className="flashcard flashcard-back" onClick={handleFlip}>
          <div className="flashcard-header">
            <div className="flashcard-meta">
              {flashcard.category && (
                <span className="flashcard-category">{flashcard.category}</span>
              )}
              {flashcard.difficulty && (
                <span 
                  className="flashcard-difficulty"
                  style={{ backgroundColor: getDifficultyColor(flashcard.difficulty) }}
                >
                  {flashcard.difficulty}
                </span>
              )}
            </div>
            <div className="flashcard-mastery">
              <div 
                className="mastery-indicator"
                style={{ 
                  backgroundColor: getMasteryColor(flashcard.masteryLevel),
                  color: flashcard.masteryLevel === 0 ? '#666' : 'white',
                  border: flashcard.masteryLevel === 0 ? '1px solid #ddd' : 'none'
                }}
              >
                {getMasteryLabel(flashcard.masteryLevel)}
              </div>
            </div>
          </div>
          
          <div className="flashcard-content">
            <div className="flashcard-icon">💡</div>
            <h3 className="flashcard-title">Answer</h3>
            <p className="flashcard-text">{flashcard.answer}</p>
          </div>
          
          <div className="flashcard-footer">
            {showControls && (
              <div className="mastery-controls">
                <span className="mastery-label">How well did you know this?</span>
                <div className="mastery-buttons">
                  {[
                    { level: 1, color: '#f44336' },
                    { level: 2, color: '#ffeb3b' },
                    { level: 3, color: '#4caf50' }
                  ].map(({ level, color }) => (
                    <button
                      key={level}
                      className={`mastery-btn ${flashcard.masteryLevel === level ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMasteryUpdate(level);
                      }}
                      style={{ 
                        backgroundColor: color,
                        opacity: flashcard.masteryLevel === level ? 1 : 0.6,
                        border: flashcard.masteryLevel === level ? '2px solid #333' : '2px solid transparent'
                      }}
                      title={getMasteryLabel(level)}
                    >
                    </button>
                  ))}
                </div>
              </div>
            )}
            <span className="flashcard-hint">Click to see question again</span>
          </div>
        </div>
      </ReactCardFlip>
    </div>
  );
};

export default Flashcard;
