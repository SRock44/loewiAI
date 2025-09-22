// Mock Authentication Service - Replace with actual Google OAuth integration
/*
// eslint-disable-next-line @typescript-eslint/no-unused-vars
class MockAuthService implements AuthService {
  private currentUser: User | null = null;
  private storageKey = 'academic-ai-auth-user';

  constructor() {
    this.loadUserFromStorage();
  }

  async signInWithGoogle(): Promise<User> {
    // Simulate Google OAuth flow
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Mock Google user data
    const mockGoogleUser: GoogleUserInfo = {
      sub: `google_${Date.now()}`,
      email: 'student@university.edu',
      name: 'John Student',
      picture: 'https://via.placeholder.com/150/667eea/ffffff?text=JS',
      email_verified: true
    };

    const user: User = {
      id: mockGoogleUser.sub,
      email: mockGoogleUser.email,
      name: mockGoogleUser.name,
      picture: mockGoogleUser.picture,
      provider: 'google',
      createdAt: new Date(),
      lastLoginAt: new Date()
    };

    this.currentUser = user;
    this.saveUserToStorage(user);
    
    return user;
  }

  async signOut(): Promise<void> {
    this.currentUser = null;
    this.clearUserFromStorage();
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  async refreshToken(): Promise<string> {
    // In a real app, this would refresh the Google OAuth token
    await new Promise(resolve => setTimeout(resolve, 500));
    return 'mock-refreshed-token';
  }

  isTokenValid(): boolean {
    // In a real app, this would check if the token is still valid
    return this.currentUser !== null;
  }

  private loadUserFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const userData = JSON.parse(stored);
        this.currentUser = {
          ...userData,
          createdAt: new Date(userData.createdAt),
          lastLoginAt: new Date(userData.lastLoginAt)
        };
      }
    } catch (error) {
      console.error('Error loading user from storage:', error);
      this.currentUser = null;
    }
  }

  private saveUserToStorage(user: User) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(user));
    } catch (error) {
      console.error('Error saving user to storage:', error);
    }
  }

  private clearUserFromStorage() {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error('Error clearing user from storage:', error);
    }
  }
}
*/

// Real Google OAuth Service (commented out for now)
/*
class GoogleAuthService implements AuthService {
  private currentUser: User | null = null;
  private storageKey = 'academic-ai-auth-user';

  constructor() {
    this.initializeGoogleAuth();
    this.loadUserFromStorage();
  }

  private initializeGoogleAuth() {
    // Initialize Google Identity Services
    if (typeof window !== 'undefined' && window.google) {
      window.google.accounts.id.initialize({
        client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
        callback: this.handleCredentialResponse.bind(this),
        auto_select: false,
        cancel_on_tap_outside: true
      });
    }
  }

  async signInWithGoogle(): Promise<User> {
    return new Promise((resolve, reject) => {
      if (typeof window !== 'undefined' && window.google) {
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            reject(new Error('Google sign-in was cancelled or not displayed'));
          }
        });
      } else {
        reject(new Error('Google Identity Services not available'));
      }
    });
  }

  private handleCredentialResponse(response: any) {
    try {
      const payload = this.parseJwt(response.credential);
      const user: User = {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        provider: 'google',
        createdAt: new Date(),
        lastLoginAt: new Date()
      };

      this.currentUser = user;
      this.saveUserToStorage(user);
      return user;
    } catch (error) {
      console.error('Error handling Google credential response:', error);
      throw error;
    }
  }

  private parseJwt(token: string) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  }

  // ... other methods similar to MockAuthService
}
*/

// Import real auth service
import { realAuthService } from './realAuthService';

// Export singleton instance
// Switch between mock and real by commenting/uncommenting these lines:

// For development/testing - uses mock Google OAuth
// export const authService = new MockAuthService();

// For production - uses real Google OAuth
export const authService = realAuthService;
