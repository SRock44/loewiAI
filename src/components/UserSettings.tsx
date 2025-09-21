import React, { useState, useEffect } from 'react';
import { UserProfileService } from '../services/userProfileService';
import './UserSettings.css';

interface UserSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSignOut: () => void;
}

const UserSettings: React.FC<UserSettingsProps> = ({ isOpen, onClose, onSignOut }) => {
  const [educationLevel, setEducationLevel] = useState<string>('');
  const [major, setMajor] = useState<string>('');

  useEffect(() => {
    // Load saved settings using the service
    const profile = UserProfileService.getUserProfile();
    setEducationLevel(profile.educationLevel);
    setMajor(profile.major);
  }, []);

  const handleSave = () => {
    // Save settings using the service
    UserProfileService.saveUserProfile({
      educationLevel,
      major
    });
    onClose();
  };

  const handleSignOut = () => {
    onSignOut();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="settings-overlay">
      <div className="settings-modal">
        <div className="settings-header">
          <h2>User Settings</h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        
        <div className="settings-content">
          <div className="setting-group">
            <label htmlFor="education-level">Education Level</label>
            <select
              id="education-level"
              value={educationLevel}
              onChange={(e) => setEducationLevel(e.target.value)}
            >
              <option value="">Select your education level</option>
              <option value="high-school">High School</option>
              <option value="associates">Associate's Degree</option>
              <option value="bachelors">Bachelor's Degree</option>
              <option value="masters">Master's Degree</option>
              <option value="phd">PhD/Doctorate</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="setting-group">
            <label htmlFor="major">Major/Field of Study (Optional)</label>
            <input
              id="major"
              type="text"
              value={major}
              onChange={(e) => setMajor(e.target.value)}
              placeholder="e.g., Computer Science, Biology, Business..."
            />
          </div>
        </div>

        <div className="settings-footer">
          <button className="sign-out-btn" onClick={handleSignOut}>
            Sign Out
          </button>
          <button className="save-btn" onClick={handleSave}>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserSettings;
