import React, { useState, useMemo } from 'react';
import Flashcard from './Flashcard';
import { Flashcard as FlashcardType, FlashcardSet } from '../types/flashcard';
import './FlashcardList.css';

interface FlashcardListProps {
  flashcardSet: FlashcardSet;
  onMasteryUpdate?: (flashcardId: string, masteryLevel: number) => void;
  onSetUpdate?: (updatedSet: FlashcardSet) => void;
  showFilters?: boolean;
}

const FlashcardList: React.FC<FlashcardListProps> = ({
  flashcardSet,
  onMasteryUpdate,
  onSetUpdate,
  showFilters = true
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all');
  const [filterMastery, setFilterMastery] = useState<string>('all');
  const [studyMode, setStudyMode] = useState<'sequential' | 'random' | 'weak'>('sequential');
  const [currentCardFlipped, setCurrentCardFlipped] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const getMasteryLabel = (level: number) => {
    if (level === 1) return 'Needs Review';
    if (level === 2) return 'Needs Improvement';
    if (level === 3) return 'Understand';
    return 'Unassigned';
  };

  const getMasteryColor = (level: number) => {
    if (level === 1) return '#f44336'; // Red
    if (level === 2) return '#ffeb3b'; // Yellow
    if (level === 3) return '#4caf50'; // Green
    return '#e0e0e0'; // Gray - Default/Unassigned
  };

  // Filter flashcards based on selected criteria
  const filteredFlashcards = useMemo(() => {
    let filtered = [...flashcardSet.flashcards];

    // Filter by difficulty
    if (filterDifficulty !== 'all') {
      filtered = filtered.filter(card => card.difficulty === filterDifficulty);
    }

    // Filter by mastery level
    if (filterMastery !== 'all') {
      if (filterMastery === 'needs-review') {
        filtered = filtered.filter(card => card.masteryLevel === 1);
      } else if (filterMastery === 'needs-improvement') {
        filtered = filtered.filter(card => card.masteryLevel === 2);
      } else if (filterMastery === 'understand') {
        filtered = filtered.filter(card => card.masteryLevel === 3);
      }
    }

    // Sort based on study mode
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

  const resetFilters = () => {
    setFilterDifficulty('all');
    setFilterMastery('all');
    setStudyMode('sequential');
    setCurrentIndex(0);
  };


  if (filteredFlashcards.length === 0) {
    return (
      <div className="flashcard-list-container">
        <div className="no-cards-message">
          <div className="no-cards-icon">📚</div>
          <h3>No flashcards match your filters</h3>
          <p>Try adjusting your filter settings above to see more cards.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flashcard-list-container">
      {showFilters && (
        <div className="flashcard-filters">
          <div className="filter-group">
            <label>Difficulty:</label>
            <select 
              value={filterDifficulty} 
              onChange={(e) => setFilterDifficulty(e.target.value)}
            >
              <option value="all">All</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Mastery:</label>
            <select 
              value={filterMastery} 
              onChange={(e) => setFilterMastery(e.target.value)}
            >
              <option value="all">All</option>
              <option value="needs-review">Needs Review</option>
              <option value="needs-improvement">Needs Improvement</option>
              <option value="understand">Understand</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Study Mode:</label>
            <select 
              value={studyMode} 
              onChange={(e) => setStudyMode(e.target.value as any)}
            >
              <option value="sequential">Sequential</option>
              <option value="random">Random</option>
              <option value="weak">Focus on Weak</option>
            </select>
          </div>
        </div>
      )}


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
