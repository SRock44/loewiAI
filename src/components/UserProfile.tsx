import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ArrowRight } from '@solar-icons/react';
import './UserProfile.css';

// User Plus SVG Icon Component
const ProfileIcon: React.FC<{ size?: number; className?: string }> = ({ size = 24, className }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    className={className}
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <line x1="19" y1="8" x2="19" y2="14"/>
    <line x1="22" y1="11" x2="16" y2="11"/>
  </svg>
);

const UserProfile: React.FC = () => {
  const { user, signOut, isAuthenticated } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);

  if (!isAuthenticated || !user) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    setShowDropdown(false);
  };

  return (
    <div className="user-profile">
      <button
        className="profile-button"
        onClick={() => setShowDropdown(!showDropdown)}
        aria-label="User profile"
      >
        <div className="profile-avatar">
          <ProfileIcon size={20} />
        </div>
        <span className="profile-name">{user.name || 'User'}</span>
        <ArrowRight 
          className={`dropdown-arrow ${showDropdown ? 'open' : ''}`}
          size={12}
        />
      </button>

      {showDropdown && (
        <div className="profile-dropdown">
          <div className="dropdown-header">
            <div className="user-info">
              <div className="user-avatar">
                <div className="avatar-icon-large">
                  <ProfileIcon size={32} />
                </div>
              </div>
              <div className="user-details">
                <h4>{user.name}</h4>
                <p>{user.email}</p>
              </div>
            </div>
          </div>

          <div className="dropdown-divider"></div>

          <div className="dropdown-actions">
            <button className="dropdown-item">
              <span className="item-icon">⚙️</span>
              Settings
            </button>
            <button className="dropdown-item">
              <span className="item-icon">📊</span>
              Learning Progress
            </button>
            <button className="dropdown-item">
              <span className="item-icon">📚</span>
              My Documents
            </button>
          </div>

          <div className="dropdown-divider"></div>

          <button className="dropdown-item sign-out" onClick={handleSignOut}>
            <span className="item-icon">🚪</span>
            Sign Out
          </button>
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {showDropdown && (
        <div
          className="dropdown-backdrop"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
};

export default UserProfile;
