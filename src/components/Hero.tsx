import React from 'react'
import './Hero.css'

const Hero: React.FC = () => {
  return (
    <section className="hero">
      <div className="container">
        <div className="hero-content">
          <h1 className="hero-title">
            Academic AI Assistant
          </h1>
          <p className="hero-subtitle">
            Intelligent Advisor and Learning Companion
          </p>
          <p className="hero-description">
            Your 24/7 virtual advisor providing instant academic guidance, 
            syllabus-based recommendations, and gamified learning experiences 
            to help you achieve your academic goals.
          </p>
          <div className="hero-buttons">
            <a href="/dashboard" className="btn btn-primary">
              Get Started
            </a>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-illustration">
            <div className="ai-icon">🤖</div>
            <div className="learning-elements">
              <div className="element">📚</div>
              <div className="element">🎯</div>
              <div className="element">⚡</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Hero
