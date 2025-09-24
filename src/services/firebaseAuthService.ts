import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { auth } from '../firebase-config';
import { User, AuthService } from '../types/auth';

// Firebase Authentication Service
class FirebaseAuthService implements AuthService {
  private currentUser: User | null = null;
  private authStateListeners: ((user: User | null) => void)[] = [];

  constructor() {
    // Listen for authentication state changes
    onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        this.currentUser = this.convertFirebaseUser(firebaseUser);
        // User signed in
      } else {
        this.currentUser = null;
        // User signed out
      }
      
      // Notify all listeners
      this.authStateListeners.forEach(listener => listener(this.currentUser));
    });
  }

  private convertFirebaseUser(firebaseUser: FirebaseUser): User {
    return {
      id: firebaseUser.uid,
      email: firebaseUser.email || '',
      name: firebaseUser.displayName || '',
      picture: firebaseUser.photoURL || '',
      provider: 'google',
      createdAt: new Date(),
      lastLoginAt: new Date()
    };
  }

  async signInWithGoogle(): Promise<User> {
    try {
      
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      
      const result = await signInWithPopup(auth, provider);
      const user = this.convertFirebaseUser(result.user);
      
      // Firebase Google sign-in successful
      return user;
    } catch (error: unknown) {
      // Firebase Google sign-in failed
      throw new Error(`Sign-in failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async signOut(): Promise<void> {
    try {
      // Signing out
      await signOut(auth);
      // Sign-out successful
    } catch (error: unknown) {
      // Sign-out failed
      throw new Error(`Sign-out failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  async refreshToken(): Promise<string> {
    // Firebase handles token refresh automatically
    // Return the current user's ID token
    if (this.currentUser && auth.currentUser) {
      return await auth.currentUser.getIdToken(true);
    }
    throw new Error('No authenticated user');
  }

  isTokenValid(): boolean {
    // Firebase handles token validation automatically
    // Return true if user is authenticated
    return this.currentUser !== null && auth.currentUser !== null;
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  // Add listener for authentication state changes
  onAuthStateChange(callback: (user: User | null) => void): () => void {
    this.authStateListeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.authStateListeners.indexOf(callback);
      if (index > -1) {
        this.authStateListeners.splice(index, 1);
      }
    };
  }

  // Get the current Firebase user (for direct Firebase operations)
  getFirebaseUser(): FirebaseUser | null {
    return auth.currentUser;
  }
}

// Export singleton instance
export const firebaseAuthService = new FirebaseAuthService();
