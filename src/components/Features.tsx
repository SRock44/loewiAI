import React from 'react'
import './Features.css'

const Features: React.FC = () => {
  const features = [
    {
      icon: "🎴",
      title: "Flashcard Generation",
      description: "AI-powered flashcard creation from your documents and text. Generate study cards with smooth animations and mastery tracking."
    },
    {
      icon: "🎓",
      title: "Advanced Academic Advisement",
      description: "Get personalized study recommendations, course planning assistance, and academic guidance based on your goals and performance."
    },
    {
      icon: "📚",
      title: "Document Analysis",
      description: "Upload syllabi, lectures, and assignments for AI-powered analysis and key concept extraction."
    },
    {
      icon: "💬",
      title: "Intelligent Chat Assistant",
      description: "24/7 AI assistant that understands your academic context and provides instant help with questions and assignments."
    },
    {
      icon: "📖",
      title: "Study Planning",
      description: "Create effective study schedules and break down complex topics into manageable learning modules."
    },
    {
      icon: "🔍",
      title: "Research Assistance",
      description: "Find relevant academic sources and get guidance on research methodologies and citation formats."
    }
  ]

  return (
    <section id="features" className="features section">
      <div className="container">
        <div className="features-header">
          <h2 className="section-title">Academic Features</h2>
          <p className="section-subtitle">
            Enhance your academic performance with specialized tools for students and researchers.
          </p>
        </div>
        <div className="features-grid">
          {features.map((feature, index) => (
            <div key={index} className="feature-card">
              <div className="feature-icon">{feature.icon}</div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Features
