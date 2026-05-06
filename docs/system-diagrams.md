# Newton AI — System Diagrams
*Technical reference for capstone report — May 2026*

---

## DFD Level 0 — Context Diagram

*Newton as a single process. Shows every external entity and the data flowing in and out.*

```mermaid
flowchart TB
    STUDENT(["Student"])
    GOOGLE(["Google OAuth"])
    GROQ(["Groq Cloud<br/>(Primary AI)"])
    ALT(["Alternative Providers<br/>Under Research"])
    FB(["Firebase Platform"])

    NEWTON[["Newton AI<br/>Web Application"]]

    STUDENT -->|"Messages, uploaded files, preferences"| NEWTON
    NEWTON -->|"AI responses, flashcards, generated documents"| STUDENT

    NEWTON -->|"Auth request"| GOOGLE
    GOOGLE -->|"Identity token"| NEWTON

    NEWTON -->|"Prompts + context"| GROQ
    GROQ -->|"Generated text — streamed"| NEWTON

    NEWTON -.->|"Evaluating"| ALT
    ALT -.->|"Experimental responses"| NEWTON

    NEWTON -->|"Sessions, flashcards, memory — read/write"| FB
    FB -->|"Persisted data, real-time updates"| NEWTON
```

---

## DFD Level 1 — Main Processes

*Newton broken into its six primary processes with internal data stores.*

```mermaid
flowchart TB
    STUDENT(["Student"])
    GROQ(["Groq API"])
    GOOGLE(["Google OAuth"])

    P1["1.0<br/>Authenticate User"]
    P2["2.0<br/>Process Document"]
    P3["3.0<br/>Route Message"]
    P4["4.0<br/>Generate AI Response"]
    P5["5.0<br/>Manage Flashcards"]
    P6["6.0<br/>Persist Session"]

    D1[("D1 — Chat Sessions")]
    D2[("D2 — Flashcard Sets")]
    D3[("D3 — User Memory")]
    D4[("D4 — User Context")]
    D5[("D5 — Document Storage")]

    STUDENT -->|"Google login"| P1
    P1 <-->|"Verify identity"| GOOGLE
    P1 -->|"Authenticated user ID"| P3

    STUDENT -->|"Uploaded file"| P2
    P2 -->|"Store file"| D5
    P2 -->|"Extracted text + metadata"| P3

    STUDENT -->|"Chat message"| P3
    P3 -->|"Routed prompt + document context"| P4
    P3 -->|"Flashcard generation request"| P5

    P4 <-->|"Prompts + streaming responses"| GROQ
    P4 -->|"Completed message"| P6
    P4 -->|"Streamed response chunks"| STUDENT

    P5 <-->|"Read / write sets"| D2
    P5 -->|"Generated flashcard set"| STUDENT

    P6 <-->|"Read / write sessions"| D1
    P6 <-->|"Read / write memory"| D3
    P6 <-->|"Read / write context"| D4
    P6 -->|"Updated session"| STUDENT

    D3 -->|"User preferences"| P4
    D4 -->|"Study history"| P4
    D1 -->|"Conversation history"| P4
```

---

## ERD — Complete Data Model

*All Firestore collections, fields, and relationships.*

```mermaid
erDiagram
    USER {
        string uid PK
        string displayName
        string email
        string photoURL
        string educationLevel
        string fieldOfStudy
    }

    CHAT_SESSION {
        string id PK
        string userId FK
        string title
        timestamp createdAt
        timestamp updatedAt
        timestamp lastActivityAt
        array documentIds
        array messages
    }

    MESSAGE {
        string id PK
        string sessionId FK
        string role
        string content
        timestamp timestamp
        boolean isDocument
        boolean isProfessionalDocument
        string documentTitle
        string documentContent
        object flashcardSet
        object documentMetadata
        array imageUrls
        array fullImageUrls
        array storagePaths
        string rating
    }

    MESSAGE_RATING {
        string id PK
        string messageId FK
        string sessionId FK
        string userId FK
        string rating
        string assistantContent
        string userContent
        string feedback
        timestamp createdAt
    }

    FLASHCARD_SET {
        string id PK
        string userId FK
        string title
        string description
        array sourceDocumentIds
        array tags
        timestamp createdAt
        timestamp updatedAt
        timestamp lastActivityAt
        timestamp expiresAt
    }

    FLASHCARD {
        string id PK
        string setId FK
        string question
        string answer
        string category
        string difficulty
        array tags
        int masteryLevel
        int reviewCount
        timestamp createdAt
        timestamp lastReviewed
        string sourceDocumentId
    }

    USER_CONTEXT {
        string userId PK
        string studyHistory
        timestamp updatedAt
    }

    USER_MEMORY {
        string userId PK
        string preferences
        string feedback
        string goals
        timestamp updatedAt
    }

    PROCESSED_DOCUMENT {
        string id PK
        string sessionId FK
        string fileName
        string fileType
        int fileSize
        string extractedContent
        array chunks
        string summary
        array keyTopics
        string difficulty
        string storageUrl
        timestamp uploadDate
    }

    USER ||--o{ CHAT_SESSION : owns
    USER ||--o{ FLASHCARD_SET : owns
    USER ||--|| USER_CONTEXT : has
    USER ||--|| USER_MEMORY : has
    CHAT_SESSION ||--o{ MESSAGE : contains
    CHAT_SESSION ||--o{ PROCESSED_DOCUMENT : includes
    MESSAGE ||--o| MESSAGE_RATING : "rated by"
    FLASHCARD_SET ||--o{ FLASHCARD : contains
    PROCESSED_DOCUMENT ||--o{ FLASHCARD : "sourced by"
```

---

## Class Diagram — Agent Hierarchy

*All agent classes, their responsibilities, and how they compose.*

```mermaid
classDiagram
    class MasterAgent {
        -sessions Map~string~ChatSession~
        -groqClient Groq
        -messageCounter number
        -currentUserId string
        -userMemoryCache string
        -userContextCache string
        +sendMessage(message, context, onChunk) ChatMessage
        +createNewSession() ChatSession
        +deleteSession(sessionId) void
        +getSessions() ChatSession[]
        +rateMessage(messageId, rating) void
        +retryMessage(sessionId, messageId, onChunk) ChatMessage
        -maybeGenerateSessionTitle() void
        -maybeUpdateUserContext() void
    }

    class ChatAgent {
        -groqClient Groq
        +handle(message, context, userMsg, onChunk) ChatMessage
        -buildDocumentContext(docs) string
        -buildConversationContext(session) string
        -attemptCodeCorrection(content, errors) string
    }

    class FlashcardAgent {
        -groqClient Groq
        +detect(message, context) FlashcardGenerationRequest
        +handle(request, context) ChatMessage
    }

    class DocumentAgent {
        -groqClient Groq
        +handle(message, context, intent, classification) ChatMessage
        -cleanProfessionalOutput(content) string
    }

    class ClassifierAgent {
        -groqClient Groq
        +heuristicGate(message) boolean
        +classify(message, context) IntentClassificationResult
    }

    class WriterAgent {
        -groqClient Groq
        +generateAcademicResource(message, context, onChunk) string
        +generateProfessionalDocument(message, meta, onChunk) string
        -buildAcademicPrompt() string
        -buildProfessionalPrompt(metadata) string
    }

    class FormatterAgent {
        +extractMetadata(message, user) ProfessionalDocumentMetadata
        +extractDocumentSummary(content) string
        +extractDocumentTitle(message) string
    }

    class ThinkingAgent {
        -groqClient Groq
        +handle(message, context, userMsg, onChunk) ChatMessage
        -runResearchAgent(message) string
        -runAnalysisAgent(message) string
        -synthesize(message, research, analysis, ctx) string
    }

    MasterAgent --> ChatAgent : routes to
    MasterAgent --> FlashcardAgent : routes to
    MasterAgent --> DocumentAgent : routes to
    MasterAgent --> ThinkingAgent : routes to
    DocumentAgent --> ClassifierAgent : classifies intent
    DocumentAgent --> WriterAgent : generates content
    DocumentAgent --> FormatterAgent : extracts metadata
```

---

## State Diagram — Chat Session Lifecycle

*A session moves from empty to active, gets titled, syncs to Firestore, and can be deleted.*

```mermaid
stateDiagram-v2
    [*] --> Empty : User opens app

    Empty --> Active : First message sent

    state Active {
        [*] --> Routing
        Routing --> ChatAgent : regular message
        Routing --> FlashcardAgent : flashcard keywords
        Routing --> DocumentAgent : document keywords
        Routing --> ThinkingAgent : long or thinking mode
        ChatAgent --> [*]
        FlashcardAgent --> [*]
        DocumentAgent --> [*]
        ThinkingAgent --> [*]
    }

    Active --> Titled : Title generated (async)
    Titled --> Titled : More messages exchanged

    Active --> Persisted : Saved to Firestore
    Titled --> Persisted : Saved to Firestore
    Persisted --> Persisted : Real-time sync via onSnapshot

    Persisted --> [*] : Session deleted
```

---

## State Diagram — Flashcard Mastery Progression

*Each flashcard moves through four mastery levels. Tracks SM-2-style spaced repetition.*

```mermaid
stateDiagram-v2
    [*] --> New : Card created (masteryLevel 0)

    New --> Learning : First review attempt
    Learning --> Familiar : Correct answer (masteryLevel 1 → 2)
    Learning --> Learning : Incorrect — stays in Learning

    Familiar --> Mastered : Consistent correct (masteryLevel 3)
    Familiar --> Learning : Incorrect — drops back

    Mastered --> Familiar : Incorrect after time gap
    Mastered --> Mastered : Review maintained

    Mastered --> [*] : Set deleted or expired
```

---

## Sequence — Authentication and Session Load

*Google Sign-In through Firebase Auth, followed by loading the user's sessions and memory.*

```mermaid
sequenceDiagram
    actor U as User
    participant UI as ChatInterface
    participant AUTH as firebaseAuthService
    participant GOOGLE as Google OAuth
    participant FB as Firestore
    participant MA as MasterAgent

    U->>UI: Click "Sign in with Google"
    UI->>AUTH: signInWithGoogle()
    AUTH->>GOOGLE: signInWithPopup()
    GOOGLE-->>AUTH: ID token + profile
    AUTH-->>UI: Firebase User object
    UI->>MA: reloadForUser(userId)
    MA->>FB: getChatSessions(userId)
    FB-->>MA: ChatSession[]
    MA->>FB: getUserMemory(userId)
    FB-->>MA: userMemoryCache
    MA->>FB: getUserContext(userId)
    FB-->>MA: userContextCache
    MA->>FB: subscribeToChatSessions(userId)
    Note over MA,FB: Real-time listener active
    FB-->>MA: onSnapshot updates
    MA-->>UI: Sessions loaded
    UI-->>U: Sidebar populated, ready to chat
```

---

## Sequence — Document Upload and OCR

*A file goes from the user's device to extracted text inside the AI's context.*

```mermaid
sequenceDiagram
    actor U as User
    participant UI as ChatInterface
    participant DP as documentProcessor
    participant GROQ as Groq Vision API
    participant FB as Firebase Storage
    participant MA as MasterAgent

    U->>UI: Upload file (PDF / DOCX / PPTX / Image)
    UI->>DP: processDocument(file)

    alt PDF
        DP->>DP: pdf.js worker — extract text
    else Word DOCX
        DP->>DP: mammoth — extract text
    else PowerPoint PPTX
        DP->>DP: pptx-parser — extract text
    else Image
        DP->>GROQ: analyzeImage(base64)<br/>Llama 4 Scout 17B
        GROQ-->>DP: Classified type + extracted content
    end

    DP->>DP: Chunk text (1 000 chars, 200 overlap)
    DP->>DP: Extract key topics + difficulty
    DP->>FB: uploadDocument(file, userId)
    FB-->>DP: storageUrl

    DP-->>UI: ProcessedDocument

    UI->>MA: sendMessage(message, context)<br/>context.processedDocuments = [doc]
    MA->>MA: Build document context string
    Note over MA: "User uploaded: {summary}<br/>CONTENT: {chunks}"
    MA->>MA: Inject into AI prompt
```

---

## Deployment Architecture

*How Newton is built, hosted, and connected to external services.*

```mermaid
graph TB
    subgraph DEV ["Development"]
        SRC["Source Code<br/>React + TypeScript"]
        VITE["Vite Build<br/>Code splitting + chunking"]
        SRC --> VITE
    end

    subgraph FIREBASE ["Firebase Platform"]
        HOST["Firebase Hosting<br/>newton.best (CDN)"]
        AUTH["Firebase Auth<br/>Google OAuth 2.0"]
        FS["Firestore<br/>NoSQL — real-time"]
        STORE["Cloud Storage<br/>Uploaded documents"]
    end

    subgraph GROQ ["Groq Cloud — Primary AI"]
        L33["llama-3.3-70b-versatile<br/>(chat + documents)"]
        L4S["Llama 4 Scout 17B<br/>(image OCR)"]
    end

    subgraph RESEARCH ["Under Research / Evaluation"]
        KIMIK2["KimiK2"]
        GPTOSS["GPT-OSS 120B"]
    end

    subgraph GOOGLE ["Google Cloud"]
        GOAUTH["Google OAuth 2.0<br/>(Auth only)"]
    end

    VITE -->|"Deploy dist/"| HOST
    HOST -->|"Serve SPA to browser"| BROWSER["Browser<br/>(Client Runtime)"]

    BROWSER <-->|"Firebase Auth SDK"| AUTH
    BROWSER <-->|"Firestore SDK — onSnapshot"| FS
    BROWSER <-->|"Storage SDK"| STORE
    BROWSER <-->|"Groq SDK — dangerouslyAllowBrowser"| L33
    BROWSER <-->|"Groq SDK"| L4S
    BROWSER -.->|"Evaluating"| KIMIK2
    BROWSER -.->|"Evaluating"| GPTOSS
    AUTH <-->|"OAuth 2.0 flow"| GOAUTH
```

---

## Flowchart — AI Provider Strategy

*Groq is the primary provider. Alternative providers are under active research and evaluation.*

```mermaid
flowchart TD
    REQ(["AI Request"]) --> TRY1["Groq — Primary<br/>llama-3.3-70b-versatile"]
    TRY1 --> R1{Response OK?}
    R1 -->|Yes| RESP(["Return response"])
    R1 -->|"429 / 503"| BACK1["Exponential backoff<br/>1s → 2s → 4s"]
    BACK1 --> EX1{Retries<br/>exhausted?}
    EX1 -->|No| TRY1
    EX1 -->|Yes| TRY2["KimiK2<br/>(under evaluation)"]
    TRY2 --> R2{Response OK?}
    R2 -->|Yes| RESP
    R2 -->|Error| TRY3["GPT-OSS 120B<br/>(under evaluation)"]
    TRY3 --> R3{Response OK?}
    R3 -->|Yes| RESP
    R3 -->|Error| ERR(["Return error to user"])
```

---

## Flowchart — Groq Model Selection

*Newton uses different Groq models depending on the task type.*

```mermaid
flowchart TD
    REQ(["AI Request"]) --> TYPE{Task type?}

    TYPE -->|"Chat / Thinking / Documents"| L33["llama-3.3-70b-versatile<br/>(primary — all general tasks)"]
    TYPE -->|"Image OCR"| L4S["Llama 4 Scout 17B<br/>(vision — image analysis)"]
    TYPE -->|"Sub-agent calls<br/>(Research + Analysis)"| L33B["llama-3.3-70b-versatile<br/>temp=0.3, max_tokens=300"]
    TYPE -->|"Utility calls<br/>(titles, hints)"| L33C["llama-3.3-70b-versatile<br/>max_tokens=20"]

    L33 --> RESP(["Response"])
    L4S --> RESP
    L33B --> RESP
    L33C --> RESP
```

---

## Flowchart — Code Validation and Auto-Correction

*Every AI response with code is silently validated. Errors are sent back for automatic correction.*

```mermaid
flowchart TD
    RESP(["AI Response received"]) --> EXTRACT["Extract code blocks<br/>via regex"]
    EXTRACT --> NONE{Any code<br/>blocks found?}
    NONE -->|No| DONE(["Deliver to user"])
    NONE -->|Yes| VALIDATE["Validate each block<br/>by language"]

    subgraph LANGS ["Language Validators"]
        JS["JavaScript<br/>Function constructor"]
        PY["Python<br/>Indentation + print check"]
        JAVA["Java<br/>Class structure check"]
        JSON2["JSON<br/>JSON.parse()"]
        OTHER["CSS · HTML · SQL · etc.<br/>Pattern validation"]
    end

    VALIDATE --> LANGS
    LANGS --> CHECK{Errors<br/>found?}
    CHECK -->|No| DONE
    CHECK -->|Yes| CORRECT["Send correction prompt<br/>to AI with errors"]
    CORRECT --> RETRY["Re-validate corrected code"]
    RETRY --> CLEAN{Clean?}
    CLEAN -->|Yes| DONE
    CLEAN -->|No| DONE2(["Deliver best attempt<br/>with warning flag"])
```
