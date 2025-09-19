// Authentication Types

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  provider: 'google';
  createdAt: Date;
  lastLoginAt: Date;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

export interface AuthContextType extends AuthState {
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export interface GoogleAuthResponse {
  credential: string;
  select_by: string;
}

export interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture: string;
  email_verified: boolean;
}

// Storage keys
export const AUTH_STORAGE_KEY = 'academic-ai-auth';
export const USER_STORAGE_KEY = 'academic-ai-user';

// Google OAuth Configuration
export const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';
export const GOOGLE_SCOPES = [
  'openid',
  'profile',
  'email'
];

// Authentication service interface
export interface AuthService {
  signInWithGoogle(): Promise<User>;
  signOut(): Promise<void>;
  getCurrentUser(): User | null;
  refreshToken(): Promise<string>;
  isTokenValid(): boolean;
}
