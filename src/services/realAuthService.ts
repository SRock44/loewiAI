import { User, AuthService } from '../types/auth';

// Real Google OAuth Service Implementation
class RealGoogleAuthService implements AuthService {
  private currentUser: User | null = null;
  private storageKey = 'academic-ai-auth-user';

  constructor() {
    this.initializeGoogleAuth();
    this.loadUserFromStorage();
  }

  private initializeGoogleAuth() {
    console.log('Environment check - VITE_GOOGLE_CLIENT_ID:', import.meta.env.VITE_GOOGLE_CLIENT_ID);
    
    // Wait for Google Identity Services to load
    const checkGoogle = () => {
      if (typeof window !== 'undefined' && (window as any).google) {
        console.log('Google Identity Services loaded, initializing...');
        console.log('Client ID:', import.meta.env.VITE_GOOGLE_CLIENT_ID);
        
        (window as any).google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: this.handleCredentialResponse.bind(this),
          auto_select: false,
          cancel_on_tap_outside: true
        });
        
        console.log('Google Auth initialized successfully');
      } else {
        console.log('Google Identity Services not yet loaded, retrying...');
        // Retry after 100ms if Google script isn't loaded yet
        setTimeout(checkGoogle, 100);
      }
    };
    checkGoogle();
  }

  async signInWithGoogle(): Promise<User> {
    return new Promise((resolve, reject) => {
      console.log('Attempting Google sign-in...');
      
      if (typeof window !== 'undefined' && (window as any).google) {
        try {
          // Use the popup method for sign-in
          (window as any).google.accounts.oauth2.initTokenClient({
            client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
            scope: 'email profile',
            callback: (response: any) => {
              if (response.error) {
                console.error('Google OAuth error:', response.error);
                reject(new Error(response.error));
                return;
              }
              
              // Get user info using the access token
              fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${response.access_token}`)
                .then(res => res.json())
                .then(userInfo => {
                  const user: User = {
                    id: userInfo.id,
                    email: userInfo.email,
                    name: userInfo.name,
                    picture: userInfo.picture,
                    provider: 'google',
                    createdAt: new Date(),
                    lastLoginAt: new Date()
                  };

                  this.currentUser = user;
                  this.saveUserToStorage(user);
                  resolve(user);
                })
                .catch(error => {
                  console.error('Error fetching user info:', error);
                  reject(error);
                });
            }
          }).requestAccessToken();
        } catch (error) {
          console.error('Error initializing Google OAuth:', error);
          reject(error);
        }
      } else {
        console.error('Google Identity Services not available');
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
      
      // Resolve the pending sign-in promise
      if ((this as any).pendingSignIn) {
        (this as any).pendingSignIn.resolve(user);
        (this as any).pendingSignIn = null;
      }
      
      return user;
    } catch (error) {
      console.error('Error handling Google credential response:', error);
      if ((this as any).pendingSignIn) {
        (this as any).pendingSignIn.reject(error);
        (this as any).pendingSignIn = null;
      }
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

  async signOut(): Promise<void> {
    this.currentUser = null;
    this.clearUserFromStorage();
    
    // Sign out from Google
    if (typeof window !== 'undefined' && (window as any).google) {
      (window as any).google.accounts.id.disableAutoSelect();
    }
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  async refreshToken(): Promise<string> {
    // Google handles token refresh automatically
    // This is mainly for compatibility with the interface
    if (!this.currentUser) {
      throw new Error('No user signed in');
    }
    return 'google-managed-token';
  }

  isTokenValid(): boolean {
    // Google handles token validation automatically
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

// Export singleton instance
export const realAuthService = new RealGoogleAuthService();
