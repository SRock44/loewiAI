import { 
  collection, 
  doc, 
  addDoc, 
  getDocs, 
  getDoc,
  setDoc,
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase-config';
import { ChatSession, ChatMessage } from '../types/chat';
import { FlashcardSet, Flashcard } from '../types/flashcard';
import { User } from '../types/auth';

export class FirebaseService {
  // Utility method to deep clean objects and remove undefined values
  private deepCleanObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.deepCleanObject(item)).filter(item => item !== undefined);
    }
    
    if (typeof obj === 'object' && obj.constructor === Object) {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          cleaned[key] = this.deepCleanObject(value);
        }
      }
      return cleaned;
    }
    
    return obj;
  }

  // Chat Sessions
  async saveChatSession(session: ChatSession, userId: string): Promise<string> {
    try {
      // IMPORTANT:
      // - We always use the Firestore document ID as the session ID (no "firebase_" prefix).
      // - We do NOT attempt "duplicate session" detection/merging (that caused data loss and broken references).
      if (!session?.id) {
        throw new Error('ChatSession.id is required to save a session');
      }

      // Never persist empty sessions (no meaningful user/assistant messages).
      // This prevents "New Chat" from creating junk documents if something calls save early.
      const hasMeaningfulMessage = Array.isArray(session.messages) && session.messages.some((m) =>
        (m?.role === 'user' || m?.role === 'assistant') &&
        typeof m?.content === 'string' &&
        m.content.trim().length > 0
      );
      if (!hasMeaningfulMessage) {
        return session.id;
      }

      const sessionRef = doc(db, 'chatSessions', session.id);

      // Do not persist a nested `id` field; Firestore doc ID is the canonical ID.
      // Also strip undefined values to avoid Firestore errors.
      const rest: any = { ...(session as any) };
      delete rest.id;
      const cleanSession = this.deepCleanObject(rest);

      const toSave: Record<string, unknown> = {
        ...cleanSession,
        userId,
        updatedAt: serverTimestamp(),
        lastActivityAt: serverTimestamp()
      };

      // Only set createdAt if the document doesn't already have one
      if (!cleanSession.createdAt) {
        toSave.createdAt = serverTimestamp();
      }

      await setDoc(sessionRef, toSave, { merge: true });
      return session.id;
    } catch (error) {
      console.error('Error saving chat session:', error);
      throw error;
    }
  }

  async getChatSessions(userId: string): Promise<ChatSession[]> {
    try {
      const q = query(
        collection(db, 'chatSessions'),
        where('userId', '==', userId),
        orderBy('updatedAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        // Ignore any stored local `id` field in the document; doc.id is source of truth.
        const dataWithoutId: any = { ...(data as any) };
        delete dataWithoutId.id;
        const messages = Array.isArray((data as any).messages)
          ? ((data as any).messages as any[]).map((m) => ({
              ...m,
              timestamp: m?.timestamp?.toDate ? m.timestamp.toDate() : m?.timestamp
            }))
          : [];
        return {
          id: doc.id,
          ...dataWithoutId,
          messages,
          // Convert Firestore Timestamps to Date objects
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
          lastActivityAt: data.lastActivityAt?.toDate ? data.lastActivityAt.toDate() : data.lastActivityAt
        } as ChatSession;
      });
    } catch (error) {
      // Error getting chat sessions
      return [];
    }
  }

  async updateChatSession(sessionId: string, updates: Partial<ChatSession>): Promise<void> {
    try {
      const sessionRef = doc(db, 'chatSessions', sessionId);
      
      // Filter out invalid dates and convert valid dates to serverTimestamp
      const cleanUpdates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value instanceof Date && !isNaN(value.getTime())) {
          // Valid date - convert to serverTimestamp
          if (key === 'updatedAt' || key === 'createdAt' || key === 'lastActivityAt') {
            cleanUpdates[key] = serverTimestamp();
          } else {
            cleanUpdates[key] = value;
          }
        } else if (value instanceof Date && isNaN(value.getTime())) {
          // Invalid date - skip this field
          // Skipping invalid date for field
        } else {
          // Non-date field - keep as is
          cleanUpdates[key] = value;
        }
      }
      
      await updateDoc(sessionRef, {
        ...cleanUpdates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating chat session:', error);
      throw error;
    }
  }

  async deleteChatSession(sessionId: string): Promise<void> {
    try {
      console.log('🗑️ Firebase: Deleting chat session:', sessionId);
      await deleteDoc(doc(db, 'chatSessions', sessionId));
      console.log('✅ Firebase: Chat session deleted successfully');
    } catch (error) {
      console.error('❌ Firebase: Error deleting chat session:', error);
      throw error;
    }
  }

  async deleteSessionMessages(sessionId: string): Promise<void> {
    try {
      console.log('🗑️ Firebase: Deleting messages for session:', sessionId);
      const messagesRef = collection(db, 'messages');
      const q = query(messagesRef, where('sessionId', '==', sessionId));
      const snapshot = await getDocs(q);
      
      console.log(`🗑️ Firebase: Found ${snapshot.docs.length} messages to delete`);
      const deletePromises = snapshot.docs.map(docSnapshot => 
        deleteDoc(doc(db, 'messages', docSnapshot.id))
      );
      
      await Promise.all(deletePromises);
      console.log('✅ Firebase: Session messages deleted successfully');
    } catch (error) {
      console.error('❌ Firebase: Error deleting session messages:', error);
      throw error;
    }
  }

  // Real-time chat session updates
  subscribeToChatSessions(userId: string, callback: (sessions: ChatSession[]) => void) {
    const q = query(
      collection(db, 'chatSessions'),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    );
    
    return onSnapshot(q, (snapshot) => {
      const sessions = snapshot.docs.map(docSnap => {
        const data = docSnap.data() as any;
        const dataWithoutId: any = { ...(data as any) };
        delete dataWithoutId.id;
        const messages = Array.isArray(data.messages)
          ? (data.messages as any[]).map((m) => ({
              ...m,
              timestamp: m?.timestamp?.toDate ? m.timestamp.toDate() : m?.timestamp
            }))
          : [];
        return {
          id: docSnap.id,
          ...dataWithoutId,
          messages,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
          lastActivityAt: data.lastActivityAt?.toDate ? data.lastActivityAt.toDate() : data.lastActivityAt
        } as ChatSession;
      });
      callback(sessions);
    });
  }

  // Messages
  async saveMessage(sessionId: string, message: ChatMessage): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'messages'), {
        ...message,
        sessionId,
        createdAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error saving message:', error);
      throw error;
    }
  }

  async getMessages(sessionId: string): Promise<ChatMessage[]> {
    try {
      const q = query(
        collection(db, 'messages'),
        where('sessionId', '==', sessionId),
        orderBy('timestamp', 'asc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatMessage[];
    } catch (error) {
      console.error('Error getting messages:', error);
      return [];
    }
  }

  // Real-time message updates
  subscribeToMessages(sessionId: string, callback: (messages: ChatMessage[]) => void) {
    const q = query(
      collection(db, 'messages'),
      where('sessionId', '==', sessionId),
      orderBy('timestamp', 'asc')
    );
    
    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatMessage[];
      callback(messages);
    });
  }

  // Flashcards
  async saveFlashcardSet(flashcardSet: FlashcardSet, userId: string): Promise<string> {
    try {
      // Deep clean the flashcard set to remove undefined values
      const cleanFlashcardSet = this.deepCleanObject(flashcardSet);
      
      // Check for duplicate flashcard sets to prevent duplicates
      const existingSet = await this.findDuplicateFlashcardSet(flashcardSet, userId);
      if (existingSet) {
        // Found duplicate flashcard set, updating existing instead of creating new one
        const setRef = doc(db, 'flashcardSets', existingSet.id);
        await updateDoc(setRef, {
          ...cleanFlashcardSet,
          userId,
          updatedAt: serverTimestamp(),
          lastActivityAt: serverTimestamp()
        });
        return existingSet.id;
      }

      // Calculate expiration time (24 hours from now)
      const expirationTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      // Create new flashcard set only if no duplicates found
      // Creating new flashcard set
      const docRef = await addDoc(collection(db, 'flashcardSets'), {
        ...cleanFlashcardSet,
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastActivityAt: serverTimestamp(), // Track activity for cleanup
        expiresAt: expirationTime // 24-hour expiration
      });
      return docRef.id;
    } catch (error) {
      console.error('Error saving flashcard set:', error);
      throw error;
    }
  }

  private async findDuplicateFlashcardSet(flashcardSet: FlashcardSet, userId: string): Promise<{ id: string } | null> {
    try {
      // Look for flashcard sets with same title and similar content
      const setsQuery = query(
        collection(db, 'flashcardSets'),
        where('userId', '==', userId),
        where('title', '==', flashcardSet.title)
      );
      
      const snapshot = await getDocs(setsQuery);
      
      for (const doc of snapshot.docs) {
        const data = doc.data();
        // Check if flashcards are similar (same number and similar content)
        if (data.flashcards && flashcardSet.flashcards && 
            data.flashcards.length === flashcardSet.flashcards.length) {
          // Simple duplicate check: compare first few flashcards
          const isDuplicate = this.areFlashcardsSimilar(data.flashcards, flashcardSet.flashcards);
          if (isDuplicate) {
            return { id: doc.id };
          }
        }
      }
      
      return null;
    } catch (error) {
      // Error checking for duplicates
      return null;
    }
  }

  private areFlashcardsSimilar(flashcards1: Flashcard[], flashcards2: Flashcard[]): boolean {
    if (flashcards1.length !== flashcards2.length) return false;
    
    // Check first 3 flashcards for similarity
    const checkCount = Math.min(3, flashcards1.length);
    for (let i = 0; i < checkCount; i++) {
      const card1 = flashcards1[i];
      const card2 = flashcards2[i];
      
      if (card1.question !== card2.question || 
          card1.answer !== card2.answer) {
        return false;
      }
    }
    
    return true;
  }

  async getFlashcardSets(userId: string): Promise<FlashcardSet[]> {
    try {
      if (!userId) {
        return [];
      }
      
      const q = query(
        collection(db, 'flashcardSets'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const now = new Date();
      
      const flashcardSets = snapshot.docs
        .map(doc => {
          const data = doc.data();
          if (!data) {
            return null;
          }
          
          // Always use the Firebase document ID, ignore any stored local ID
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id: _storedId, ...dataWithoutId } = data;
          const flashcardSet = {
            id: doc.id, // Always use the Firebase document ID
            ...dataWithoutId,
            // Convert Firestore Timestamps to Date objects
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
            lastActivityAt: data.lastActivityAt?.toDate ? data.lastActivityAt.toDate() : data.lastActivityAt,
            expiresAt: data.expiresAt?.toDate ? data.expiresAt.toDate() : data.expiresAt
          } as FlashcardSet;
          
          // Loaded flashcard set from Firebase
          
          return flashcardSet;
        })
        .filter((flashcardSet): flashcardSet is FlashcardSet => {
          if (!flashcardSet) return false;
          
          // Filter out expired flashcard sets (24 hours)
          if (flashcardSet.expiresAt) {
            return flashcardSet.expiresAt > now;
          }
          return true; // Keep sets without expiration (backward compatibility)
        });

      return flashcardSets;
    } catch (error) {
      console.error('Error getting flashcard sets:', error);
      return [];
    }
  }

  async updateFlashcardSet(setId: string, updates: Partial<FlashcardSet>): Promise<void> {
    try {
      const setRef = doc(db, 'flashcardSets', setId);
      const cleanUpdates = this.deepCleanObject(updates);
      await updateDoc(setRef, {
        ...cleanUpdates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating flashcard set:', error);
      throw error;
    }
  }

  async deleteFlashcardSet(setId: string, userId: string): Promise<void> {
    try {
      console.log('🔍 Checking flashcard set for deletion:', { setId, userId });
      
      // First verify the flashcard set belongs to the user
      const setRef = doc(db, 'flashcardSets', setId);
      const setDoc = await getDoc(setRef);
      
      if (!setDoc.exists()) {
        console.error('❌ Flashcard set not found in Firebase:', setId);
        throw new Error('Flashcard set not found');
      }
      
      const setData = setDoc.data();
      console.log('📋 Flashcard set data:', { 
        setId, 
        setUserId: setData.userId, 
        requestingUserId: userId,
        title: setData.title,
        hasLocalId: setId.startsWith('set_')
      });
      
      if (setData.userId !== userId) {
        console.error('❌ Access denied - flashcard set belongs to different user');
        throw new Error('Access denied - flashcard set belongs to different user');
      }
      
      console.log('✅ User authorized, proceeding with deletion');
      await deleteDoc(setRef);
      console.log('✅ Successfully deleted flashcard set from Firebase');
    } catch (error) {
      console.error('Error deleting flashcard set:', error);
      throw error;
    }
  }


  // More aggressive cleanup - can be called manually
  async aggressiveCleanupDuplicates(): Promise<{
    totalSessions: number;
    duplicatesRemoved: number;
    usersProcessed: number;
  }> {
    try {
      
      // Get all sessions from all users
      const sessionsQuery = query(collection(db, 'chatSessions'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(sessionsQuery);
      const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatSession & { id: string; userId: string }));
      
      
      // Group by user
      const userSessions = new Map<string, (ChatSession & { id: string; userId: string })[]>();
      sessions.forEach(session => {
        const userId = (session as any).userId;
        if (!userSessions.has(userId)) {
          userSessions.set(userId, []);
        }
        userSessions.get(userId)!.push(session);
      });
      
      let totalDuplicates = 0;
      const usersProcessed = userSessions.size;
      
      // Process each user
      for (const [, userSessionList] of userSessions) {
        const duplicates = new Map<string, (ChatSession & { id: string })[]>();
        const toDelete: string[] = [];
        
        // Group sessions by title and message count
        userSessionList.forEach(session => {
          const key = `${session.title}_${session.messages?.length || 0}`;
          if (!duplicates.has(key)) {
            duplicates.set(key, []);
          }
          duplicates.get(key)!.push(session);
        });
        
        // Find duplicates
        duplicates.forEach(group => {
          if (group.length > 1) {
            // Sort by createdAt, keep newest
            group.sort((a, b) => {
              const aTime = (a.createdAt as any)?.toDate?.() || a.createdAt || new Date(0);
              const bTime = (b.createdAt as any)?.toDate?.() || b.createdAt || new Date(0);
              return new Date(bTime).getTime() - new Date(aTime).getTime();
            });
            
            // Mark for deletion
            group.slice(1).forEach(session => {
              toDelete.push(session.id);
            });
          }
        });
        
        // Delete duplicates
        for (const sessionId of toDelete) {
          try {
            await deleteDoc(doc(db, 'chatSessions', sessionId));
            totalDuplicates++;
          } catch (error) {
            console.error(`Error deleting session ${sessionId}:`, error);
          }
        }
      }
      
      
      return {
        totalSessions: sessions.length,
        duplicatesRemoved: totalDuplicates,
        usersProcessed
      };
      
    } catch (error) {
      console.error('Error in aggressive cleanup:', error);
      return {
        totalSessions: 0,
        duplicatesRemoved: 0,
        usersProcessed: 0
      };
    }
  }

  // Automatic cleanup methods - 24 hour deletion for chats and flashcards
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
      
      // Clean up sessions older than 24 hours based on lastActivityAt
      const sessionsQuery = query(
        collection(db, 'chatSessions'),
        where('lastActivityAt', '<', twentyFourHoursAgo)
      );
      
      const snapshot = await getDocs(sessionsQuery);
      const expiredSessions = snapshot.docs;
      
      let deletedCount = 0;
      for (const sessionDoc of expiredSessions) {
        try {
          // Delete associated messages first, then the session
          await this.deleteSessionMessages(sessionDoc.id);
          await deleteDoc(doc(db, 'chatSessions', sessionDoc.id));
          
          deletedCount++;
        } catch (error) {
          console.error(`Error deleting expired session ${sessionDoc.id}:`, error);
        }
      }
      
      if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} expired chat sessions (24+ hours old)`);
      }
      
      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
      return 0;
    }
  }

  async cleanupExpiredFlashcards(): Promise<number> {
    try {
      const now = new Date();
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
      
      let deletedCount = 0;
      
      // Clean up flashcards that have expired (expiresAt < now) - 24 hour expiration
      const expiredFlashcardsQuery = query(
        collection(db, 'flashcardSets'),
        where('expiresAt', '<', now)
      );
      
      const expiredSnapshot = await getDocs(expiredFlashcardsQuery);
      for (const flashcardDoc of expiredSnapshot.docs) {
        try {
          await deleteDoc(doc(db, 'flashcardSets', flashcardDoc.id));
          deletedCount++;
        } catch (error) {
          console.error(`Error deleting expired flashcard ${flashcardDoc.id}:`, error);
        }
      }
      
      // Also clean up old flashcards without expiresAt field (backward compatibility)
      // Delete any flashcard sets older than 24 hours based on createdAt
      const oldFlashcardsQuery = query(
        collection(db, 'flashcardSets'),
        where('createdAt', '<', twentyFourHoursAgo)
      );
      
      const oldSnapshot = await getDocs(oldFlashcardsQuery);
      for (const flashcardDoc of oldSnapshot.docs) {
        const data = flashcardDoc.data();
        // Only delete if it doesn't have an expiresAt field (backward compatibility)
        if (!data.expiresAt) {
          try {
            await deleteDoc(doc(db, 'flashcardSets', flashcardDoc.id));
            deletedCount++;
          } catch (error) {
            console.error(`Error deleting old flashcard ${flashcardDoc.id}:`, error);
          }
        }
      }
      
      if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} expired flashcard sets (24+ hours old)`);
      }
      
      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up expired flashcards:', error);
      return 0;
    }
  }

  // Run all cleanup operations
  async runAutomaticCleanup(): Promise<{
    expiredSessions: number;
    expiredFlashcards: number;
    duplicatesRemoved: number;
  }> {
    // No-op: we keep everything permanently.
    return {
      expiredSessions: 0,
      expiredFlashcards: 0,
      duplicatesRemoved: 0
    };
  }

  // Override cleanupDuplicateSessions to handle 'all' users
  async cleanupDuplicateSessions(userId: string): Promise<number> {
    if (userId === 'all') {
      return await this.aggressiveCleanupDuplicates().then(result => result.duplicatesRemoved);
    }
    
    try {
      const sessionsQuery = query(
        collection(db, 'chatSessions'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(sessionsQuery);
      const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatSession & { id: string; userId: string }));
      
      const duplicates = new Map<string, (ChatSession & { id: string; userId: string })[]>();
      const toDelete: string[] = [];
      
      // Group sessions by title and message content
      sessions.forEach(session => {
        const key = `${session.title}_${session.messages?.length || 0}`;
        if (!duplicates.has(key)) {
          duplicates.set(key, []);
        }
        duplicates.get(key)!.push(session);
      });
      
      // Identify duplicates (keep the most recent one)
      duplicates.forEach(group => {
        if (group.length > 1) {
          // Sort by createdAt, keep the newest
          group.sort((a, b) => {
            const aTime = (a.createdAt as any)?.toDate?.() || a.createdAt || new Date(0);
            const bTime = (b.createdAt as any)?.toDate?.() || b.createdAt || new Date(0);
            return new Date(bTime).getTime() - new Date(aTime).getTime();
          });
          // Mark all but the first (newest) for deletion
          group.slice(1).forEach(session => {
            toDelete.push(session.id);
          });
        }
      });
      
      // Delete duplicate sessions
      for (const sessionId of toDelete) {
        try {
          await deleteDoc(doc(db, 'chatSessions', sessionId));
        } catch (error) {
          // Error deleting individual session
        }
      }
      
      return toDelete.length;
    } catch (error) {
      console.error('Error cleaning up duplicate sessions:', error);
      return 0;
    }
  }

  async getDatabaseStats(userId: string): Promise<{
    totalSessions: number;
    totalMessages: number;
    totalFlashcards: number;
    duplicatesFound: number;
  }> {
    try {
      // Get chat sessions
      const sessionsQuery = query(
        collection(db, 'chatSessions'),
        where('userId', '==', userId)
      );
      const sessionsSnapshot = await getDocs(sessionsQuery);
      const sessions = sessionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatSession & { id: string }));
      
      // Count messages
      let totalMessages = 0;
      sessions.forEach(session => {
        totalMessages += session.messages?.length || 0;
      });
      
      // Get flashcard sets
      const flashcardsQuery = query(
        collection(db, 'flashcardSets'),
        where('userId', '==', userId)
      );
      const flashcardsSnapshot = await getDocs(flashcardsQuery);
      
      // Count flashcards
      let totalFlashcards = 0;
      flashcardsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        totalFlashcards += data.flashcards?.length || 0;
      });
      
      // Check for duplicates
      const duplicates = new Map<string, (ChatSession & { id: string })[]>();
      sessions.forEach(session => {
        const key = `${session.title}_${session.messages?.length || 0}`;
        if (!duplicates.has(key)) {
          duplicates.set(key, []);
        }
        duplicates.get(key)!.push(session);
      });
      
      let duplicatesFound = 0;
      duplicates.forEach(group => {
        if (group.length > 1) {
          duplicatesFound += group.length - 1;
        }
      });
      
      return {
        totalSessions: sessions.length,
        totalMessages,
        totalFlashcards,
        duplicatesFound
      };
    } catch (error) {
      console.error('Error getting database stats:', error);
      return {
        totalSessions: 0,
        totalMessages: 0,
        totalFlashcards: 0,
        duplicatesFound: 0
      };
    }
  }

  // User Profile
  async saveUserProfile(user: User): Promise<void> {
    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        ...user,
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      // If user doesn't exist, create them
      try {
        await addDoc(collection(db, 'users'), {
          ...user,
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp()
        });
      } catch (createError) {
        console.error('Error creating user profile:', createError);
        throw createError;
      }
    }
  }

  async getUserProfile(userId: string): Promise<User | null> {
    try {
      const q = query(
        collection(db, 'users'),
        where('id', '==', userId)
      );
      
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      
      const userDoc = snapshot.docs[0];
      return {
        id: userDoc.id,
        ...userDoc.data()
      } as User;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  async saveUserSettings(userId: string, settings: { educationLevel: string; major: string }): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        educationLevel: settings.educationLevel,
        major: settings.major,
        updatedAt: serverTimestamp()
      });
    } catch (error: any) {
      // If user doesn't exist, create them with settings
      if (error.code === 'not-found') {
        await setDoc(doc(db, 'users', userId), {
          id: userId,
          educationLevel: settings.educationLevel,
          major: settings.major,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } else {
        throw error;
      }
    }
  }

  async getUserSettings(userId: string): Promise<{ educationLevel: string; major: string }> {
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        return {
          educationLevel: data.educationLevel || '',
          major: data.major || ''
        };
      }
      
      return { educationLevel: '', major: '' };
    } catch (error) {
      // Error getting user settings
      return { educationLevel: '', major: '' };
    }
  }

  // Batch operations for better performance
  async batchSaveMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
    try {
      const batch = writeBatch(db);
      
      messages.forEach(message => {
        const docRef = doc(collection(db, 'messages'));
        batch.set(docRef, {
          ...message,
          sessionId,
          createdAt: serverTimestamp()
        });
      });
      
      await batch.commit();
    } catch (error) {
      console.error('Error batch saving messages:', error);
      throw error;
    }
  }

}

// Export singleton instance
export const firebaseService = new FirebaseService();
