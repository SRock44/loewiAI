# Newton AI — Report Figures
*Semester 1 Halfway Check-In — May 2026*

---

## Figure 1: Newton Project Overview

*Section 1 — Introduction. Students interact through Chat, Flashcard, and Document interfaces, coordinated by MasterAgent.*

```mermaid
graph TB
    STU(["Student"])

    subgraph UI ["User Interfaces"]
        CHAT["Chat Interface"]
        FC["Flashcard Interface"]
        DOC["Document Interface"]
    end

    MA["MasterAgent<br/>(Orchestrator)"]

    subgraph AGENTS ["Specialized Agents"]
        CA["ChatAgent"]
        FA["FlashcardAgent"]
        DA["DocumentAgent"]
        TA["ThinkingAgent"]
    end

    subgraph BACK ["Backend Services"]
        AI["Multi-Model AI<br/>Groq (primary) · KimiK2 · GPT-OSS (researching)"]
        FB["Firebase<br/>Auth · Firestore · Storage"]
    end

    STU --> CHAT
    STU --> FC
    STU --> DOC

    CHAT --> MA
    FC --> MA
    DOC --> MA

    MA --> CA
    MA --> FA
    MA --> DA
    MA --> TA

    CA --> AI
    FA --> AI
    DA --> AI
    TA --> AI

    CA --> FB
    FA --> FB
    DA --> FB
```

---

## Figure 2: Inherited Monolithic Architecture

*Section 4.1 — From Monolith to Service Layer. All logic lived in a single ~1,200-line chatService.ts file.*

```mermaid
graph TB
    USER(["User"])

    subgraph MONO ["chatService.ts  (~1,200 lines)"]
        R["Message Routing"]
        P["Prompt Construction"]
        A["API Calls"]
        S["Session Management"]
        D["Document Context"]
        F["Flashcard Detection"]
        PER["Firebase Persistence"]

        R --> P --> A --> S --> D --> F --> PER
    end

    GEM["Gemini API<br/>(Single Provider — No Fallback)"]
    FB[("Firebase")]

    USER --> R
    A --> GEM
    PER --> FB
```

---

## Figure 3: Current Multi-Agent Architecture

*Section 4.1 — After decomposition. chatService is now ~100 lines; MasterAgent coordinates all specialized agents.*

```mermaid
graph TB
    USER(["User"])
    CS["chatService.ts<br/>(~100 lines — Orchestration Only)"]
    MA["MasterAgent"]

    subgraph AGENTS ["Specialized Agents"]
        CA["ChatAgent"]
        FA["FlashcardAgent"]
        DA["DocumentAgent<br/>+ ClassifierAgent<br/>+ WriterAgent<br/>+ FormatterAgent"]
        TA["ThinkingAgent<br/>(Parallel Swarm)"]
    end

    subgraph SVCS ["Services"]
        AILOG["firebaseAILogicService<br/>Multi-Provider AI"]
        FBSVC["firebaseService<br/>Firestore + Storage"]
        DP["documentProcessor<br/>PDF · Word · PPTX · OCR"]
        CV["codeValidator<br/>12+ languages"]
    end

    subgraph PROVIDERS ["AI Providers"]
        GROQ["Groq<br/>llama-3.3-70b-versatile<br/>(primary)"]
        KIMI["KimiK2<br/>(under evaluation)"]
        GPT["GPT-OSS 120B<br/>(under evaluation)"]
    end

    USER --> CS
    CS --> MA
    MA --> CA
    MA --> FA
    MA --> DA
    MA --> TA

    CA --> AILOG
    FA --> AILOG
    DA --> AILOG
    TA --> AILOG
    CA --> CV

    AILOG --> GROQ
    AILOG -.-> KIMI
    AILOG -.-> GPT

    MA --> FBSVC
    MA --> DP
```

---

## Figure 4: CI/CD Pipeline

*Section 5 — Pull Request History (PR #1). Every pull request runs lint, typecheck, test, and build before the merge gate.*

```mermaid
flowchart LR
    PR(["Pull Request<br/>to dev branch"]) --> L["Lint<br/>ESLint"]
    L --> TC["Typecheck<br/>tsc --noEmit"]
    TC --> T["Test<br/>Vitest — 91 tests"]
    T --> B["Build<br/>Vite"]
    B --> G{All checks pass?}
    G -->|Yes| M["Merge to main<br/>Protected branch"]
    G -->|No| BLK["PR Blocked<br/>Fix required"]
```

---

## Figure 5: Chat UI Streaming Pipeline

*Section 5 — Pull Request History (PR #7). Messages flow from the UI through Groq's streaming API, buffer in a ref, and reveal at 65 wpm.*

```mermaid
flowchart LR
    MSG(["User sends message"]) --> MA["MasterAgent<br/>Routes to sub-agent"]
    MA --> SUB["Sub-Agent<br/>Chat · Thinking · Document"]
    SUB --> GROQ["Groq API<br/>stream: true"]
    GROQ --> BUF["Stream Buffer<br/>useRef accumulator"]
    BUF --> REV["Reveal Engine<br/>65 wpm token release"]
    REV --> UI["Chat UI<br/>Live text update"]
    UI --> DONE["Message complete<br/>Persisted to Firestore"]
```

---

## Figure 6: Semester 1 Development Timeline

*Section 6.1 — January through April 2026. Planning through PR #12 Multi-Agent System.*

```mermaid
gantt
    title Semester 1 — Newton Development  (January – April 2026)
    dateFormat  YYYY-MM-DD
    axisFormat  %b %d

    section Planning & Setup
    Project Kickoff & Architecture Planning   :done, 2026-01-15, 2026-02-10
    Firebase Architecture Design              :done, 2026-01-20, 2026-02-01

    section Research & Strategy
    Groq API Integration Testing              :done, 2026-02-01, 2026-03-01
    Team Strategy Sessions                    :done, 2026-02-15, 2026-03-03

    section Pull Requests
    PR 1 — CI/CD Pipeline                    :done, 2026-03-03, 2026-03-05
    PR 2 — Image Upload and OCR              :done, 2026-03-05, 2026-03-07
    PR 3 — Storage Path Tracking             :done, 2026-03-06, 2026-03-08
    PR 4 — README                            :done, 2026-03-07, 2026-03-20
    PR 5 — Dependency Audit                  :done, 2026-03-10, 2026-03-25
    PR 6 — Document Storage                  :done, 2026-04-01, 2026-04-07
    PR 7 — Chat UI and Streaming             :done, 2026-04-07, 2026-04-12
    PR 8 — PDF Generation                    :done, 2026-04-10, 2026-04-18
    PR 10 — Math Rendering Fix               :done, 2026-04-15, 2026-04-22
    PR 11 — Model Selector                   :done, 2026-04-20, 2026-04-26
    PR 12 — Multi-Agent System               :done, 2026-04-25, 2026-04-30
```

---

## Figure 7: Semester 2 Development Roadmap

*Section 6.2 — September through December 2026. Agent expansion, AI infrastructure, mobile app, and production deploy.*

```mermaid
gantt
    title Semester 2 — Newton Roadmap  (September – December 2026)
    dateFormat  YYYY-MM-DD
    axisFormat  %b %d

    section Agent Development
    QuizAgent                                 :2026-09-01, 2026-10-01
    SummarizerAgent                           :2026-09-15, 2026-10-15
    ProblemSolverAgent                        :2026-09-15, 2026-10-15
    ResearchAgent                             :2026-10-01, 2026-11-01

    section AI Infrastructure
    Thinking Mode                             :2026-09-01, 2026-10-15
    Better Models Integration                 :2026-09-15, 2026-11-01
    Model Router                              :2026-10-01, 2026-11-01
    Base Prompt Templates                     :2026-09-01, 2026-10-01

    section Mobile and Export
    Mobile App — iOS and Android              :2026-10-01, 2026-12-01
    Citation Lookup                           :2026-10-15, 2026-11-15
    DOCX Export                               :2026-11-01, 2026-12-01
    Spaced Repetition — SM-2                  :2026-10-15, 2026-12-01

    section Quality and Deploy
    Integration and Regression Testing        :2026-11-01, 2026-12-01
    UAT and UI Polish                         :2026-11-15, 2026-12-10
    Production Deploy                         :milestone, 2026-12-15, 0d
```

---

## Figure 8: Semester 2 Agent Expansion

*Section 6.2 / Section 8 — MasterAgent will coordinate new agents (Quiz, Summarizer, ProblemSolver, Research) alongside new platform features.*

```mermaid
graph TB
    MA["MasterAgent<br/>(Orchestrator)"]

    subgraph SEM1 ["Semester 1 — Current Agents"]
        CA["ChatAgent"]
        FA["FlashcardAgent"]
        DA["DocumentAgent"]
        TA["ThinkingAgent"]
    end

    subgraph SEM2A ["Semester 2 — New Agents"]
        QA["QuizAgent<br/>Practice quizzes from docs"]
        SA["SummarizerAgent<br/>Configurable depth summaries"]
        PSA["ProblemSolverAgent<br/>Step-by-step math and science"]
        RA["ResearchAgent<br/>Citations and literature review"]
    end

    subgraph SEM2F ["Semester 2 — New Features"]
        MR["Model Router<br/>Auto model selection by task"]
        SR["Spaced Repetition<br/>SM-2 flashcard scheduling"]
        MOB["Mobile App<br/>iOS and Android"]
        DOCX["DOCX Export<br/>Print-quality papers"]
        CIT["Citation Lookup<br/>APA · MLA · Chicago"]
    end

    MA --> CA
    MA --> FA
    MA --> DA
    MA --> TA

    MA --> QA
    MA --> SA
    MA --> PSA
    MA --> RA

    MA --> MR
    FA --> SR
    DA --> DOCX
    RA --> CIT
    MA --> MOB
```
