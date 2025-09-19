# Academic AI Assistant

**Intelligent Advisor and Learning Companion**

A modern, responsive landing page for the Academic AI Assistant platform - your 24/7 virtual advisor providing instant academic guidance, syllabus-based recommendations, and gamified learning experiences.

## 🚀 Features

- **24/7 AI Advisor**: Get instant responses to academic queries anytime, anywhere
- **Syllabus-Based Guidance**: Personalized recommendations for study materials and resources
- **Gamified Learning**: Engaging gamification elements that make learning fun and rewarding
- **Instant Access**: No more waiting for advisor appointments
- **Goal Tracking**: Set and track your academic goals with intelligent progress monitoring
- **Performance Analytics**: Get insights into your learning patterns and areas for improvement

## 🛠️ Technology Stack

- **React 18** - Modern React with hooks and functional components
- **TypeScript** - Type-safe development with excellent developer experience
- **React Router** - Client-side routing for navigation
- **Vite** - Fast build tool and development server
- **CSS3** - Modern styling with gradients, animations, and responsive design
- **ESLint** - Code quality and consistency

## 📊 Dashboard Features

- **Unified Interface** - Upload documents and chat with AI in one seamless experience
- **Tab-Based Navigation** - Easy switching between document upload and AI chat
- **Document Upload** - Drag & drop interface with file validation (PDF, DOCX, DOC, PPTX, PPT)
- **AI Chat Integration** - Context-aware conversations using uploaded documents
- **Progress Tracking** - Real-time upload and processing status
- **Smart Workflow** - Automatically switches to chat after document upload
- **Quick Actions** - Easy access to common tasks and features
- **Responsive Design** - Optimized for desktop, tablet, and mobile devices

## 💬 AI Chat Features

- **Real-time Chat Interface** - Instant messaging with AI assistant
- **Context-Aware Responses** - AI uses uploaded documents for personalized guidance
- **Multiple Chat Sessions** - Create and manage separate conversation threads
- **Quick Actions** - Pre-built prompts for common academic queries
- **Chat History Persistence** - Conversations saved locally for authenticated users only
- **Smart Document Integration** - AI references uploaded materials automatically
- **Typing Indicators** - Visual feedback during AI processing
- **Mobile-Optimized** - Responsive chat interface for all devices

## 🔐 Authentication Features

- **Google OAuth Integration** - Secure sign-in with Google accounts
- **User Profile Management** - Personal dashboard with user information
- **Privacy-First Approach** - Chat history only saved for authenticated users
- **Session Management** - Automatic sign-out and data clearing
- **Protected Routes** - Chat functionality requires authentication
- **User Context** - Personalized experience based on user identity

## 📋 Prerequisites

- Node.js (version 16 or higher)
- npm or yarn package manager

## 🚀 Getting Started

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd academic-ai-assistant
```

2. Install dependencies:
```bash
npm install
```

### Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Building for Production

Build the application for production:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

### Linting

Run ESLint to check code quality:
```bash
npm run lint
```

## 📁 Project Structure

```
src/
├── components/           # React components
│   ├── Header.tsx       # Navigation header
│   ├── Header.css       # Header styles
│   ├── Hero.tsx         # Hero section
│   ├── Hero.css         # Hero styles
│   ├── Features.tsx     # Features showcase
│   ├── Features.css     # Features styles
│   ├── Footer.tsx       # Footer section
│   ├── Footer.css       # Footer styles
│   ├── DocumentList.tsx # Document management component
│   ├── DocumentList.css # Document list styles
│   ├── ChatInterface.tsx # AI chat interface component
│   ├── ChatInterface.css # Chat interface styles
│   ├── DocumentUpload.tsx # Document upload component
│   ├── DocumentUpload.css # Document upload component styles
│   ├── UserProfile.tsx  # User profile dropdown component
│   └── UserProfile.css  # User profile styles
├── pages/               # Page components
│   ├── Dashboard.tsx      # Combined dashboard page
│   └── Dashboard.css      # Dashboard page styles
├── services/            # API and AI services
│   ├── aiService.ts     # AI integration service
│   ├── chatService.ts   # Chat and conversation service
│   ├── authService.ts   # Authentication service
│   └── apiService.ts    # Backend API service
├── types/               # TypeScript type definitions
│   ├── ai.ts           # AI and document types
│   ├── chat.ts         # Chat and conversation types
│   └── auth.ts         # Authentication types
├── utils/               # Utility functions
│   └── fileValidation.ts # File validation utilities
├── contexts/            # React contexts
│   ├── AuthContext.tsx  # Authentication context provider
│   └── AuthContext.css  # Authentication UI styles
├── App.tsx              # Main application component
├── App.css              # Global application styles
├── main.tsx             # Application entry point
└── index.css            # Base styles and CSS reset
```

## 🎨 Design Features

- **Modern Gradient Design**: Beautiful purple-to-blue gradient theme
- **Responsive Layout**: Optimized for desktop, tablet, and mobile devices
- **Smooth Animations**: Floating AI icon and orbiting learning elements
- **Interactive Elements**: Hover effects and smooth transitions
- **Accessibility**: Semantic HTML and proper contrast ratios
- **Performance**: Optimized bundle size and fast loading times

## 🎯 Objectives & Expected Outcomes

### Objectives
- Build a virtual AI-based advisor capable of answering student queries instantly
- Provide syllabus-based recommendations for study materials and resources
- Develop an engaging gamified learning environment to encourage continuous learning

### Expected Outcomes
- Reduced dependency on physical advisor appointments
- Faster, more reliable access to academic information and resources
- Improved student engagement through gamification
- Enhanced learning outcomes through personalized guidance

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 📞 Contact

For questions or support, please contact:
- Email: contact@academicai.com
- Twitter: [@AcademicAI](https://twitter.com/academicai)
- LinkedIn: [Academic AI Assistant](https://linkedin.com/company/academic-ai-assistant)

---

**Built with ❤️ for students everywhere**
