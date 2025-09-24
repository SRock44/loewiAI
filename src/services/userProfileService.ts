import { firebaseService } from './firebaseService';
import { firebaseAuthService } from './firebaseAuthService';

export interface UserProfile {
  educationLevel: string;
  major: string;
}

export class UserProfileService {
  private static currentProfile: UserProfile | null = null;
  private static currentUserId: string | null = null;

  static async getUserProfile(): Promise<UserProfile> {
    const user = firebaseAuthService.getCurrentUser();
    if (!user) {
      return { educationLevel: '', major: '' };
    }

    // Return cached profile if available and user hasn't changed
    if (this.currentProfile && this.currentUserId === user.id) {
      return this.currentProfile;
    }

    try {
      const settings = await firebaseService.getUserSettings(user.id);
      this.currentProfile = settings;
      this.currentUserId = user.id;
      return settings;
    } catch (error) {
      // Error loading user profile
      return { educationLevel: '', major: '' };
    }
  }

  static async saveUserProfile(profile: UserProfile): Promise<void> {
    const user = firebaseAuthService.getCurrentUser();
    if (!user) {
      throw new Error('User must be authenticated to save profile');
    }

    try {
      await firebaseService.saveUserSettings(user.id, profile);
      this.currentProfile = profile;
      this.currentUserId = user.id;
    } catch (error) {
      throw new Error('Failed to save user profile');
    }
  }

  static getEducationLevelDisplayName(level: string): string {
    const levelMap: Record<string, string> = {
      'high-school': 'High School',
      'associates': 'Associate\'s Degree',
      'bachelors': 'Bachelor\'s Degree',
      'masters': 'Master\'s Degree',
      'phd': 'PhD/Doctorate',
      'other': 'Other'
    };
    
    return levelMap[level] || level;
  }

  static async buildPersonalizationContext(): Promise<string> {
    const profile = await this.getUserProfile();
    
    if (!profile.educationLevel && !profile.major) {
      return '';
    }

    let context = 'USER PROFILE INFORMATION:\n';
    
    if (profile.educationLevel) {
      context += `- Education Level: ${this.getEducationLevelDisplayName(profile.educationLevel)}\n`;
    }
    
    if (profile.major) {
      context += `- Field of Study: ${profile.major}\n`;
    }
    
    context += '\nPERSONALIZATION INSTRUCTIONS:\n';
    context += '- Tailor your explanations to the user\'s education level\n';
    context += '- Use appropriate terminology and complexity\n';
    context += '- Reference relevant concepts from their field of study when applicable\n';
    context += '- Provide examples that relate to their academic background\n';
    
    // Add specific guidance based on education level
    if (profile.educationLevel === 'high-school') {
      context += '- Use simpler language and provide more foundational explanations\n';
      context += '- Focus on building understanding from basic concepts\n';
    } else if (profile.educationLevel === 'bachelors' || profile.educationLevel === 'associates') {
      context += '- Balance foundational concepts with intermediate-level applications\n';
      context += '- Include practical examples and real-world applications\n';
    } else if (profile.educationLevel === 'masters' || profile.educationLevel === 'phd') {
      context += '- Use advanced terminology and complex concepts appropriately\n';
      context += '- Focus on critical analysis and research-oriented approaches\n';
      context += '- Provide deeper insights and theoretical frameworks\n';
    }
    
    // Add field-specific guidance
    if (profile.major) {
      const major = profile.major.toLowerCase();
      if (major.includes('computer') || major.includes('software') || major.includes('engineering')) {
        context += '- Include technical details and programming concepts when relevant\n';
        context += '- Reference software development practices and engineering principles\n';
      } else if (major.includes('business') || major.includes('management') || major.includes('economics')) {
        context += '- Focus on practical business applications and case studies\n';
        context += '- Include market analysis and strategic thinking elements\n';
      } else if (major.includes('science') || major.includes('biology') || major.includes('chemistry') || major.includes('physics')) {
        context += '- Emphasize scientific methodology and empirical evidence\n';
        context += '- Include experimental design and data analysis concepts\n';
      } else if (major.includes('psychology') || major.includes('sociology') || major.includes('social')) {
        context += '- Consider human behavior and social factors in explanations\n';
        context += '- Include research methods and statistical analysis when relevant\n';
      } else if (major.includes('literature') || major.includes('english') || major.includes('writing')) {
        context += '- Focus on critical analysis and literary interpretation\n';
        context += '- Emphasize writing techniques and communication skills\n';
      } else if (major.includes('math') || major.includes('statistics') || major.includes('mathematics')) {
        context += '- Provide detailed mathematical explanations and proofs\n';
        context += '- Include problem-solving strategies and computational methods\n';
      }
    }
    
    return context;
  }
}

export const userProfileService = new UserProfileService();
