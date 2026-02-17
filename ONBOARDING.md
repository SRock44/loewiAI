# Onboarding Guide: Academic AI Assistant

Welcome! This guide will help you understand the codebase structure, architecture, and how to work with it effectively.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture Overview](#architecture-overview)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Core Concepts](#core-concepts)
6. [Key Services & Their Responsibilities](#key-services--their-responsibilities)
7. [Data Flow](#data-flow)
8. [Authentication & Data Persistence](#authentication--data-persistence)
9. [AI Integration](#ai-integration)
10. [Development Workflow](#development-workflow)
11. [Common Tasks](#common-tasks)
12. [Important Patterns & Conventions](#important-patterns--conventions)
13. [Testing](#testing)
14. [Troubleshooting](#troubleshooting)

---

## Project Overview

**Academic AI Assistant** is a React-based web application that helps students learn by:
- Uploading and analyzing academic documents (PDF, DOCX, PPTX)
- Having context-aware conversations with AI about those documents
- Generating flashcards from documents or text
- Tracking learning progress with a mastery system

**Key Features:**
- Multi-model AI support (Google Gemini, Groq KimiK2) with automatic fallback
- Document processing entirely client-side (privacy-focused)
- Real-time sync across devices via Firebase (when authenticated)
- Local storage fallback for unauthenticated users
- Multi-session chat management
- Flashcard generation and study system

---

## Architecture Overview

This is a **single-page application (SPA)** built with React and TypeScript, using Firebase for backend services.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React UI Layer                       │
│  (Components: ChatInterface, Dashboard, FlashcardList)  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  Service Layer                          │
│  (chatService, flashcardService, documentProcessor)     │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
┌─────────────────┐    ┌──────────────────────┐
│  Firebase       │    │  AI Providers        │
│  (Auth, DB)     │    │  (Gemini, Groq)      │
└─────────────────┘    └──────────────────────┘
```

### Key Architectural Patterns

1. **Service Layer Pattern**: Business logic lives in service classes (not components)
2. **Singleton Services**: Services are exported as singleton instances
3. **Context API**: Authentication state shared via React Context
4. **Ref-based Communication**: Parent-child communication via refs (App ↔ Dashboard ↔ ChatInterface)
5. **Client-Side Processing**: Documents processed entirely in browser (no server uploads)

---

## Tech Stack

### Frontend
- **React 18** - UI framework with hooks
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **Framer Motion** - Animations

### Backend & Services
- **Firebase Firestore** - NoSQL database
- **Firebase Authentication** - Google OAuth
- **Firebase Hosting** - Static hosting

### AI & Processing
- **Google Gemini API** (`@google/generative-ai`) - Primary AI model
- **Groq API** (`groq-sdk`) - Secondary AI model (fallback)
- **PDF.js** - PDF text extraction
- **Mammoth.js** - DOCX text extraction
- **PPTX Parser** - PowerPoint text extraction

### UI Libraries
- **Framer Motion** - Animations
- **Prism.js** - Code syntax highlighting
- **KaTeX** - Math rendering
- **Solar Icons** - Icon library
- **React Card Flip** - Flashcard flip animations

### Testing
- **Vitest** - Test runner
- **React Testing Library** - Component testing

---

## Project Structure

```
src/
├── components/          # React UI components
│   ├── ChatInterface.tsx      # Main chat UI (messages, input, document upload)
│   ├── DocumentUpload.tsx     # Document upload component
│   ├── Flashcard.tsx          # Individual flashcard component
│   ├── FlashcardList.tsx      # Flashcard set management
│   ├── DocumentList.tsx       # List of uploaded documents
│   ├── ModelSelector.tsx      # AI model selection dropdown
│   ├── Layout.tsx             # Main app layout (sidebar, header)
│   ├── Header.tsx             # App header with auth controls
│   ├── Hero.tsx               # Landing page hero section
│   ├── Features.tsx           # Landing page features section
│   └── ...
│
├── services/           # Core business logic (singleton services)
│   ├── chatService.ts              # Chat message handling, AI integration
│   ├── documentProcessor.ts        # Document text extraction (PDF, DOCX, PPTX)
│   ├── flashcardService.ts         # Flashcard generation and management
│   ├── firebaseAILogicService.ts   # Multi-model AI integration (Gemini & Groq)
│   ├── firebaseService.ts          # Firebase Firestore operations
│   ├── firebaseAuthService.ts      # Firebase Authentication wrapper
│   ├── aiService.ts                # Legacy AI service (mostly unused)
│   ├── apiService.ts               # API utilities
│   └── ...
│
├── contexts/           # React context providers
│   └── AuthContext.tsx        # Authentication state management
│
├── hooks/              # Custom React hooks
│   ├── useChatSessions.ts     # Chat session management hook
│   └── useAllFlashcards.ts    # Flashcard aggregation hook
│
├── pages/              # Page components
│   └── Dashboard.tsx          # Main dashboard page (wraps ChatInterface)
│
├── types/              # TypeScript type definitions
│   ├── chat.ts                # Chat-related types
│   ├── flashcard.ts           # Flashcard types
│   ├── ai.ts                  # AI service types
│   └── auth.ts                # Authentication types
│
├── utils/              # Utility functions
│   ├── fileValidation.ts      # File type and size validation
│   └── markdownRenderer.ts     # Markdown to HTML conversion
│
├── App.tsx             # Root component (routing, layout)
├── main.tsx            # Application entry point
└── firebase-config.ts  # Firebase initialization
```

---

## Core Concepts

### 1. Chat Sessions

A **chat session** is a conversation thread. Users can have multiple sessions, each with its own:
- Message history
- Associated documents
- AI model preference
- Last activity timestamp

**Storage:**
- Authenticated: Firebase Firestore (`chatSessions` collection)
- Unauthenticated: localStorage (24-hour expiration)

**Key Files:**
- `src/services/chatService.ts` - Session management
- `src/types/chat.ts` - Type definitions
- `src/hooks/useChatSessions.ts` - React hook for sessions

### 2. Document Processing

Documents are processed **entirely client-side** for privacy. The flow:

1. User uploads file → `DocumentUpload` or `ChatInterface`
2. File validated → `fileValidation.ts`
3. Text extracted → `documentProcessor.ts` (uses PDF.js, Mammoth, PPTX Parser)
4. Content chunked → Split into ~2000 char chunks for AI processing
5. Metadata generated → Summary, key topics, difficulty assessment
6. Stored in memory → Available for chat context

**Key Files:**
- `src/services/documentProcessor.ts` - Extraction logic
- `src/utils/fileValidation.ts` - File validation

### 3. AI Integration

The app supports **multiple AI providers** with automatic fallback:

- **Primary**: Google Gemini (`gemini-2.5-flash`, `gemini-2.0-flash`)
- **Fallback**: Groq KimiK2 (`moonshotai/kimi-k2-instruct-0905`)

**Fallback Triggers:**
- Rate limit errors (429)
- Quota errors (403)
- Server errors (500, 503)

**Key Files:**
- `src/services/firebaseAILogicService.ts` - AI provider management
- `src/components/ModelSelector.tsx` - UI for model selection

### 4. Flashcards

**Storage:**
- Authenticated: Firebase Firestore (`flashcardSets` collection)
- Unauthenticated: localStorage (24-hour expiration)

**Key Files:**
- `src/services/flashcardService.ts` - Generation and management
- `src/components/Flashcard.tsx` - UI component
- `src/types/flashcard.ts` - Type definitions

### 5. Authentication

**Google Sign-In** via Firebase Authentication.

**Data Persistence:**
- **Authenticated**: All data in Firebase (syncs across devices)
- **Unauthenticated**: Data in localStorage (24-hour expiration, no sync)

**Key Files:**
- `src/services/firebaseAuthService.ts` - Auth operations
- `src/contexts/AuthContext.tsx` - React context for auth state

**TODO** 
- Add mobile number account creation, github, microsoft etc; the more the merrier and the more users we can serve. Just keep it clean and neat for the user.

---

## Key Services & Their Responsibilities

### `chatService.ts`

**Purpose**: Main chat orchestration service

**Responsibilities:**
- Managing chat sessions (create, load, delete, switch)
- Handling message sending/receiving
- Building document context for AI
- Detecting flashcard generation requests
- Coordinating with AI service
- Syncing with Firebase (authenticated) or localStorage (unauthenticated)

**Key Methods:**
- `sendMessage(message, context)` - Send message to AI
- `createSession()` - Create new chat session
- `loadSessions()` - Load user's sessions
- `deleteSession(sessionId)` - Delete a session

**Singleton**: `export const chatService = new GeminiChatService()`

### `firebaseAILogicService.ts`

**Purpose**: Multi-model AI provider manager

**Responsibilities:**
- Managing AI providers (Gemini, Groq)
- Routing requests to selected provider
- Handling automatic fallback on errors
- Generating responses and flashcards
- Managing model preferences

**Key Methods:**
- `generateResponse(message, context, history)` - Get AI response
- `generateFlashcards(prompt)` - Generate flashcards
- `setModelPreference(preference)` - Set user's model choice
- `selectBestProvider()` - Choose provider based on preference/availability

**Singleton**: `export const firebaseAILogicService = new FirebaseAILogicService()`

### `documentProcessor.ts`

**Purpose**: Extract text from uploaded documents

**Responsibilities:**
- Detecting file type (PDF, DOCX, PPTX)
- Extracting text using appropriate library
- Chunking large documents
- Generating summaries and key topics
- Handling extraction failures gracefully

**Key Methods:**
- `processDocument(file)` - Main entry point
- `extractFromPDF(file)` - PDF extraction
- `extractFromWord(file)` - DOCX extraction
- `extractFromPowerPoint(file)` - PPTX extraction
- `chunkText(text)` - Split into chunks

**Singleton**: `export const documentProcessor = DocumentProcessor.getInstance()`

### `flashcardService.ts`

**Purpose**: Flashcard generation and management

**Responsibilities:**
- Generating flashcards from documents or text
- Building AI prompts for flashcard generation
- Parsing AI JSON responses
- Managing flashcard sets
- Updating mastery levels
- Syncing with Firebase/localStorage

**Key Methods:**
- `generateFlashcards(request, document)` - Generate from document
- `generateFlashcardsFromText(request)` - Generate from text
- `createFlashcardSet(...)` - Create a set
- `updateFlashcardMastery(id, level)` - Update mastery

**Singleton**: `export const flashcardService = new RealFlashcardService()`

### `firebaseService.ts`

**Purpose**: Firebase Firestore operations

**Responsibilities:**
- CRUD operations for chat sessions
- CRUD operations for flashcard sets
- Real-time listeners for cross-device sync
- User profile management

**Key Methods:**
- `saveChatSession(session)` - Save session
- `getChatSessions(userId)` - Get user's sessions
- `subscribeToChatSessions(userId, callback)` - Real-time updates
- `saveFlashcardSet(set)` - Save flashcard set

### `firebaseAuthService.ts`

**Purpose**: Firebase Authentication wrapper

**Responsibilities:**
- Google sign-in flow
- Sign out
- Auth state listeners
- Current user retrieval

**Key Methods:**
- `signInWithGoogle()` - Initiate Google OAuth
- `signOut()` - Sign out user
- `onAuthStateChange(callback)` - Listen for auth changes
- `getCurrentUser()` - Get current user

---

## Data Flow

### Sending a Chat Message

```
User types message
    ↓
ChatInterface.handleSendMessage()
    ↓
chatService.sendMessage(message, context)
    ↓
chatService.buildDocumentContext()  // Build context from uploaded docs
    ↓
firebaseAILogicService.generateResponse(message, context, history)
    ↓
AI Provider (Gemini or Groq) → API call
    ↓
Response received → Parse and format
    ↓
chatService saves message to session
    ↓
ChatInterface updates UI with new message
```

### Uploading a Document

```
User selects file
    ↓
ChatInterface.handleFileUpload()
    ↓
fileValidation.validateFile()  // Check type, size
    ↓
documentProcessor.processDocument(file)
    ↓
Extract text (PDF.js / Mammoth / PPTX Parser)
    ↓
Chunk text, generate summary, extract topics
    ↓
Return ProcessedDocument
    ↓
ChatInterface adds to documents array
    ↓
Document available for chat context
```

### Generating Flashcards

```
User requests flashcards (via chat or explicit request)
    ↓
chatService.detectFlashcardRequest()  // Detects intent
    ↓
flashcardService.generateFlashcards(request, document)
    ↓
flashcardService.buildFlashcardPrompt()  // Build AI prompt
    ↓
firebaseAILogicService.generateFlashcards(prompt)
    ↓
AI returns JSON with flashcards
    ↓
flashcardService.parseFlashcardResponse()  // Parse JSON
    ↓
flashcardService.createFlashcardSet()  // Create set
    ↓
Save to Firebase/localStorage
    ↓
FlashcardList updates UI
```

---

## Authentication & Data Persistence

### Authentication Flow

1. User clicks "Sign in with Google"
2. `AuthContext.signInWithGoogle()` called
3. `firebaseAuthService.signInWithGoogle()` opens OAuth popup
4. Firebase handles OAuth flow
5. Auth state changes → `AuthContext` updates
6. Services detect auth change → Load user data from Firebase

### Data Storage Strategy

**Authenticated Users:**
- All data in Firebase Firestore
- Real-time sync across devices
- No expiration (data persists)

**Unauthenticated Users:**
- Data in browser localStorage
- 24-hour expiration (automatic cleanup)
- No cross-device sync

### Service Auth Integration

Services listen to auth state changes:

```typescript
// Example from chatService.ts
firebaseAuthService.onAuthStateChange((user) => {
  if (user) {
    this.currentUserId = user.id;
    this.loadSessionsFromFirebase();
  } else {
    this.currentUserId = null;
    this.sessions.clear();
  }
});
```

---

## AI Integration

### Provider Architecture

The AI system uses a **provider pattern**:

```
FirebaseAILogicService (Manager)
    ├── FirebaseAILogicProvider (Gemini)
    └── GroqProvider (Groq)
```

### Model Selection

Users can select their preferred model via `ModelSelector`:
- **Gemini (Auto)** - Primary with automatic fallback
- **KimiK2** - Direct Groq model

Preference stored in `localStorage` (key: `aiModelPreference`).

### Automatic Fallback

When an API error occurs:
1. Error detected (429, 403, 500, 503)
2. Service automatically tries fallback provider
3. User sees no interruption (transparent fallback)
4. Error logged for debugging

### Prompt Building

The service builds academic-focused prompts:
- Includes document context
- Includes conversation history
- Includes user profile (if available)
- Optimized for educational content

---

## Development Workflow

### Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create `.env` file:
   ```env
   VITE_FIREBASE_API_KEY=your_key
   VITE_FIREBASE_AUTH_DOMAIN=your_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_GEMINI_API_KEY=your_gemini_key
   VITE_GROQ_API_KEY=your_groq_key
   ```

3. **Start dev server:**
   ```bash
   npm run dev
   ```

4. **Build for production:**
   ```bash
   npm run build
   ```

### Code Organization Principles

1. **Services are singletons** - Export single instance
2. **Business logic in services** - Components are thin
3. **Type safety** - Use TypeScript types from `types/`
4. **Client-side processing** - No server uploads
5. **Graceful degradation** - Handle failures gracefully

### Adding a New Feature

1. **Define types** in `src/types/`
2. **Create service** in `src/services/` (if needed)
3. **Create component** in `src/components/`
4. **Add route** in `src/App.tsx` (if new page)
5. **Update Firebase rules** if new data structure

---

## Common Tasks

### Adding a New AI Provider

1. Create provider class implementing `AIProvider` interface:
   ```typescript
   class NewProvider implements AIProvider {
     name = 'New Provider';
     async generateResponse(...) { ... }
     async generateFlashcards(...) { ... }
     isAvailable() { ... }
   }
   ```

2. Register in `firebaseAILogicService.ts`:
   ```typescript
   private providers: AIProvider[] = [
     new FirebaseAILogicProvider(...),
     new GroqProvider(...),
     new NewProvider(...)  // Add here
   ];
   ```

3. Add to model selector UI in `ModelSelector.tsx`

### Adding a New Document Format

1. Add extraction method in `documentProcessor.ts`:
   ```typescript
   private async extractFromNewFormat(file: File): Promise<string> {
     // Extraction logic
   }
   ```

2. Add to `processDocument()` method:
   ```typescript
   if (file.name.endsWith('.newformat')) {
     extractedContent = await this.extractFromNewFormat(file);
   }
   ```

3. Update `fileValidation.ts` to accept new MIME type

### Adding a New Chat Feature

1. Add to `ChatMessage` type in `src/types/chat.ts`
2. Update `chatService.ts` to handle new feature
3. Update `ChatInterface.tsx` UI
4. Update Firebase rules if new data structure

### Debugging AI Responses

1. Check browser console for AI service logs
2. Check `firebaseAILogicService.ts` for error handling
3. Verify API keys in `.env`
4. Check network tab for API requests/responses

---

## Important Patterns & Conventions

### Service Pattern

All services are **singletons**:

```typescript
class MyService {
  private static instance: MyService;
  static getInstance() {
    if (!MyService.instance) {
      MyService.instance = new MyService();
    }
    return MyService.instance;
  }
}
export const myService = MyService.getInstance();
```

### Component Communication

**Parent → Child**: Via refs (imperative handle)

```typescript
// Parent
const childRef = useRef<ChildRef>(null);
childRef.current?.doSomething();

// Child
useImperativeHandle(ref, () => ({
  doSomething: () => { ... }
}));
```

**Child → Parent**: Via callbacks

```typescript
// Parent
<Child onSomething={(data) => handleData(data)} />

// Child
props.onSomething(data);
```

### Error Handling

Services handle errors gracefully:

```typescript
try {
  // Operation
} catch (error) {
  console.error('❌ Error:', error);
  // Return fallback or throw
}
```

### Logging Conventions

- `✅` - Success
- `❌` - Error
- `🔐` - Auth-related
- `👤` - User-related
- `📄` - Document-related
- `💬` - Chat-related

### Type Definitions

All types live in `src/types/`:
- `chat.ts` - Chat types
- `flashcard.ts` - Flashcard types
- `ai.ts` - AI types
- `auth.ts` - Auth types

---

## Testing

### Running Tests

```bash
npm test              # Watch mode
npm run test:run      # Run once
npm run test:ui       # Interactive UI
npm run test:coverage # With coverage
```

### Test Structure

Tests mirror source structure:
```
tests/
├── components/
│   ├── Flashcard.test.tsx
│   └── FlashcardList.test.tsx
├── services/
│   ├── documentProcessor.test.ts
│   └── flashcardService.test.ts
└── utils/
    ├── fileValidation.test.ts
    └── markdownRenderer.test.ts
```

### Writing Tests

**Service Test Example:**
```typescript
import { describe, it, expect } from 'vitest';
import { myService } from '../services/myService';

describe('myService', () => {
  it('should do something', () => {
    const result = myService.doSomething();
    expect(result).toBe(expected);
  });
});
```

**Component Test Example:**
```typescript
import { render, screen } from '@testing-library/react';
import MyComponent from '../MyComponent';

describe('MyComponent', () => {
  it('should render', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

---

## Troubleshooting

### Common Issues

**1. AI not responding**
- Check API keys in `.env`
- Check browser console for errors
- Verify network requests in DevTools
- Check if fallback provider is being used

**2. Documents not processing**
- Check file type is supported (PDF, DOCX, PPTX)
- Check file size (max 50MB)
- Check browser console for extraction errors
- Verify PDF.js worker is loaded (`/pdf.worker.min.mjs`)

**3. Firebase errors**
- Verify Firebase config in `.env`
- Check Firebase console for project setup
- Verify Firestore rules allow access
- Check authentication state

**4. Build errors**
- Run `npm install` to ensure dependencies
- Check TypeScript errors: `npm run build`
- Verify all environment variables set
- Check for missing type definitions

**5. Flashcard generation failing**
- Check AI response format (should be JSON)
- Verify document was processed successfully
- Check browser console for parsing errors
- Verify AI provider is available

### Debugging Tips

1. **Enable verbose logging**: Check service files for `console.log` statements
2. **Check React DevTools**: Inspect component state and props
3. **Check Firebase Console**: Verify data is being saved
4. **Check Network Tab**: Inspect API requests/responses
5. **Check localStorage**: Inspect stored data (unauthenticated users)

---

## Additional Resources

- **README.md** - Project overview and features
- **TO_DO.md** - Planned features and improvements
- **DOCUMENT_INTEGRATION.md** - Document processing details
- **PHASE1_OPTIMIZATION_RESULTS.md** - Performance optimizations

---
