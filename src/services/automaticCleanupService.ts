import { firebaseService } from './firebaseService';

class AutomaticCleanupService {
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  // Start automatic cleanup (runs every hour for 24-hour deletion)
  startAutomaticCleanup(): void {
    if (this.isRunning) {
      console.log('🧹 Automatic cleanup is already running');
      return;
    }

    console.log('🚀 Starting automatic cleanup service (24-hour deletion for chats/flashcards)...');
    this.isRunning = true;

    // Run cleanup immediately
    this.runCleanup();

    // Then run every hour to ensure timely 24-hour deletion
    this.cleanupInterval = setInterval(() => {
      this.runCleanup();
    }, 60 * 60 * 1000); // 1 hour = 60 * 60 * 1000 ms
  }

  // Stop automatic cleanup
  stopAutomaticCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.isRunning = false;
    console.log('🛑 Automatic cleanup service stopped');
  }

  // Run cleanup manually
  async runCleanup(): Promise<void> {
    try {
      console.log('🧹 Running automatic cleanup (24-hour deletion)...');
      const results = await firebaseService.runAutomaticCleanup();
      
      const total = results.expiredSessions + results.expiredFlashcards + results.duplicatesRemoved;
      if (total > 0) {
        console.log(`✅ Cleanup completed: ${results.expiredSessions} expired sessions (24+ hours), ${results.expiredFlashcards} expired flashcards (24+ hours), ${results.duplicatesRemoved} duplicates removed`);
        console.log('📝 Note: User settings are preserved for optimal user experience');
      } else {
        console.log('✅ Cleanup completed: No expired data found (24+ hours old)');
      }
    } catch (error) {
      console.error('❌ Automatic cleanup failed:', error);
    }
  }

  // Get cleanup status
  getStatus(): { isRunning: boolean; nextCleanup?: Date } {
    return {
      isRunning: this.isRunning,
      nextCleanup: this.cleanupInterval ? new Date(Date.now() + 60 * 60 * 1000) : undefined
    };
  }
}

// Export singleton instance
export const automaticCleanupService = new AutomaticCleanupService();
