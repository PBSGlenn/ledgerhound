import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { SettingsService } from '../settingsService';
import type { PrismaClient } from '@prisma/client';
import { createTestDb, resetTestDb, cleanupTestDb } from '../__test-utils__/testDb';
import { seedTestAccounts } from '../__test-utils__/fixtures';

describe('SettingsService', () => {
  let prisma: PrismaClient;
  let settingsService: SettingsService;
  let accounts: Awaited<ReturnType<typeof seedTestAccounts>>;

  beforeEach(async () => {
    prisma = await createTestDb();
    await resetTestDb(prisma);
    settingsService = new SettingsService(prisma);
    accounts = await seedTestAccounts(prisma);
  });

  afterAll(async () => {
    await cleanupTestDb(prisma);
  });

  describe('get and set', () => {
    it('should set and get a string value', async () => {
      await settingsService.set('test_key', 'test_value');

      const value = await settingsService.get('test_key');

      expect(value).toBe('test_value');
    });

    it('should return null for non-existent key', async () => {
      const value = await settingsService.get('non_existent_key');

      expect(value).toBeNull();
    });

    it('should update existing value', async () => {
      await settingsService.set('test_key', 'original_value');
      await settingsService.set('test_key', 'updated_value');

      const value = await settingsService.get('test_key');

      expect(value).toBe('updated_value');
    });
  });

  describe('getJSON and setJSON', () => {
    it('should set and get JSON object', async () => {
      const obj = {
        name: 'Test User',
        age: 30,
        active: true,
      };

      await settingsService.setJSON('user_config', obj);

      const retrieved = await settingsService.getJSON('user_config');

      expect(retrieved).toEqual(obj);
    });

    it('should return null for non-existent key', async () => {
      const value = await settingsService.getJSON('non_existent_key');

      expect(value).toBeNull();
    });

    it('should return null for invalid JSON', async () => {
      // Manually set invalid JSON
      await settingsService.set('bad_json', 'invalid json{');

      const value = await settingsService.getJSON('bad_json');

      expect(value).toBeNull();
    });

    it('should handle complex nested objects', async () => {
      const complexObj = {
        user: {
          name: 'John',
          preferences: {
            theme: 'dark',
            language: 'en',
            notifications: {
              email: true,
              push: false,
            },
          },
        },
        settings: ['setting1', 'setting2'],
      };

      await settingsService.setJSON('complex_config', complexObj);

      const retrieved = await settingsService.getJSON('complex_config');

      expect(retrieved).toEqual(complexObj);
    });

    it('should handle arrays', async () => {
      const arr = ['item1', 'item2', 'item3'];

      await settingsService.setJSON('array_config', arr);

      const retrieved = await settingsService.getJSON<string[]>('array_config');

      expect(retrieved).toEqual(arr);
    });

    it('should handle numbers', async () => {
      const num = 42;

      await settingsService.setJSON('number_config', num);

      const retrieved = await settingsService.getJSON<number>('number_config');

      expect(retrieved).toBe(num);
    });

    it('should handle booleans', async () => {
      const bool = true;

      await settingsService.setJSON('boolean_config', bool);

      const retrieved = await settingsService.getJSON<boolean>('boolean_config');

      expect(retrieved).toBe(bool);
    });
  });

  describe('delete', () => {
    it('should delete existing setting', async () => {
      await settingsService.set('test_key', 'test_value');

      await settingsService.delete('test_key');

      const value = await settingsService.get('test_key');
      expect(value).toBeNull();
    });

    it('should not throw error when deleting non-existent key', async () => {
      await expect(
        settingsService.delete('non_existent_key')
      ).resolves.not.toThrow();
    });
  });

  describe('Stripe settings', () => {
    describe('saveStripeSettings', () => {
      it('should save Stripe settings', async () => {
        const settings = await settingsService.saveStripeSettings(
          'sk_test_123456789',
          accounts.businessChecking.id
        );

        expect(settings.apiKey).toBe('sk_test_123456789');
        expect(settings.accountId).toBe(accounts.businessChecking.id);
        expect(settings.payoutDestinationAccountId).toBeUndefined();
      });

      it('should save Stripe settings with payout destination', async () => {
        const settings = await settingsService.saveStripeSettings(
          'sk_test_123456789',
          accounts.businessChecking.id,
          accounts.personalChecking.id
        );

        expect(settings.apiKey).toBe('sk_test_123456789');
        expect(settings.accountId).toBe(accounts.businessChecking.id);
        expect(settings.payoutDestinationAccountId).toBe(accounts.personalChecking.id);
      });

      it('should update existing Stripe settings', async () => {
        await settingsService.saveStripeSettings(
          'sk_test_original',
          accounts.businessChecking.id
        );

        await settingsService.saveStripeSettings(
          'sk_test_updated',
          accounts.businessChecking.id,
          accounts.personalChecking.id
        );

        const settings = await settingsService.getStripeSettings();

        expect(settings?.apiKey).toBe('sk_test_updated');
        expect(settings?.payoutDestinationAccountId).toBe(accounts.personalChecking.id);
      });
    });

    describe('getStripeSettings', () => {
      it('should get Stripe settings', async () => {
        await settingsService.saveStripeSettings(
          'sk_test_123456789',
          accounts.businessChecking.id
        );

        const settings = await settingsService.getStripeSettings();

        expect(settings).toBeDefined();
        expect(settings?.apiKey).toBe('sk_test_123456789');
        expect(settings?.accountId).toBe(accounts.businessChecking.id);
      });

      it('should return null if no Stripe settings exist', async () => {
        const settings = await settingsService.getStripeSettings();

        expect(settings).toBeNull();
      });
    });

    describe('deleteStripeSettings', () => {
      it('should delete Stripe settings', async () => {
        await settingsService.saveStripeSettings(
          'sk_test_123456789',
          accounts.businessChecking.id
        );

        await settingsService.deleteStripeSettings();

        const settings = await settingsService.getStripeSettings();
        expect(settings).toBeNull();
      });

      it('should not throw error when deleting non-existent settings', async () => {
        await expect(
          settingsService.deleteStripeSettings()
        ).resolves.not.toThrow();
      });
    });

    describe('getStripeSettingsPublic', () => {
      it('should return not configured when no settings exist', async () => {
        const publicSettings = await settingsService.getStripeSettingsPublic();

        expect(publicSettings.configured).toBe(false);
        expect(publicSettings.accountId).toBeUndefined();
        expect(publicSettings.apiKeyMasked).toBeUndefined();
      });

      it('should return masked API key and account names', async () => {
        await settingsService.saveStripeSettings(
          'sk_test_1234567890abcdefghijklmnop',
          accounts.businessChecking.id,
          accounts.personalChecking.id
        );

        const publicSettings = await settingsService.getStripeSettingsPublic();

        expect(publicSettings.configured).toBe(true);
        expect(publicSettings.accountId).toBe(accounts.businessChecking.id);
        expect(publicSettings.accountName).toBe('Business Checking');
        expect(publicSettings.payoutDestinationAccountId).toBe(accounts.personalChecking.id);
        expect(publicSettings.payoutDestinationAccountName).toBe('Personal Checking');

        // API key should be masked (first 7 + last 4)
        expect(publicSettings.apiKeyMasked).toBe('sk_test...mnop');
      });

      it('should handle settings without payout destination', async () => {
        await settingsService.saveStripeSettings(
          'sk_test_1234567890abcdefghijklmnop',
          accounts.businessChecking.id
        );

        const publicSettings = await settingsService.getStripeSettingsPublic();

        expect(publicSettings.configured).toBe(true);
        expect(publicSettings.payoutDestinationAccountId).toBeUndefined();
        expect(publicSettings.payoutDestinationAccountName).toBeUndefined();
      });

      it('should handle short API keys', async () => {
        await settingsService.saveStripeSettings(
          'sk_test_12',
          accounts.businessChecking.id
        );

        const publicSettings = await settingsService.getStripeSettingsPublic();

        // Should still apply masking logic even if key is short
        expect(publicSettings.apiKeyMasked).toBeDefined();
      });
    });
  });

  describe('Multiple settings', () => {
    it('should handle multiple independent settings', async () => {
      await settingsService.set('setting1', 'value1');
      await settingsService.set('setting2', 'value2');
      await settingsService.setJSON('setting3', { key: 'value3' });

      const value1 = await settingsService.get('setting1');
      const value2 = await settingsService.get('setting2');
      const value3 = await settingsService.getJSON('setting3');

      expect(value1).toBe('value1');
      expect(value2).toBe('value2');
      expect(value3).toEqual({ key: 'value3' });
    });

    it('should delete only specified setting', async () => {
      await settingsService.set('setting1', 'value1');
      await settingsService.set('setting2', 'value2');

      await settingsService.delete('setting1');

      const value1 = await settingsService.get('setting1');
      const value2 = await settingsService.get('setting2');

      expect(value1).toBeNull();
      expect(value2).toBe('value2');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string value', async () => {
      await settingsService.set('empty_key', '');

      const value = await settingsService.get('empty_key');

      // The service returns null for empty strings due to the || operator in get()
      expect(value).toBeNull();
    });

    it('should handle null in JSON', async () => {
      await settingsService.setJSON('null_value', null);

      const value = await settingsService.getJSON('null_value');

      expect(value).toBeNull();
    });

    it('should handle empty object', async () => {
      await settingsService.setJSON('empty_object', {});

      const value = await settingsService.getJSON('empty_object');

      expect(value).toEqual({});
    });

    it('should handle empty array', async () => {
      await settingsService.setJSON('empty_array', []);

      const value = await settingsService.getJSON('empty_array');

      expect(value).toEqual([]);
    });

    it('should handle special characters in key', async () => {
      await settingsService.set('key.with.dots', 'value');
      await settingsService.set('key_with_underscores', 'value');
      await settingsService.set('key-with-dashes', 'value');

      const value1 = await settingsService.get('key.with.dots');
      const value2 = await settingsService.get('key_with_underscores');
      const value3 = await settingsService.get('key-with-dashes');

      expect(value1).toBe('value');
      expect(value2).toBe('value');
      expect(value3).toBe('value');
    });
  });
});
