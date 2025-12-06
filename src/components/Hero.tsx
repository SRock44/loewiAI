import React from 'react'
import { AnimatedBackground } from './AnimatedBackground'
import './Hero.css'

const Hero: React.FC = () => {
  return (
    <section className="hero">
      <AnimatedBackground />
      <div className="container">
        <div className="hero-content">
          <h1 className="hero-title">
            Newton 1.0
          </h1>
          <p className="hero-subtitle">
            Next-Generation Academic AI Prototype
          </p>
          <p className="hero-description">
            Experience the future of education with Newton 1.0 - an intelligent 
            academic companion that revolutionizes how you learn, study, and 
            achieve your educational goals through advanced AI technology.
          </p>
          <div className="hero-buttons">
            <a href="/dashboard" className="btn btn-primary">
              Chat Now
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Hero
