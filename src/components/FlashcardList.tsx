import { useState, useMemo } from 'react';
import Flashcard from './Flashcard';
import { FlashcardSet } from '../types/flashcard';
import './FlashcardList.css';

interface FlashcardListProps {
  flashcardSet: FlashcardSet;
  onMasteryUpdate?: (flashcardId: string, masteryLevel: number) => void;
  onSetUpdate?: (updatedSet: FlashcardSet) => void;
}

const FlashcardList: React.FC<FlashcardListProps> = ({
  flashcardSet,
  onMasteryUpdate,
  onSetUpdate
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  // Filter state variables kept for future implementation
  const [filterDifficulty] = useState<string>('all');
  const [filterMastery] = useState<string>('all');
  const [studyMode] = useState<'sequential' | 'random' | 'weak'>('sequential');
  const [currentCardFlipped, setCurrentCardFlipped] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);


  const getMasteryColor = (level: number) => {
    if (level === 1) return '#f44336'; // Red
    if (level === 2) return '#ffeb3b'; // Yellow
    if (level === 3) return '#4caf50'; // Green
    return '#e0e0e0'; // Gray - Default/Unassigned
  };

  // Filter flashcards based on selected criteria
  // Note: Filter logic is kept for future implementation of difficulty/mastery options
  const filteredFlashcards = useMemo(() => {
    let filtered = [...flashcardSet.flashcards];

    // Filter by difficulty (currently shows all, but logic preserved)
    if (filterDifficulty !== 'all') {
      filtered = filtered.filter(card => card.difficulty === filterDifficulty);
    }

    // Filter by mastery level (currently shows all, but logic preserved)
    if (filterMastery !== 'all') {
      if (filterMastery === 'needs-review') {
        filtered = filtered.filter(card => card.masteryLevel === 1);
      } else if (filterMastery === 'needs-improvement') {
        filtered = filtered.filter(card => card.masteryLevel === 2);
      } else if (filterMastery === 'understand') {
        filtered = filtered.filter(card => card.masteryLevel === 3);
      }
    }

    // Sort based on study mode (currently sequential, but logic preserved)
    switch (studyMode) {
      case 'random':
        return filtered.sort(() => Math.random() - 0.5);
      case 'weak':
        return filtered.sort((a, b) => a.masteryLevel - b.masteryLevel);
      default:
        return filtered;
    }
  }, [flashcardSet.flashcards, filterDifficulty, filterMastery, studyMode]);

  const currentFlashcard = filteredFlashcards[currentIndex];

  const handleMasteryUpdate = (flashcardId: string, masteryLevel: number) => {
    const updatedFlashcards = flashcardSet.flashcards.map(card =>
      card.id === flashcardId
        ? { ...card, masteryLevel, lastReviewed: new Date(), reviewCount: card.reviewCount + 1 }
        : card
    );

    const updatedSet: FlashcardSet = {
      ...flashcardSet,
      flashcards: updatedFlashcards,
      updatedAt: new Date()
    };

    if (onSetUpdate) {
      onSetUpdate(updatedSet);
    }

    if (onMasteryUpdate) {
      onMasteryUpdate(flashcardId, masteryLevel);
    }
  };

  const goToNext = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentCardFlipped(true); // Start flip animation
    
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % filteredFlashcards.length);
      setCurrentCardFlipped(false);
      setIsTransitioning(false);
    }, 300); // Half of the flip animation duration
  };

  const goToPrevious = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentCardFlipped(true); // Start flip animation
    
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + filteredFlashcards.length) % filteredFlashcards.length);
      setCurrentCardFlipped(false);
      setIsTransitioning(false);
    }, 300); // Half of the flip animation duration
  };

  const goToCard = (index: number) => {
    if (isTransitioning || index === currentIndex) return;
    setIsTransitioning(true);
    setCurrentCardFlipped(true); // Start flip animation
    
    setTimeout(() => {
      setCurrentIndex(index);
      setCurrentCardFlipped(false);
      setIsTransitioning(false);
    }, 300); // Half of the flip animation duration
  };




  if (filteredFlashcards.length === 0) {
    return (
      <div className="flashcard-list-container">
        <div className="no-cards-message">
          <div className="no-cards-icon">📚</div>
          <h3>No flashcards available</h3>
          <p>No flashcards in this set.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flashcard-list-container">


      <div className="flashcard-display">
        <div className="flashcard-navigation-container">
          <button 
            className={`nav-arrow nav-arrow-left ${isTransitioning ? 'transitioning' : ''}`}
            onClick={goToPrevious}
            disabled={filteredFlashcards.length <= 1 || isTransitioning}
          >
            ←
          </button>
          
          {currentFlashcard && (
            <Flashcard
              flashcard={currentFlashcard}
              onMasteryUpdate={handleMasteryUpdate}
              showControls={true}
              isFlipped={currentCardFlipped}
              onFlipChange={setCurrentCardFlipped}
            />
          )}
          
          <button 
            className={`nav-arrow nav-arrow-right ${isTransitioning ? 'transitioning' : ''}`}
            onClick={goToNext}
            disabled={filteredFlashcards.length <= 1 || isTransitioning}
          >
            →
          </button>
        </div>

        <div className="card-thumbnails">
          {filteredFlashcards.map((card, index) => (
            <button
              key={card.id}
              className={`thumbnail ${index === currentIndex ? 'active' : ''} ${isTransitioning ? 'transitioning' : ''}`}
              onClick={() => goToCard(index)}
              disabled={isTransitioning}
              title={`Card ${index + 1}: ${card.question.substring(0, 50)}...`}
              style={{ 
                backgroundColor: getMasteryColor(card.masteryLevel),
                border: card.masteryLevel === 0 ? '2px solid #ddd' : '2px solid transparent'
              }}
            >
              <div className="thumbnail-number">
                {index + 1}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FlashcardList;
