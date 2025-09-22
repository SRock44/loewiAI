import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ArrowRight } from 'solar-icons';
import './UserProfile.css';

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
          {user.picture ? (
            <img src={user.picture} alt={user.name} />
          ) : (
            <div className="avatar-placeholder">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <span className="profile-name">{user.name}</span>
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
                {user.picture ? (
                  <img src={user.picture} alt={user.name} />
                ) : (
                  <div className="avatar-placeholder">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
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
