import { firebaseService } from './firebaseService';

class AutomaticCleanupService {
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  // Start automatic cleanup (runs every hour for 24-hour deletion)
  startAutomaticCleanup(): void {
    if (this.isRunning) {
      return;
    }

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
  }

  // Run cleanup manually
  async runCleanup(): Promise<void> {
    try {
      // Only run cleanup if we have authentication or if it's a server-side operation
      // For now, we'll skip cleanup when not authenticated to avoid permission errors
      const hasAuth = await this.checkAuthentication();
      if (!hasAuth) {
        // Skip cleanup when not authenticated to avoid permission errors
        return;
      }
      
      await firebaseService.runAutomaticCleanup();
      
      // Cleanup completed silently
    } catch (error) {
      console.error('❌ Automatic cleanup failed:', error);
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
