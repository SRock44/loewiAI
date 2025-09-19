import React from 'react'
import './Features.css'

const Features: React.FC = () => {
  const features = [
    {
      icon: "🤖",
      title: "24/7 AI Advisor",
      description: "Get instant responses to academic queries anytime, anywhere with our intelligent AI assistant."
    },
    {
      icon: "📋",
      title: "Syllabus-Based Guidance",
      description: "Receive personalized recommendations for study materials and resources based on your course syllabus."
    },
    {
      icon: "🎮",
      title: "Gamified Learning",
      description: "Stay motivated with engaging gamification elements that make learning fun and rewarding."
    },
    {
      icon: "⚡",
      title: "Instant Access",
      description: "No more waiting for advisor appointments. Get immediate help when you need it most."
    },
    {
      icon: "🎯",
      title: "Goal Tracking",
      description: "Set and track your academic goals with our intelligent progress monitoring system."
    },
    {
      icon: "📊",
      title: "Performance Analytics",
      description: "Get insights into your learning patterns and areas for improvement."
    }
  ]

  return (
    <section id="features" className="features section">
      <div className="container">
        <div className="features-header">
          <h2 className="section-title">Why Choose Academic AI Assistant?</h2>
          <p className="section-subtitle">
            Transform your academic journey with intelligent assistance and engaging learning experiences.
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
