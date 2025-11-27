# 🎓 Academic AI Assistant

An AI-powered platform for academic learning with document analysis, intelligent chat, and flashcard generation.

## ✨ Features

- **AI Chat**: Context-aware conversations with personalized responses
- **Document Processing**: Upload and analyze PDF, DOCX, PPTX files
- **Smart Flashcards**: AI-generated study materials from your content
- **Google Auth**: Secure sign-in with automatic data sync
- **Auto-Cleanup**: 24-hour data expiration for privacy

## 🚀 Quick Start

1. **Install dependencies:**
```bash
npm install
```

2. **Set up environment variables:**
Create `.env` file with Firebase and Google API keys

3. **Start development:**
```bash
npm run dev
```

4. **Build for production:**
```bash
npm run build
```

## 🧪 Testing

This project uses [Vitest](https://vitest.dev/) for unit testing with React Testing Library for component testing.

### Running Tests

**Run tests in watch mode (recommended for development):**
```bash
npm test
```

**Run tests once:**
```bash
npm run test:run
```

**Run tests with UI (interactive test runner):**
```bash
npm run test:ui
```

### Test Structure

Tests are organized alongside the source code:
- Utility tests: `src/utils/__tests__/`
- Service tests: `src/services/__tests__/`
- Component tests: `src/components/__tests__/`

### Writing Tests

Example test file structure:
```typescript
import { describe, it, expect } from 'vitest'
import { myFunction } from '../myModule'

describe('myModule', () => {
  it('should do something', () => {
    expect(myFunction()).toBe(expectedValue)
  })
})
```

For component tests, use React Testing Library:
```typescript
import { render, screen } from '@testing-library/react'
import MyComponent from '../MyComponent'

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })
})
```

### Test Coverage

The project includes unit tests for:
- ✅ Utility functions (file validation, markdown rendering)
- ✅ Service modules (flashcard service)
- ✅ React components (Flashcard component)

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Firebase (Firestore + Auth)
- **AI**: Google Gemini API
- **Document Processing**: PDF.js, Mammoth.js, PPTX Parser

## 📱 Usage

1. Sign in with Google
2. Upload documents (PDF, DOCX, PPTX)
3. Chat with AI about your content
4. Generate flashcards for studying
5. Data automatically syncs across devices

## 🚀 Deployment

**Firebase Hosting:**
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
npm run build
firebase deploy
```
