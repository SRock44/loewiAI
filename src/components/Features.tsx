import React, { useState, useEffect, useRef } from 'react'
import { ClipboardList, Home, TextSquare, ChatSquare, Calendar, QuestionCircle } from 'solar-icons'
import './Features.css'

const Features: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
      }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current);
      }
    };
  }, []);

  const features = [
    {
      icon: ClipboardList,
      title: "Flashcard Generation",
      description: "AI-powered flashcard creation from your documents and text. Generate study cards with smooth animations and mastery tracking."
    },
    {
      icon: Home,
      title: "Advanced Academic Advisement",
      description: "Get personalized study recommendations, course planning assistance, and academic guidance based on your goals and performance."
    },
    {
      icon: TextSquare,
      title: "Document Analysis",
      description: "Upload syllabi, lectures, and assignments for AI-powered analysis and key concept extraction."
    },
    {
      icon: ChatSquare,
      title: "Intelligent Chat Assistant",
      description: "24/7 AI assistant that understands your academic context and provides instant help with questions and assignments."
    },
    {
      icon: Calendar,
      title: "Study Planning",
      description: "Create effective study schedules and break down complex topics into manageable learning modules."
    },
    {
      icon: QuestionCircle,
      title: "Research Assistance",
      description: "Find relevant academic sources and get guidance on research methodologies and citation formats."
    }
  ]

  return (
    <section ref={sectionRef} id="features" className="features section">
      <div className="container">
        <div className="features-header">
          <h2 className={`section-title ${isVisible ? 'animate' : ''}`}>Academic Features</h2>
          <p className={`section-subtitle ${isVisible ? 'animate' : ''}`}>
            Enhance your academic performance with specialized tools for students and researchers.
          </p>
        </div>
        <div className="features-grid">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <div 
                key={index} 
                className={`feature-card ${isVisible ? 'animate' : ''}`} 
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="feature-icon">
                  <IconComponent size={48} />
                </div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  )
}

export default Features
