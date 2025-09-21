import React, { useState } from 'react';
import { FlashcardSet } from '../types/flashcard';
import FlashcardList from './FlashcardList';
import './FlashcardModal.css';

interface FlashcardModalProps {
  isOpen: boolean;
  onClose: () => void;
  flashcardSets: FlashcardSet[];
  onSetUpdate?: (updatedSet: FlashcardSet) => void;
}

const FlashcardModal: React.FC<FlashcardModalProps> = ({
  isOpen,
  onClose,
  flashcardSets,
  onSetUpdate
}) => {
  const [selectedSetIndex, setSelectedSetIndex] = useState(0);

  if (!isOpen) return null;

  const currentSet = flashcardSets[selectedSetIndex];

  return (
    <div className="flashcard-modal-overlay" onClick={onClose}>
      <div className="flashcard-modal" onClick={(e) => e.stopPropagation()}>
        <button className="floating-close-btn" onClick={onClose}>
          ✕
        </button>
        
        <div className="flashcard-modal-content">
          {flashcardSets.length > 0 ? (
            <>
              {flashcardSets.length > 1 && (
                <div className="flashcard-set-selector">
                  <label>Select Flashcard Set:</label>
                  <select 
                    value={selectedSetIndex} 
                    onChange={(e) => setSelectedSetIndex(parseInt(e.target.value))}
                  >
                    {flashcardSets.map((set, index) => (
                      <option key={set.id} value={index}>
                        {set.title} ({set.flashcards.length} cards)
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              
              {currentSet && (
                <FlashcardList
                  flashcardSet={currentSet}
                  onSetUpdate={onSetUpdate}
                  showFilters={true}
                />
              )}
            </>
          ) : (
            <div className="no-flashcards">
              <p>No flashcards available in this session.</p>
              <p>Generate some flashcards by asking the AI to create them!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FlashcardModal;
