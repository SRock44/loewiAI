# Academic AI Assistant

An AI-powered platform for academic learning with document analysis, intelligent chat, and flashcard generation. Built with React, TypeScript, Firebase, and multi-model AI support (Google Gemini and Groq KimiK2).

## Features

### AI-Powered Chat
- **Context-aware conversations** with personalized responses based on uploaded documents
- **Multi-session management** - Create and switch between multiple chat sessions
- **Document context integration** - AI understands and references uploaded documents
- **Code execution guidance** - Get help with programming questions and code validation
- **Real-time synchronization** - Chat sessions sync across devices via Firebase

**Implementation:** 
- Core chat logic: [`src/services/chatService.ts`](src/services/chatService.ts)
- UI component: [`src/components/ChatInterface.tsx`](src/components/ChatInterface.tsx)
- AI integration: [`src/services/firebaseAILogicService.ts`](src/services/firebaseAILogicService.ts)
- Session management: [`src/services/firebaseService.ts`](src/services/firebaseService.ts)

### Multi-Model AI Support
- **Gemini (Auto)** - Primary AI model with automatic fallback to Groq on errors
- **KimiK2** - Direct Groq Moonshot AI model for fast responses
- **Automatic fallback** - Seamlessly switches between models on API errors (429, 403, 500, 503)
- **Model selection** - Users can choose their preferred AI model before starting a chat
- **Transparent switching** - Fallback happens automatically without user intervention

**Implementation:**
- AI service manager: [`src/services/firebaseAILogicService.ts`](src/services/firebaseAILogicService.ts)
- Gemini provider: [`src/services/firebaseAILogicService.ts:FirebaseAILogicProvider`](src/services/firebaseAILogicService.ts#L25)
- Groq provider: [`src/services/firebaseAILogicService.ts:GroqProvider`](src/services/firebaseAILogicService.ts#L497)
- Model selector UI: [`src/components/ModelSelector.tsx`](src/components/ModelSelector.tsx)

**Supported Models:**
- **Gemini**: `gemini-2.5-flash`, `gemini-2.5-flash-001`, `gemini-2.0-flash-001`, `gemini-2.0-flash`
- **Groq**: `moonshotai/kimi-k2-instruct-0905` (KimiK2), `moonshot-v1-128k` (fallback)

### Document Processing
- **Multi-format support**: PDF, DOCX, PPTX files
- **Intelligent text extraction** using specialized libraries
- **Content analysis** - Automatic summarization and key topic extraction
- **Chunking system** - Documents split into manageable chunks for AI processing
- **Fallback handling** - Graceful degradation when extraction fails

**Supported Formats:**
- **PDF**: Text extraction using PDF.js ([`src/services/documentProcessor.ts:extractFromPDF`](src/services/documentProcessor.ts))
- **DOCX**: Text extraction using Mammoth.js ([`src/services/documentProcessor.ts:extractFromWord`](src/services/documentProcessor.ts))
- **PPTX**: Text extraction using PPTX Parser ([`src/services/documentProcessor.ts:extractFromPowerPoint`](src/services/documentProcessor.ts))

**Implementation:**
- Document processor: [`src/services/documentProcessor.ts`](src/services/documentProcessor.ts)
- Upload component: [`src/components/DocumentUpload.tsx`](src/components/DocumentUpload.tsx)
- File validation: [`src/utils/fileValidation.ts`](src/utils/fileValidation.ts)
- Integration: [`src/services/aiService.ts`](src/services/aiService.ts)

### Smart Flashcards
- **AI-generated flashcards** from documents or text input
- **Mastery tracking** - Track your understanding with 3-level mastery system
- **Personalized generation** - Flashcards adapt to user profile and preferences
- **Multiple formats** - Q&A, definitions, or concept-based cards
- **Difficulty levels** - Easy, medium, or hard flashcards
- **Category organization** - Automatic categorization by topic

**Implementation:**
- Flashcard service: [`src/services/flashcardService.ts`](src/services/flashcardService.ts)
- Generation logic: [`src/services/flashcardService.ts:generateFlashcards`](src/services/flashcardService.ts)
- UI component: [`src/components/Flashcard.tsx`](src/components/Flashcard.tsx)
- List management: [`src/components/FlashcardList.tsx`](src/components/FlashcardList.tsx)
- Storage: [`src/services/firebaseService.ts`](src/services/firebaseService.ts) (authenticated) or localStorage (unauthenticated)

### Authentication & Data Sync
- **Google Sign-In** - Secure authentication via Firebase Auth
- **Automatic data sync** - All data syncs across devices when authenticated
- **Offline support** - Local storage fallback for unauthenticated users
- **Session persistence** - Chat sessions and flashcards persist across sessions

**Implementation:**
- Auth service: [`src/services/firebaseAuthService.ts`](src/services/firebaseAuthService.ts)
- Auth context: [`src/contexts/AuthContext.tsx`](src/contexts/AuthContext.tsx)
- Firebase config: [`src/firebase-config.ts`](src/firebase-config.ts)
- Data service: [`src/services/firebaseService.ts`](src/services/firebaseService.ts)

### Automatic Cleanup
- **24-hour data expiration** - Automatic deletion of old data for privacy
- **Background cleanup** - Runs hourly to remove expired content
- **Selective cleanup** - Only removes data older than 24 hours
- **Silent operation** - Runs automatically without user intervention

**Implementation:**
- Cleanup service: [`src/services/automaticCleanupService.ts`](src/services/automaticCleanupService.ts)
- Database cleanup: [`src/services/databaseCleanupService.ts`](src/services/databaseCleanupService.ts)
- Firebase integration: [`src/services/firebaseService.ts:runAutomaticCleanup`](src/services/firebaseService.ts)

## Architecture

### Project Structure

```
src/
├── components/          # React UI components
│   ├── ChatInterface.tsx      # Main chat interface with document upload
│   ├── DocumentUpload.tsx     # Document upload and processing UI
│   ├── Flashcard.tsx          # Individual flashcard component
│   ├── FlashcardList.tsx      # Flashcard set management
│   ├── DocumentList.tsx       # List of uploaded documents
│   ├── ModelSelector.tsx      # AI model selection dropdown
│   ├── Layout.tsx             # Main app layout with navigation
│   ├── Header.tsx             # App header with auth controls
│   └── ...
├── services/           # Core business logic
│   ├── chatService.ts              # Chat message handling and AI integration
│   ├── documentProcessor.ts        # Document text extraction and processing
│   ├── flashcardService.ts         # Flashcard generation and management
│   ├── firebaseAILogicService.ts   # Multi-model AI integration (Gemini & Groq)
│   ├── firebaseService.ts          # Firebase Firestore operations
│   ├── firebaseAuthService.ts      # Firebase Authentication
│   ├── automaticCleanupService.ts  # Automatic data cleanup
│   └── ...
├── contexts/           # React context providers
│   └── AuthContext.tsx        # Authentication state management
├── hooks/              # Custom React hooks
│   ├── useChatSessions.ts     # Chat session management hook
│   └── useAllFlashcards.ts    # Flashcard aggregation hook
├── pages/              # Page components
│   └── Dashboard.tsx          # Main dashboard page
├── types/              # TypeScript type definitions
│   ├── chat.ts                # Chat-related types
│   ├── flashcard.ts           # Flashcard types
│   ├── ai.ts                  # AI service types
│   └── auth.ts                # Authentication types
├── utils/              # Utility functions
│   ├── fileValidation.ts      # File type and size validation
│   └── markdownRenderer.ts     # Markdown to HTML conversion
└── test/               # Test configuration
    └── setup.ts                # Vitest test setup
```

## Core Functions & Implementation

### 1. Document Processing Pipeline

**Location:** [`src/services/documentProcessor.ts`](src/services/documentProcessor.ts)

**Flow:**
1. **File Upload** → User uploads document via [`DocumentUpload.tsx`](src/components/DocumentUpload.tsx) or [`ChatInterface.tsx`](src/components/ChatInterface.tsx)
2. **Type Detection** → File type determined from MIME type or extension
3. **Content Extraction** → Specialized extractor based on file type:
   - PDF: `extractFromPDF()` - Uses PDF.js to extract text from PDFs
   - DOCX: `extractFromWord()` - Uses Mammoth.js to convert DOCX to HTML then extract text
   - PPTX: `extractFromPowerPoint()` - Uses PPTX Parser to extract text from slides
4. **Content Processing**:
   - `chunkText()` - Splits large documents into manageable chunks (max 2000 chars)
   - `generateSummary()` - Creates document summary
   - `extractKeyTopics()` - Identifies main topics
5. **Result** → Returns `ProcessedDocument` with extracted content, summary, and metadata

**Key Functions:**
- `processDocument(file: File)` - Main entry point for document processing
- `chunkText(text: string)` - Splits text into chunks for AI processing
- `generateSummary(content: string, fileName: string)` - Creates document summary
- `extractKeyTopics(content: string, fileName: string)` - Extracts key topics

### 2. AI Chat System

**Location:** [`src/services/chatService.ts`](src/services/chatService.ts)

**Flow:**
1. **Message Input** → User sends message via [`ChatInterface.tsx`](src/components/ChatInterface.tsx)
2. **Context Building** → System builds context from:
   - Uploaded documents (`buildDocumentContext()`)
   - Conversation history
   - Current session state
3. **Request Detection** → Detects special requests:
   - Flashcard generation (`detectFlashcardRequest()`)
   - Code execution (`isCodeExecutionRequest()`)
4. **AI Processing** → Sends to [`firebaseAILogicService.generateResponse()`](src/services/firebaseAILogicService.ts#L926)
5. **Response Handling** → Processes AI response:
   - Parses flashcard sets if generated
   - Validates code if execution requested
   - Updates session history
6. **Storage** → Saves to Firebase (authenticated) or memory (unauthenticated)

**Key Functions:**
- `sendMessage(message: string, context: ChatContext)` - Main message handler
- `buildDocumentContext(documentIds, processedDocuments)` - Builds document context for AI
- `detectFlashcardRequest(message, context)` - Detects flashcard generation requests
- `handleFlashcardGeneration(request, context, userMessage)` - Generates flashcards via AI

**AI Integration:** [`src/services/firebaseAILogicService.ts`](src/services/firebaseAILogicService.ts)
- Multi-model support: Gemini (primary) and Groq KimiK2 (fallback)
- Automatic fallback on API errors (429, 403, 500, 503)
- Implements retry logic for rate limits
- Builds academic-focused prompts with document context
- Handles conversation history for context-aware responses

### 3. Multi-Model AI System

**Location:** [`src/services/firebaseAILogicService.ts`](src/services/firebaseAILogicService.ts)

**Architecture:**
- **FirebaseAILogicService** - Main service manager that coordinates providers
- **FirebaseAILogicProvider** - Gemini API integration ([`src/services/firebaseAILogicService.ts:FirebaseAILogicProvider`](src/services/firebaseAILogicService.ts#L25))
- **GroqProvider** - Groq API integration ([`src/services/firebaseAILogicService.ts:GroqProvider`](src/services/firebaseAILogicService.ts#L497))
- **Model Selection** - User preference stored in localStorage

**Flow:**
1. **Provider Initialization** → Service initializes available providers based on API keys
2. **Model Selection** → User selects model via [`ModelSelector.tsx`](src/components/ModelSelector.tsx)
3. **Request Routing** → Service routes requests to selected provider
4. **Error Handling** → On failure, automatically tries fallback providers
5. **Response** → Returns AI response with provider metadata

**Key Functions:**
- `generateResponse(message, context, conversationHistory)` - Main AI request handler
- `generateFlashcards(prompt)` - Flashcard-specific generation
- `setModelPreference(preference)` - Sets user's model preference
- `selectBestProvider()` - Selects provider based on preference and availability

**Error Handling:**
- Detects fallback-worthy errors: 429 (rate limit), 403 (quota), 500 (server error), 503 (unavailable)
- Automatically retries with fallback provider
- Logs errors for debugging
- Transparent to user - no interruption in experience

### 4. Flashcard Generation

**Location:** [`src/services/flashcardService.ts`](src/services/flashcardService.ts)

**Flow:**
1. **Request Detection** → Chat service detects flashcard request or user explicitly requests
2. **Prompt Building** → `buildFlashcardPrompt()` creates AI prompt with:
   - Document content or text input
   - User preferences (count, difficulty, format)
   - User profile context for personalization
3. **AI Generation** → Sends to [`firebaseAILogicService.generateFlashcards()`](src/services/firebaseAILogicService.ts#L899)
4. **Response Parsing** → `parseFlashcardResponse()`:
   - Extracts JSON from AI response
   - Handles markdown code blocks
   - Falls back to pattern matching if JSON parsing fails
5. **Flashcard Creation** → Creates `Flashcard` objects with:
   - Unique IDs
   - Question/answer pairs
   - Categories and tags
   - Difficulty levels
6. **Storage** → Saves to Firebase or localStorage

**Key Functions:**
- `generateFlashcards(request, document?)` - Generates flashcards from document
- `generateFlashcardsFromText(request)` - Generates flashcards from text input
- `buildFlashcardPrompt(request, document)` - Builds AI prompt for generation
- `parseFlashcardResponse(response, request)` - Parses AI JSON response
- `createFlashcardSet(title, description, flashcards, sourceDocumentIds?)` - Creates flashcard set

**Mastery System:**
- Level 0: Unassigned (gray)
- Level 1: Needs Review (red)
- Level 2: Needs Improvement (yellow)
- Level 3: Understand (green)
- Tracked via `updateFlashcardMastery(flashcardId, masteryLevel)`

### 5. Authentication System

**Location:** [`src/services/firebaseAuthService.ts`](src/services/firebaseAuthService.ts) & [`src/contexts/AuthContext.tsx`](src/contexts/AuthContext.tsx)

**Flow:**
1. **Initialization** → `AuthContext` initializes on app load
2. **State Listener** → Listens to Firebase Auth state changes
3. **Sign In** → `signInWithGoogle()`:
   - Opens Google sign-in popup
   - Authenticates via Firebase
   - Updates auth context
4. **User State** → Available throughout app via `useAuth()` hook
5. **Data Sync** → Services check auth state to sync with Firebase

**Key Functions:**
- `signInWithGoogle()` - Initiates Google OAuth flow
- `signOut()` - Signs out current user
- `getCurrentUser()` - Returns current authenticated user
- `onAuthStateChange(callback)` - Listens for auth state changes

**Data Persistence:**
- **Authenticated**: All data stored in Firebase Firestore
- **Unauthenticated**: Data stored in browser localStorage (24-hour expiration)

### 6. Automatic Cleanup System

**Location:** [`src/services/automaticCleanupService.ts`](src/services/automaticCleanupService.ts)

**Flow:**
1. **Initialization** → Starts on app load via `chatService` constructor
2. **Hourly Execution** → Runs cleanup every hour
3. **Expiration Check** → Identifies data older than 24 hours
4. **Cleanup Execution** → [`firebaseService.runAutomaticCleanup()`](src/services/firebaseService.ts):
   - Deletes expired chat sessions
   - Deletes expired flashcard sets
   - Deletes expired documents
5. **Silent Operation** → Runs in background without user notification

**Key Functions:**
- `startAutomaticCleanup()` - Starts hourly cleanup interval
- `runCleanup()` - Executes cleanup for expired data
- `stopAutomaticCleanup()` - Stops cleanup service

**Cleanup Criteria:**
- Chat sessions: `lastActivityAt < 24 hours ago`
- Flashcard sets: `createdAt < 24 hours ago` (for unauthenticated users)
- Documents: `uploadDate < 24 hours ago` (for unauthenticated users)

## Quick Start

### Prerequisites
- Node.js 18+ (20+ recommended for full compatibility)
- npm or yarn
- Firebase project with Firestore and Authentication enabled
- Google Gemini API key
- Groq API key (optional, for KimiK2 model)

### Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Set up environment variables:**
Create `.env` file in project root:
```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_GROQ_API_KEY=your_groq_api_key
```

3. **Start development server:**
```bash
npm run dev
```

4. **Build for production:**
```bash
npm run build
```

## Testing

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

**Run tests with coverage report:**
```bash
npm run test:coverage
```

### Test Structure

Tests are organized in a centralized location:
- All tests: [`tests/`](tests/)
- Component tests: [`tests/components/`](tests/components/)
- Service tests: [`tests/services/`](tests/services/)
- Utility tests: [`tests/utils/`](tests/utils/)

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
- Utility functions (file validation, markdown rendering)
- Service modules (flashcard service, document processor)
- React components (Flashcard component, FlashcardList)

## Tech Stack

### Frontend
- **React 18** - UI framework with hooks and context API
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool and dev server
- **React Router** - Client-side routing
- **Framer Motion** - Animation library for UI components

### Backend & Services
- **Firebase Firestore** - NoSQL database for chat sessions, flashcards, documents
- **Firebase Authentication** - Google OAuth sign-in
- **Firebase Hosting** - Static site hosting

### AI & Processing
- **Google Gemini API** - Primary AI model (gemini-2.5-flash, gemini-2.0-flash)
- **Groq API** - Secondary AI model (moonshotai/kimi-k2-instruct-0905)
- **PDF.js** - PDF text extraction
- **Mammoth.js** - DOCX to HTML conversion
- **PPTX Parser** - PowerPoint text extraction

### UI Libraries
- **Framer Motion** - Flashcard flip animations and model selector dropdown
- **Prism.js** - Code syntax highlighting
- **KaTeX** - Math equation rendering
- **Solar Icons** - Icon library

## Usage Guide

### Getting Started
1. **Sign in** with Google account (optional - app works without auth)
2. **Select AI model** - Choose between Gemini (Auto) or KimiK2 from the model selector in the chat input
3. **Upload documents** via drag-and-drop or file picker
4. **Chat with AI** about your documents
5. **Generate flashcards** by asking "Create flashcards from [document]"
6. **Study flashcards** with interactive flip cards and mastery tracking

### Document Upload
- Supported formats: PDF, DOCX, PPTX
- Maximum file size: 50MB
- Multiple files can be uploaded simultaneously
- Documents are processed automatically after upload

### Chat Features
- **Context-aware**: AI understands uploaded documents
- **Multi-session**: Create multiple chat sessions
- **Code help**: Get assistance with programming questions
- **Flashcard generation**: Request flashcards via chat
- **Model selection**: Choose your preferred AI model before chatting

### Flashcard Features
- **Mastery tracking**: Mark cards as "Needs Review", "Needs Improvement", or "Understand"
- **Review system**: Track review count and last reviewed date
- **Categories**: Automatic categorization by topic
- **Difficulty levels**: Easy, medium, or hard

## Deployment

### Firebase Hosting

1. **Install Firebase CLI:**
```bash
npm install -g firebase-tools
```

2. **Login to Firebase:**
```bash
firebase login
```

3. **Initialize hosting:**
```bash
firebase init hosting
```

4. **Build and deploy:**
```bash
npm run build
firebase deploy
```

### Environment Variables
Ensure all environment variables are set in your hosting platform or Firebase config.

## Key Implementation Details

### Document Processing
- Documents are processed client-side for privacy
- Large documents are chunked for efficient AI processing
- Fallback content generation if extraction fails
- Processing progress shown to user

### AI Integration
- **Multi-model architecture**: Supports Gemini and Groq with automatic fallback
- **Model selection**: Users can choose their preferred model
- **Automatic fallback**: Seamlessly switches models on API errors
- Implements exponential backoff retry for rate limits
- Builds academic-focused prompts with document context
- Handles conversation history for context-aware responses

### Data Storage
- **Authenticated users**: All data in Firebase Firestore with real-time sync
- **Unauthenticated users**: Data in localStorage with 24-hour expiration
- Automatic cleanup removes expired data
- Data structure optimized for efficient queries

### Performance Optimizations
- Lazy loading of components
- Code splitting for smaller bundle sizes
- Optimized Firebase queries with indexes
- Efficient document chunking for AI processing

## Privacy & Security
- Client-side document processing (documents never sent to server)
- Firebase Authentication for secure sign-in
- Firestore security rules for data access control
- Automatic data expiration for privacy
- No tracking or analytics
- API keys stored in environment variables (note: frontend keys are visible in browser)

## License
ISC

## Contributing
This is a personal project. For issues or suggestions, please open an issue on the repository.

---

**Built for students and learners**
