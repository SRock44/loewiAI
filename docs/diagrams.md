# Newton AI — High-Level Architecture Diagrams

---

## 1. System Architecture

High-level view of the tech stack and external service integrations.

```mermaid
graph TB
    subgraph Browser ["Client (Browser)"]
        direction TB
        UI["React + TypeScript UI<br/>(ChatInterface, Dashboard, Sidebar)"]
        SVC["Service Layer<br/>(chatService facade)"]
        MA["MasterAgent<br/>(Orchestrator)"]
        AGENTS["Sub-Agents<br/>(Chat · Flashcard · Document · Thinking)"]
        DOCPROC["Document Processor<br/>(PDF · Word · PowerPoint · Image)"]
    end

    subgraph Firebase ["Firebase (BaaS)"]
        AUTH["Authentication<br/>(Google OAuth)"]
        FS["Firestore<br/>(Sessions · Flashcards · Memory)"]
        STORE["Cloud Storage<br/>(Uploaded Documents)"]
    end

    subgraph Groq ["Groq Cloud"]
        LLM["llama-3.3-70b-versatile<br/>(Primary LLM)"]
    end

    UI --> SVC
    SVC --> MA
    MA --> AGENTS
    MA --> FS
    MA --> STORE
    AGENTS --> LLM
    DOCPROC --> LLM
    UI --> DOCPROC
    UI --> AUTH
    AUTH --> FS
```

---

## 2. Multi-Agent Routing Flow

How MasterAgent routes each incoming message to the correct sub-agent.

```mermaid
flowchart TD
    MSG([User Message]) --> F1{Flashcard keywords?}

    F1 -->|Yes| FLASH["FlashcardAgent<br/>— Extract topic<br/>— Generate Q&A cards<br/>— Save to Firebase"]
    F1 -->|No| F2{Code execution request?}

    F2 -->|Yes| GUARD["Code Guard<br/>— Block request<br/>— Redirect to IDE"]
    F2 -->|No| F3{Document keywords?}

    F3 -->|Yes| CLASS["ClassifierAgent<br/>(AI-powered)"]
    CLASS --> DOCTYPE{Intent?}
    DOCTYPE -->|academic-resource| ACAD["WriterAgent<br/>→ Study guide / formula sheet"]
    DOCTYPE -->|professional-document| PROF["FormatterAgent → WriterAgent<br/>→ Essay / report (MLA · APA · Chicago)"]
    DOCTYPE -->|none| F4

    F3 -->|No| F4{isThinkingMode or length ≥ 150?}
    F4 -->|Yes| THINK["ThinkingAgent<br/>(Swarm)"]
    F4 -->|No| CHAT["ChatAgent<br/>— Regular conversation<br/>— Code validation"]

    FLASH --> PERSIST[("Persist to Firestore")]
    ACAD --> PERSIST
    PROF --> PERSIST
    THINK --> PERSIST
    CHAT --> PERSIST
```

---

## 3. ThinkingAgent — Parallel Swarm

How ThinkingAgent handles complex queries using parallel sub-agents.

```mermaid
flowchart LR
    Q([Complex Query]) --> FORK

    subgraph FORK ["Parallel Execution"]
        direction TB
        R["ResearchAgent<br/>─────────────<br/>Key facts & background context<br/>(3–5 bullets)"]
        A["AnalysisAgent<br/>─────────────<br/>Nuances, counterarguments & perspectives<br/>(3–5 bullets)"]
    end

    FORK --> R
    FORK --> A

    R --> SYN
    A --> SYN

    subgraph SYN ["Synthesis (Sequential)"]
        CTX["Build context:<br/>User memory + study history<br/>+ conversation history<br/>+ research + analysis notes"]
        GEN["Groq LLM<br/>Comprehensive answer"]
        CTX --> GEN
    end

    GEN --> RESP([Response])
```

---

## 4. Message Lifecycle — Sequence Diagram

End-to-end flow from user input to final streamed response.

```mermaid
sequenceDiagram
    actor U as User
    participant UI as ChatInterface
    participant CS as chatService
    participant MA as MasterAgent
    participant AG as Sub-Agent
    participant G as Groq API
    participant FB as Firebase

    U->>UI: Type & send message
    UI->>CS: sendMessage(msg, context)
    CS->>MA: sendMessage(msg, context)

    MA->>MA: Route to sub-agent

    MA->>AG: handle(message, context)
    AG->>G: chat.completions.create() [stream]

    loop Streaming chunks
        G-->>UI: partial content
        UI-->>U: Live text update
    end

    AG->>FB: saveChatSession()
    AG-->>MA: ChatMessage

    par Background tasks
        MA->>G: generateTitle() [async, 20 tokens]
        MA->>FB: maybeUpdateUserContext() [interval]
    end

    MA-->>CS: ChatMessage
    CS-->>UI: ChatMessage
    UI-->>U: Final rendered response
```

---

## 5. Document Processing Pipeline

How uploaded files are processed and injected into agent context.

```mermaid
flowchart TD
    UPLOAD([User uploads file]) --> TYPE{File type?}

    TYPE -->|PDF| PDFJS["pdf.js<br/>(worker thread)"]
    TYPE -->|Word .docx| MAM["mammoth"]
    TYPE -->|PowerPoint .pptx| PPTX["pptx-parser"]
    TYPE -->|Image| OCR["Groq OCR API"]
    TYPE -->|Plain text| READ["Direct read"]

    PDFJS --> EXTRACT[Extracted text]
    MAM --> EXTRACT
    PPTX --> EXTRACT
    OCR --> EXTRACT
    READ --> EXTRACT

    EXTRACT --> CHUNK["Chunk text<br/>(1 000-char blocks, 200-char overlap)"]
    CHUNK --> META["Extract metadata<br/>— 2-sentence summary<br/>— Key topics<br/>— Difficulty level"]
    META --> CTX["Inject into ChatContext<br/>processedDocuments[]"]

    CTX --> AGENTS["Sub-agents build document context<br/>for every prompt"]
```

---

## 6. React Component Hierarchy

High-level component tree and how state flows through the UI.

```mermaid
graph TD
    APP["App.tsx"]
    AUTH["AuthProvider<br/>(Google OAuth context)"]
    ROUTER["React Router v6"]
    LAYOUT["Layout<br/>(shell)"]

    HEADER["Header<br/>(logo · user profile · settings)"]
    SIDEBAR["Sidebar"]
    SESS["SessionList"]
    MODEL["ModelSelector"]

    ROUTES["Routes"]
    HOME["Hero + Features<br/>(landing page)"]
    DASH["Dashboard"]

    CI["ChatInterface<br/>(main app — ~1 800 lines)"]
    PANEL["ChatPanel"]
    INPUT["InputArea"]

    MSGLIST["MessageList"]
    DOCDIS["DocumentDisplay"]
    FCVIEW["FlashcardViewer"]

    UPLOAD["DocumentUpload"]
    MSGIN["MessageInput"]
    ACTIONS["ActionButtons<br/>(Think · Attach · Send)"]

    APP --> AUTH
    APP --> ROUTER
    ROUTER --> LAYOUT
    LAYOUT --> HEADER
    LAYOUT --> SIDEBAR
    SIDEBAR --> SESS
    SIDEBAR --> MODEL
    LAYOUT --> ROUTES
    ROUTES --> HOME
    ROUTES --> DASH
    DASH --> CI
    CI --> PANEL
    CI --> INPUT
    PANEL --> MSGLIST
    PANEL --> DOCDIS
    PANEL --> FCVIEW
    INPUT --> UPLOAD
    INPUT --> MSGIN
    INPUT --> ACTIONS
```

---

## 7. Firebase Data Model

Collections stored in Firestore and their relationships.

```mermaid
erDiagram
    USER {
        string uid PK
        string displayName
        string email
        string photoURL
    }

    CHAT_SESSION {
        string id PK
        string userId FK
        string title
        timestamp createdAt
        timestamp updatedAt
        timestamp lastActivityAt
        array documentIds
    }

    MESSAGE {
        string id PK
        string sessionId FK
        string role
        string content
        timestamp timestamp
        boolean isDocument
        string documentTitle
        object flashcardSet
    }

    MESSAGE_RATING {
        string id PK
        string messageId FK
        string sessionId FK
        string userId FK
        string rating
        string feedback
    }

    FLASHCARD_SET {
        string id PK
        string userId FK
        string title
        string description
        timestamp createdAt
        timestamp expiresAt
        array sourceDocumentIds
    }

    FLASHCARD {
        string id PK
        string setId FK
        string question
        string answer
        int masteryLevel
        int reviewCount
        timestamp lastReviewed
    }

    USER_CONTEXT {
        string userId PK
        string studyHistory
        timestamp updatedAt
    }

    USER_MEMORY {
        string userId PK
        string preferences
        timestamp updatedAt
    }

    USER ||--o{ CHAT_SESSION : owns
    CHAT_SESSION ||--o{ MESSAGE : contains
    MESSAGE ||--o| MESSAGE_RATING : "rated by"
    USER ||--o{ FLASHCARD_SET : owns
    FLASHCARD_SET ||--o{ FLASHCARD : contains
    USER ||--|| USER_CONTEXT : has
    USER ||--|| USER_MEMORY : has
```
