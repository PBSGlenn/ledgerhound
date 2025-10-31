/**
 * Settings Service
 * Handles app configuration storage and retrieval
 */

import { getPrismaClient } from '../db';

export interface StripeSettings {
  apiKey: string;
  accountId: string; // Ledgerhound account ID for Stripe PSP account
  payoutDestinationAccountId?: string; // Bank account that receives Stripe payouts
}

export interface StripeSettingsPublic {
  configured: boolean;
  accountId?: string;
  accountName?: string;
  payoutDestinationAccountId?: string;
  payoutDestinationAccountName?: string;
  apiKeyMasked?: string;
}

export class SettingsService {
  private prisma = getPrismaClient();

  /**
   * Get a setting value
   */
  async get(key: string): Promise<string | null> {
    const setting = await this.prisma.settings.findUnique({
      where: { key },
    });

    return setting?.value || null;
  }

  /**
   * Get a setting as JSON
   */
  async getJSON<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  /**
   * Set a setting value
   */
  async set(key: string, value: string): Promise<void> {
    await this.prisma.settings.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  /**
   * Set a setting as JSON
   */
  async setJSON(key: string, value: any): Promise<void> {
    await this.set(key, JSON.stringify(value));
  }

  /**
   * Delete a setting
   */
  async delete(key: string): Promise<void> {
    await this.prisma.settings.delete({
      where: { key },
    }).catch(() => {
      // Ignore if not found
    });
  }

  /**
   * Get Stripe settings
   */
  async getStripeSettings(): Promise<StripeSettings | null> {
    return await this.getJSON<StripeSettings>('stripe');
  }

  /**
   * Save Stripe settings
   */
  async saveStripeSettings(
    apiKey: string,
    accountId: string,
    payoutDestinationAccountId?: string
  ): Promise<StripeSettings> {
    const settings: StripeSettings = {
      apiKey,
      accountId,
      payoutDestinationAccountId,
    };

    await this.setJSON('stripe', settings);
    return settings;
  }

  /**
   * Delete Stripe settings
   */
  async deleteStripeSettings(): Promise<void> {
    await this.delete('stripe');
  }

  /**
   * Get Stripe settings for public display (API key masked)
   */
  async getStripeSettingsPublic(): Promise<StripeSettingsPublic> {
    const settings = await this.getStripeSettings();
    if (!settings) {
      return { configured: false };
    }

    // Get Stripe PSP account name
    const account = await this.prisma.account.findUnique({
      where: { id: settings.accountId },
      select: { name: true },
    });

    // Get payout destination account name
    let payoutDestinationAccountName: string | undefined;
    if (settings.payoutDestinationAccountId) {
      const payoutAccount = await this.prisma.account.findUnique({
        where: { id: settings.payoutDestinationAccountId },
        select: { name: true },
      });
      payoutDestinationAccountName = payoutAccount?.name;
    }

    // Mask API key - show first 7 + last 4 characters
    const apiKeyMasked = settings.apiKey
      ? `${settings.apiKey.substring(0, 7)}...${settings.apiKey.slice(-4)}`
      : undefined;

    return {
      configured: true,
      accountId: settings.accountId,
      accountName: account?.name,
      payoutDestinationAccountId: settings.payoutDestinationAccountId,
      payoutDestinationAccountName,
      apiKeyMasked,
    };
  }
}

// Singleton instance
export const settingsService = new SettingsService();
