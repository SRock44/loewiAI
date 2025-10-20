import { 
  collection, 
  query, 
  where, 
  getDocs, 
  deleteDoc, 
  doc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase-config';

export class CleanupService {
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour - run cleanup every hour
  private readonly EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 hours - delete data after 24 hours
  private cleanupTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.startPeriodicCleanup();
  }

  // Start periodic cleanup
  private startPeriodicCleanup() {
    // Run cleanup immediately on startup
    this.runCleanup();
    
    // Set up periodic cleanup every hour to ensure timely deletion
    this.cleanupTimer = setInterval(() => {
      this.runCleanup();
    }, this.CLEANUP_INTERVAL);
  }

  // Stop cleanup service
  public stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  // Run cleanup process
  public async runCleanup(): Promise<void> {
    try {
      // Check if we have authentication before running cleanup
      const hasAuth = await this.checkAuthentication();
      if (!hasAuth) {
        // Skip cleanup when not authenticated to avoid permission errors
        return;
      }
      
      const cutoffTime = new Date(Date.now() - this.EXPIRY_TIME);
      
      // Cleanup chat sessions
      await this.cleanupChatSessions(cutoffTime);
      
      // Cleanup flashcard sets
      await this.cleanupFlashcardSets(cutoffTime);
      
      // Cleanup orphaned messages
      await this.cleanupOrphanedMessages(cutoffTime);
      
    } catch (error) {
      // Silent error handling - cleanup failures shouldn't affect user experience
    }
  }

  // Check if we have authentication for cleanup operations
  private async checkAuthentication(): Promise<boolean> {
    try {
      // Import the auth service to check authentication status
      const { firebaseAuthService } = await import('./firebaseAuthService');
      const currentUser = firebaseAuthService.getCurrentUser();
      return currentUser !== null;
    } catch (error) {
      // If we can't check auth, assume we don't have it
      return false;
    }
  }

  // Cleanup old chat sessions (24-hour retention policy)
  private async cleanupChatSessions(cutoffTime: Date): Promise<number> {
    try {
      const chatSessionsRef = collection(db, 'chatSessions');
      const q = query(
        chatSessionsRef,
        where('lastActivityAt', '<', Timestamp.fromDate(cutoffTime))
      );
      
      const snapshot = await getDocs(q);
      let deletedCount = 0;
      
      for (const docSnapshot of snapshot.docs) {
        // Delete the session
        await deleteDoc(doc(db, 'chatSessions', docSnapshot.id));
        deletedCount++;
        
        // Also delete associated messages
        await this.deleteSessionMessages(docSnapshot.id);
      }
      
      return deletedCount;
    } catch (error) {
      return 0;
    }
  }

  // Cleanup old flashcard sets - 24 hour deletion
  private async cleanupFlashcardSets(cutoffTime: Date): Promise<number> {
    try {
      const flashcardSetsRef = collection(db, 'flashcardSets');
      const now = new Date();
      
      // Clean up old flashcard sets (24 hours based on lastActivityAt)
      const oldSetsQuery = query(
        flashcardSetsRef,
        where('lastActivityAt', '<', Timestamp.fromDate(cutoffTime))
      );
      
      // Clean up expired flashcard sets (24 hours based on expiresAt)
      const expiredSetsQuery = query(
        flashcardSetsRef,
        where('expiresAt', '<', Timestamp.fromDate(now))
      );
      
      const [oldSnapshot, expiredSnapshot] = await Promise.all([
        getDocs(oldSetsQuery),
        getDocs(expiredSetsQuery)
      ]);
      
      let deletedCount = 0;
      
      // Delete old sets (24+ hours old)
      for (const docSnapshot of oldSnapshot.docs) {
        await deleteDoc(doc(db, 'flashcardSets', docSnapshot.id));
        deletedCount++;
      }
      
      // Delete expired sets (24+ hours old)
      for (const docSnapshot of expiredSnapshot.docs) {
        await deleteDoc(doc(db, 'flashcardSets', docSnapshot.id));
        deletedCount++;
      }
      
      return deletedCount;
    } catch (error) {
      return 0;
    }
  }

  // Cleanup orphaned messages
  private async cleanupOrphanedMessages(cutoffTime: Date): Promise<number> {
    try {
      const messagesRef = collection(db, 'messages');
      const q = query(
        messagesRef,
        where('timestamp', '<', Timestamp.fromDate(cutoffTime))
      );
      
      const snapshot = await getDocs(q);
      let deletedCount = 0;
      
      for (const docSnapshot of snapshot.docs) {
        await deleteDoc(doc(db, 'messages', docSnapshot.id));
        deletedCount++;
      }
      
      return deletedCount;
    } catch (error) {
      return 0;
    }
  }

  // Delete all messages for a specific session
  private async deleteSessionMessages(sessionId: string): Promise<void> {
    try {
      const messagesRef = collection(db, 'messages');
      const q = query(messagesRef, where('sessionId', '==', sessionId));
      
      const snapshot = await getDocs(q);
      
      for (const docSnapshot of snapshot.docs) {
        await deleteDoc(doc(db, 'messages', docSnapshot.id));
      }
    } catch (error) {
      // Silent error handling
    }
  }

  // Manual cleanup for specific user (admin function) - preserves user settings
  public async cleanupUserData(userId: string): Promise<void> {
    try {
      // Delete all chat sessions for user (but preserve user settings)
      const chatSessionsRef = collection(db, 'chatSessions');
      const chatQuery = query(chatSessionsRef, where('userId', '==', userId));
      const chatSnapshot = await getDocs(chatQuery);
      
      for (const docSnapshot of chatSnapshot.docs) {
        await deleteDoc(doc(db, 'chatSessions', docSnapshot.id));
        await this.deleteSessionMessages(docSnapshot.id);
      }
      
      // Delete all flashcard sets for user (but preserve user settings)
      const flashcardSetsRef = collection(db, 'flashcardSets');
      const flashcardQuery = query(flashcardSetsRef, where('userId', '==', userId));
      const flashcardSnapshot = await getDocs(flashcardQuery);
      
      for (const docSnapshot of flashcardSnapshot.docs) {
        await deleteDoc(doc(db, 'flashcardSets', docSnapshot.id));
      }
      
      // NOTE: User settings in 'users' collection are preserved for good UX
      
    } catch (error) {
      // Silent error handling
    }
  }

  // Get cleanup statistics
  public async getCleanupStats(): Promise<{
    totalChatSessions: number;
    totalFlashcardSets: number;
    totalMessages: number;
    oldChatSessions: number;
    oldFlashcardSets: number;
    oldMessages: number;
  }> {
    try {
      const cutoffTime = new Date(Date.now() - this.EXPIRY_TIME);
      
      // Get total counts
      const totalChatSessions = (await getDocs(collection(db, 'chatSessions'))).docs.length;
      const totalFlashcardSets = (await getDocs(collection(db, 'flashcardSets'))).docs.length;
      const totalMessages = (await getDocs(collection(db, 'messages'))).docs.length;
      
      // Get old counts
      const oldChatSessions = (await getDocs(query(
        collection(db, 'chatSessions'),
        where('lastActivityAt', '<', Timestamp.fromDate(cutoffTime))
      ))).docs.length;
      
      const oldFlashcardSets = (await getDocs(query(
        collection(db, 'flashcardSets'),
        where('lastActivityAt', '<', Timestamp.fromDate(cutoffTime))
      ))).docs.length;
      
      const oldMessages = (await getDocs(query(
        collection(db, 'messages'),
        where('timestamp', '<', Timestamp.fromDate(cutoffTime))
      ))).docs.length;
      
      return {
        totalChatSessions,
        totalFlashcardSets,
        totalMessages,
        oldChatSessions,
        oldFlashcardSets,
        oldMessages
      };
    } catch (error) {
      return {
        totalChatSessions: 0,
        totalFlashcardSets: 0,
        totalMessages: 0,
        oldChatSessions: 0,
        oldFlashcardSets: 0,
        oldMessages: 0
      };
    }
  }
}

// Export singleton instance
export const cleanupService = new CleanupService();
