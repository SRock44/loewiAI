import { 
  collection, 
  query, 
  getDocs, 
  deleteDoc, 
  doc,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase-config';

export interface CleanupStats {
  totalSessions: number;
  emptySessions: number;
  deletedSessions: number;
  totalMessages: number;
  orphanedMessages: number;
  deletedMessages: number;
}

export class DatabaseCleanupService {
  private readonly CLEANUP_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
  private cleanupTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.startPeriodicCleanup();
  }

  // Start periodic cleanup
  private startPeriodicCleanup() {
    // Run cleanup immediately on startup
    this.runPeriodicCleanup();
    
    // Set up periodic cleanup every 6 hours
    this.cleanupTimer = setInterval(() => {
      this.runPeriodicCleanup();
    }, this.CLEANUP_INTERVAL);
  }

  // Stop cleanup service
  public stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  // Run periodic cleanup (silent background operation)
  private async runPeriodicCleanup(): Promise<void> {
    try {
      // Clean up empty sessions
      await this.cleanupEmptySessions();
      
      // Clean up old empty sessions (24+ hours)
      await this.cleanupOldEmptySessions();
    } catch (error) {
      // Silent error handling - cleanup failures shouldn't affect user experience
    }
  }
  
  // Clean up empty chat sessions
  async cleanupEmptySessions(): Promise<CleanupStats> {
    const stats: CleanupStats = {
      totalSessions: 0,
      emptySessions: 0,
      deletedSessions: 0,
      totalMessages: 0,
      orphanedMessages: 0,
      deletedMessages: 0
    };

    try {
      // Get all chat sessions
      const sessionsRef = collection(db, 'chatSessions');
      const sessionsSnapshot = await getDocs(sessionsRef);
      
      stats.totalSessions = sessionsSnapshot.docs.length;

      // Check each session for empty messages
      for (const sessionDoc of sessionsSnapshot.docs) {
        const sessionData = sessionDoc.data();
        const messages = sessionData.messages || [];
        
        // Check if session is empty (no messages or only empty messages)
        const hasValidMessages = messages.some((msg: { content?: string }) =>
          msg.content && msg.content.trim().length > 0
        );

        if (!hasValidMessages) {
          stats.emptySessions++;
          
          // Delete the session
          await deleteDoc(doc(db, 'chatSessions', sessionDoc.id));
          stats.deletedSessions++;
          
          // Also delete associated messages
          await this.deleteSessionMessages(sessionDoc.id);
        }
      }

      // Clean up orphaned messages
      const messagesStats = await this.cleanupOrphanedMessages();
      stats.totalMessages = messagesStats.totalMessages;
      stats.orphanedMessages = messagesStats.orphanedMessages;
      stats.deletedMessages = messagesStats.deletedMessages;

      return stats;

    } catch (error) {
      // Silent error handling
      return stats;
    }
  }

  // Clean up orphaned messages (messages without valid sessions)
  private async cleanupOrphanedMessages(): Promise<{
    totalMessages: number;
    orphanedMessages: number;
    deletedMessages: number;
  }> {
    const stats = {
      totalMessages: 0,
      orphanedMessages: 0,
      deletedMessages: 0
    };

    try {
      // Get all messages
      const messagesRef = collection(db, 'messages');
      const messagesSnapshot = await getDocs(messagesRef);
      
      stats.totalMessages = messagesSnapshot.docs.length;

      // Get all valid session IDs
      const sessionsRef = collection(db, 'chatSessions');
      const sessionsSnapshot = await getDocs(sessionsRef);
      const validSessionIds = new Set(sessionsSnapshot.docs.map(doc => doc.id));

      // Check each message for orphaned status
      for (const messageDoc of messagesSnapshot.docs) {
        const messageData = messageDoc.data();
        const sessionId = messageData.sessionId;

        // Check if message is orphaned (no valid session or empty content)
        const isOrphaned = !validSessionIds.has(sessionId) || 
                          !messageData.content || 
                          messageData.content.trim().length === 0;

        if (isOrphaned) {
          stats.orphanedMessages++;
          
          await deleteDoc(doc(db, 'messages', messageDoc.id));
          stats.deletedMessages++;
        }
      }

      return stats;

    } catch (error) {
      // Silent error handling
      return stats;
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

  // Get database statistics
  async getDatabaseStats(): Promise<{
    totalSessions: number;
    emptySessions: number;
    totalMessages: number;
    orphanedMessages: number;
  }> {
    try {
      // Get all sessions
      const sessionsRef = collection(db, 'chatSessions');
      const sessionsSnapshot = await getDocs(sessionsRef);
      
      let emptySessions = 0;
      for (const sessionDoc of sessionsSnapshot.docs) {
        const sessionData = sessionDoc.data();
        const messages = sessionData.messages || [];
        
        const hasValidMessages = messages.some((msg: { content?: string }) =>
          msg.content && msg.content.trim().length > 0
        );

        if (!hasValidMessages) {
          emptySessions++;
        }
      }

      // Get all messages
      const messagesRef = collection(db, 'messages');
      const messagesSnapshot = await getDocs(messagesRef);
      
      // Get valid session IDs
      const validSessionIds = new Set(sessionsSnapshot.docs.map(doc => doc.id));
      
      let orphanedMessages = 0;
      for (const messageDoc of messagesSnapshot.docs) {
        const messageData = messageDoc.data();
        const sessionId = messageData.sessionId;

        const isOrphaned = !validSessionIds.has(sessionId) || 
                          !messageData.content || 
                          messageData.content.trim().length === 0;

        if (isOrphaned) {
          orphanedMessages++;
        }
      }

      return {
        totalSessions: sessionsSnapshot.docs.length,
        emptySessions,
        totalMessages: messagesSnapshot.docs.length,
        orphanedMessages
      };

    } catch (error) {
      console.error('❌ Error getting database stats:', error);
      return {
        totalSessions: 0,
        emptySessions: 0,
        totalMessages: 0,
        orphanedMessages: 0
      };
    }
  }

  // Clean up old empty sessions (older than 24 hours)
  async cleanupOldEmptySessions(): Promise<number> {
    try {
      const cutoffTime = new Date(Date.now() - (24 * 60 * 60 * 1000)); // 24 hours ago
      
      const sessionsRef = collection(db, 'chatSessions');
      const q = query(
        sessionsRef,
        where('createdAt', '<', cutoffTime),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      let deletedCount = 0;
      
      for (const sessionDoc of snapshot.docs) {
        const sessionData = sessionDoc.data();
        const messages = sessionData.messages || [];
        
        // Check if session is empty
        const hasValidMessages = messages.some((msg: { content?: string }) =>
          msg.content && msg.content.trim().length > 0
        );

        if (!hasValidMessages) {
          await deleteDoc(doc(db, 'chatSessions', sessionDoc.id));
          await this.deleteSessionMessages(sessionDoc.id);
          deletedCount++;
        }
      }
      
      return deletedCount;

    } catch (error) {
      // Silent error handling
      return 0;
    }
  }
}

// Export singleton instance
export const databaseCleanupService = new DatabaseCleanupService();
