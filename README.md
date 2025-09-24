# 🎓 Academic AI Assistant

An intelligent, next-generation AI-powered platform designed to revolutionize academic learning and research. Built with cutting-edge technology to provide personalized educational assistance, document analysis, and interactive learning experiences.

## ✨ Key Features

### 🧠 **Intelligent AI Chat**
- **Context-Aware Conversations**: AI that understands your academic level and field of study
- **Personalized Responses**: Tailored explanations based on your education level and major
- **Multi-Session Management**: Create and manage separate conversation threads
- **Real-Time Typing Animation**: Enhanced user experience with dynamic responses

### 📄 **Advanced Document Processing**
- **Multi-Format Support**: Upload and analyze PDF, DOCX, PPTX files
- **AI-Powered Analysis**: Extract key topics, summaries, and insights from documents
- **Content Integration**: Seamlessly incorporate document content into conversations
- **Batch Processing**: Handle multiple documents simultaneously

### 🎴 **Smart Flashcard System**
- **AI-Generated Flashcards**: Automatically create flashcards from documents or text
- **Personalized Learning**: Adapt difficulty and content to your academic level
- **Progress Tracking**: Monitor learning progress and mastery levels
- **Spaced Repetition**: Optimized review schedules for better retention

### 🔐 **Secure Authentication**
- **Google OAuth Integration**: Secure sign-in with Google accounts
- **User Profile Management**: Store education level and major preferences
- **Cross-Device Sync**: Access your data from any device
- **Privacy-Focused**: All data tied to your Google account

### 🧹 **Automatic Data Management**
- **24-Hour Auto-Cleanup**: Automatically removes expired chat sessions and flashcards
- **Duplicate Prevention**: Intelligent system prevents duplicate data creation
- **Storage Optimization**: Efficient database management for better performance
- **Background Maintenance**: Self-maintaining system with no manual intervention

## 🛠️ Technology Stack

### **Frontend**
- **React 18** with TypeScript for type-safe development
- **Vite** for lightning-fast development and optimized builds
- **React Router** for seamless navigation
- **Context API** for state management
- **Custom Hooks** for reusable logic

### **Backend & Database**
- **Firebase Firestore** for real-time database
- **Firebase Authentication** for secure user management
- **Google Cloud Storage** for file handling
- **Serverless Architecture** for scalability

### **AI & Document Processing**
- **Google Gemini API** for advanced AI capabilities
- **PDF.js** for PDF document parsing
- **Mammoth.js** for DOCX file processing
- **PPTX Parser** for PowerPoint file analysis
- **Prism.js** for code syntax highlighting

### **Development Tools**
- **TypeScript** for type safety and better development experience
- **ESLint** for code quality and consistency
- **Vite** for modern build tooling
- **Hot Module Replacement** for instant development feedback

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Firebase project with Firestore and Authentication enabled
- Google Cloud API access for Gemini AI

### Installation

1. **Clone the repository:**
```bash
git clone <repository-url>
cd academic-ai-assistant
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment variables:**
Create a `.env` file in the root directory:
```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_API_URL=your_api_url
```

4. **Start the development server:**
```bash
npm run dev
```

5. **Open your browser:**
Navigate to `http://localhost:3000`

### Production Build

```bash
npm run build
```

The production build will be generated in the `dist/` directory, optimized and ready for deployment.

## 📱 Usage

### Getting Started
1. **Sign in** with your Google account
2. **Set your profile** - Choose your education level and major (optional)
3. **Upload documents** - PDF, DOCX, or PPTX files for analysis
4. **Start chatting** - Ask questions about your documents or general academic topics
5. **Generate flashcards** - Create study materials from your content
6. **Track progress** - Monitor your learning journey

### Features Overview
- **Document Analysis**: Upload files and get AI-powered insights
- **Intelligent Chat**: Context-aware conversations with personalized responses
- **Flashcard Generation**: Create study materials automatically
- **Session Management**: Organize conversations by topic
- **Progress Tracking**: Monitor learning achievements

## 🔧 Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Create production build
- `npm run lint` - Run ESLint for code quality
- `npm run preview` - Preview production build locally

### Project Structure
```
src/
├── components/          # React components
├── services/           # Business logic and API calls
├── contexts/           # React context providers
├── hooks/              # Custom React hooks
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── pages/              # Page components
```

## 🚀 Deployment

### Firebase Hosting (Recommended)
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Initialize: `firebase init hosting`
4. Build: `npm run build`
5. Deploy: `firebase deploy`

### Other Platforms
The built application in `dist/` can be deployed to any static hosting service:
- Vercel
- Netlify
- AWS S3 + CloudFront
- GitHub Pages

## 🔒 Security & Privacy

- **Secure Authentication**: Google OAuth 2.0 integration
- **Data Encryption**: All data encrypted in transit and at rest
- **Privacy-First**: User data tied to Google accounts, not stored separately
- **Automatic Cleanup**: 24-hour data expiration for privacy
- **No Tracking**: No user behavior tracking or analytics

## 📊 Performance

- **Fast Loading**: Optimized bundle size and lazy loading
- **Real-Time Updates**: Firebase real-time synchronization
- **Efficient Queries**: Optimized database queries with indexing
- **Background Processing**: Non-blocking operations for better UX

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** and ensure tests pass
4. **Commit your changes**: `git commit -m 'Add some amazing feature'`
5. **Push to the branch**: `git push origin feature/amazing-feature`
6. **Open a Pull Request**

### Development Guidelines
- Follow TypeScript best practices
- Write meaningful commit messages
- Test your changes thoroughly
- Update documentation as needed

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or have questions:
1. Check the [Issues](https://github.com/your-repo/issues) page
2. Create a new issue with detailed information
3. Contact the development team

## 🔮 Roadmap

- [ ] Advanced AI model integration
- [ ] Collaborative study groups
- [ ] Mobile app development
- [ ] Offline mode support
- [ ] Advanced analytics dashboard
- [ ] Integration with learning management systems

---

**Built with ❤️ for students and researchers worldwide**
