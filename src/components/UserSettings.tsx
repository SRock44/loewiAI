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
  const [responsePreferences, setResponsePreferences] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadUserProfile();
    }
  }, [isOpen]);

  const loadUserProfile = async () => {
    setIsLoading(true);
    try {
      const profile = await UserProfileService.getUserProfile();
      setEducationLevel(profile.educationLevel);
      setMajor(profile.major);
      setResponsePreferences(profile.responsePreferences ?? '');
    } catch {
      // Error loading user profile
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await UserProfileService.saveUserProfile({
        educationLevel,
        major,
        responsePreferences
      });
      onClose();
    } catch {
      // Error saving user profile
    } finally {
      setIsSaving(false);
    }
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
          <h2>Settings</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="settings-content">
          {isLoading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Loading your settings...</p>
            </div>
          ) : (
            <>
              {/* ── Academic Profile ── */}
              <div className="settings-section">
                <span className="settings-section-label">Academic Profile</span>

                <div className="setting-group">
                  <label htmlFor="education-level">Education Level</label>
                  <select
                    id="education-level"
                    value={educationLevel}
                    onChange={(e) => setEducationLevel(e.target.value)}
                    disabled={isSaving}
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
                  <label htmlFor="major">
                    Field of Study
                    <span className="label-optional"> — optional</span>
                  </label>
                  <input
                    id="major"
                    type="text"
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    placeholder="e.g. Computer Science, Biology, Business"
                    disabled={isSaving}
                  />
                </div>
              </div>

              {/* ── Response Preferences ── */}
              <div className="settings-section">
                <span className="settings-section-label">
                  Response Preferences
                </span>
                <p className="settings-section-hint">
                  The AI will always follow what you write here.
                </p>

                <div className="setting-group">
                  <textarea
                    id="response-preferences"
                    className="preferences-textarea"
                    value={responsePreferences}
                    onChange={(e) => setResponsePreferences(e.target.value)}
                    placeholder={`e.g. Use simple language, keep answers short, always give a worked example, use bullet points...`}
                    disabled={isSaving}
                    rows={4}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="settings-footer">
          <button className="sign-out-btn" onClick={handleSignOut} disabled={isSaving}>
            Sign Out
          </button>
          <button className="save-btn" onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default UserSettings;
