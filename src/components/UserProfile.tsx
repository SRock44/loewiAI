import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ArrowRight } from 'solar-icons';
import './UserProfile.css';

// Helper component for profile images with error handling
const ProfileImage: React.FC<{ src: string; alt: string; className?: string }> = ({ src, alt, className }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleImageError = () => {
    console.warn('Failed to load profile image:', src);
    setImageError(true);
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  if (imageError) {
    return (
      <div className={`avatar-placeholder ${className || ''}`}>
        {alt.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <>
      {!imageLoaded && (
        <div className={`avatar-placeholder ${className || ''}`}>
          {alt.charAt(0).toUpperCase()}
        </div>
      )}
      <img 
        src={src} 
        alt={alt}
        className={className}
        crossOrigin="anonymous"
        referrerPolicy="no-referrer"
        onError={handleImageError}
        onLoad={handleImageLoad}
        style={{ 
          display: imageLoaded ? 'block' : 'none',
          width: '100%',
          height: '100%',
          objectFit: 'cover'
        }}
      />
    </>
  );
};

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
            <ProfileImage src={user.picture} alt={user.name} />
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
                  <ProfileImage src={user.picture} alt={user.name} />
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
