import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ModelPreference } from '../services/firebaseAILogicService';
import { Lightbulb, ArrowRight } from '@solar-icons/react';
import './ModelSelector.css';

export interface AIModel {
  id: ModelPreference;
  name: string;
  description: string;
}

const availableModels: AIModel[] = [
  {
    id: 'auto',
    name: 'Gemini',
    description: 'Uses Gemini with automatic fallback to Groq'
  },
  {
    id: 'kimi2',
    name: 'KimiK2',
    description: 'Direct Groq KimiK2 model for fast responses'
  }
];

interface ModelSelectorProps {
  selectedModel: ModelPreference;
  onModelChange: (model: ModelPreference) => void;
  disabled?: boolean;
}

export function ModelSelector({ selectedModel, onModelChange, disabled = false }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelectModel = (model: AIModel) => {
    onModelChange(model.id);
    setIsOpen(false);
  };

  const currentModel = availableModels.find(m => m.id === selectedModel) || availableModels[0];

  return (
    <div className="model-selector-wrapper" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="model-selector-trigger"
      >
        <Lightbulb size={12} className="model-selector-icon" />
        <span className="model-selector-text">{currentModel.name}</span>
        <ArrowRight 
          size={12} 
          className={`model-selector-chevron ${isOpen ? 'open' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.15 }}
            className="model-selector-dropdown"
          >
            <div className="model-selector-menu">
              {availableModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => handleSelectModel(model)}
                  className={`model-selector-option ${
                    selectedModel === model.id ? 'selected' : ''
                  }`}
                >
                  <div className="model-selector-option-content">
                    <div className="model-selector-option-header">
                      <span className="model-selector-option-name">{model.name}</span>
                      {selectedModel === model.id && (
                        <span className="model-selector-check">✓</span>
                      )}
                    </div>
                    <p className="model-selector-option-description">
                      {model.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export { availableModels };

