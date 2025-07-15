import type { User } from '@/composables/useAuth'

export interface OpenBadgesApiClient {
  token: string;
  headers: Record<string, string>;
}

export interface BadgeAssertion {
  id: string;
  badgeClass: string;
  recipient: string;
  issuedOn: string;
  evidence?: string;
  narrative?: string;
}

export interface UserBackpack {
  assertions: BadgeAssertion[];
  total: number;
}

export class OpenBadgesService {
  private baseUrl = '/api/badges';

  /**
   * Get platform token for authenticated user
   */
  async getPlatformToken(user: User): Promise<string> {
    const response = await fetch('/api/auth/platform-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user }),
    });

    if (!response.ok) {
      throw new Error('Failed to get platform token');
    }

    const data = await response.json();
    return data.token;
  }

  /**
   * Create API client for authenticated user
   */
  async createApiClient(user: User): Promise<OpenBadgesApiClient> {
    const token = await this.getPlatformToken(user);
    
    return {
      token,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
  }

  /**
   * Get user's badge backpack
   */
  async getUserBackpack(user: User): Promise<UserBackpack> {
    const client = await this.createApiClient(user);
    
    const response = await fetch(`${this.baseUrl}/api/v1/assertions`, {
      headers: client.headers,
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user backpack');
    }

    return await response.json();
  }

  /**
   * Add badge assertion to user's backpack
   */
  async addBadgeToBackpack(user: User, badgeClassId: string, evidence?: string, narrative?: string): Promise<BadgeAssertion> {
    const client = await this.createApiClient(user);
    
    const response = await fetch(`${this.baseUrl}/api/v1/assertions`, {
      method: 'POST',
      headers: client.headers,
      body: JSON.stringify({
        badgeClass: badgeClassId,
        recipient: user.email,
        evidence,
        narrative,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to add badge to backpack');
    }

    return await response.json();
  }

  /**
   * Remove badge assertion from user's backpack
   */
  async removeBadgeFromBackpack(user: User, assertionId: string): Promise<void> {
    const client = await this.createApiClient(user);
    
    const response = await fetch(`${this.baseUrl}/api/v1/assertions/${assertionId}`, {
      method: 'DELETE',
      headers: client.headers,
    });

    if (!response.ok) {
      throw new Error('Failed to remove badge from backpack');
    }
  }

  /**
   * Get badge classes available for issuance
   */
  async getBadgeClasses(): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/v2/badge-classes`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch badge classes');
    }

    return await response.json();
  }

  /**
   * Create new badge class
   */
  async createBadgeClass(user: User, badgeClass: any): Promise<any> {
    const client = await this.createApiClient(user);
    
    const response = await fetch(`${this.baseUrl}/v2/badge-classes`, {
      method: 'POST',
      headers: client.headers,
      body: JSON.stringify(badgeClass),
    });

    if (!response.ok) {
      throw new Error('Failed to create badge class');
    }

    return await response.json();
  }

  /**
   * Issue badge to user
   */
  async issueBadge(issuerUser: User, badgeClassId: string, recipientEmail: string, evidence?: string, narrative?: string): Promise<BadgeAssertion> {
    const client = await this.createApiClient(issuerUser);
    
    const response = await fetch(`${this.baseUrl}/v2/assertions`, {
      method: 'POST',
      headers: client.headers,
      body: JSON.stringify({
        badgeClass: badgeClassId,
        recipient: recipientEmail,
        evidence,
        narrative,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to issue badge');
    }

    return await response.json();
  }
}

export const openBadgesService = new OpenBadgesService();