import React from 'react'
import './Features.css'

const Features: React.FC = () => {
  const features = [
    {
      icon: "📚",
      title: "Document Analysis",
      description: "Upload syllabi, lectures, and assignments for AI-powered analysis and key concept extraction."
    },
    {
      icon: "🎓",
      title: "Academic Guidance",
      description: "Get personalized study recommendations and course planning assistance based on your academic goals."
    },
    {
      icon: "📝",
      title: "Assignment Support",
      description: "Receive help with understanding assignment requirements and structuring your academic work."
    },
    {
      icon: "🔍",
      title: "Research Assistance",
      description: "Find relevant academic sources and get guidance on research methodologies and citation formats."
    },
    {
      icon: "📖",
      title: "Study Planning",
      description: "Create effective study schedules and break down complex topics into manageable learning modules."
    },
    {
      icon: "🎯",
      title: "Academic Goals",
      description: "Track your academic progress and receive recommendations to achieve your educational objectives."
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
