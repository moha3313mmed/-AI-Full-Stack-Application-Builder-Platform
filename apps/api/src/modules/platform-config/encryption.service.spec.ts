import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-encryption-key-for-unit-tests'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('encrypt', () => {
    it('should return a string in the format iv:authTag:ciphertext', () => {
      const result = service.encrypt('hello world');

      const parts = result.split(':');
      expect(parts).toHaveLength(3);
      // Each part should be valid base64
      parts.forEach((part) => {
        expect(() => Buffer.from(part, 'base64')).not.toThrow();
      });
    });

    it('should produce different ciphertexts for the same plaintext (random IV)', () => {
      const result1 = service.encrypt('same-plaintext');
      const result2 = service.encrypt('same-plaintext');

      expect(result1).not.toEqual(result2);
    });

    it('should handle empty string', () => {
      const result = service.encrypt('');
      expect(result).toBeDefined();
      expect(result.split(':')).toHaveLength(3);
    });

    it('should handle long plaintext', () => {
      const longText = 'a'.repeat(10000);
      const result = service.encrypt(longText);
      expect(result).toBeDefined();
      expect(result.split(':')).toHaveLength(3);
    });
  });

  describe('decrypt', () => {
    it('should decrypt an encrypted value back to the original plaintext', () => {
      const plaintext = 'sk-test-api-key-12345678';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle special characters', () => {
      const plaintext = 'p@$$w0rd!#%^&*(){}[]|\\:";\'<>?,./~`';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = 'unicode: \u00e9\u00e8\u00ea\u00eb \u00fc\u00f1 \u2603 \ud83d\ude00';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw on invalid encrypted value format (missing parts)', () => {
      expect(() => service.decrypt('invalid-format')).toThrow(
        'Invalid encrypted value format',
      );
    });

    it('should throw on invalid encrypted value format (too many parts)', () => {
      expect(() => service.decrypt('a:b:c:d')).toThrow();
    });

    it('should throw on tampered ciphertext', () => {
      const encrypted = service.encrypt('test-value');
      const parts = encrypted.split(':');
      // Tamper with the ciphertext portion
      parts[2] = Buffer.from('tampered-data').toString('base64');
      const tampered = parts.join(':');

      expect(() => service.decrypt(tampered)).toThrow();
    });

    it('should throw on tampered auth tag', () => {
      const encrypted = service.encrypt('test-value');
      const parts = encrypted.split(':');
      // Tamper with the auth tag
      parts[1] = Buffer.from('0000000000000000').toString('base64');
      const tampered = parts.join(':');

      expect(() => service.decrypt(tampered)).toThrow();
    });
  });

  describe('encrypt/decrypt round-trip', () => {
    it('should successfully round-trip various values', () => {
      const testValues = [
        'simple-key',
        'sk-proj-abc123def456ghi789',
        'postgresql://user:pass@host:5432/db',
        JSON.stringify({ clientId: 'id', clientSecret: 'secret' }),
        '',
        'a',
      ];

      testValues.forEach((value) => {
        const encrypted = service.encrypt(value);
        const decrypted = service.decrypt(encrypted);
        expect(decrypted).toBe(value);
      });
    });
  });

  describe('rotateEncryption', () => {
    it('should re-encrypt a value with a new key', () => {
      const oldKey = 'old-encryption-key';
      const newKey = 'new-encryption-key';
      const plaintext = 'secret-api-key-value';

      // Create a mock that uses the old key to encrypt
      mockConfigService.get.mockReturnValue(oldKey);
      const encryptedWithOldKey = service.encrypt(plaintext);

      // Rotate
      const rotated = service.rotateEncryption(oldKey, newKey, encryptedWithOldKey);

      // The rotated value should be different from the original
      expect(rotated).not.toEqual(encryptedWithOldKey);

      // Should be decryptable with the new key
      mockConfigService.get.mockReturnValue(newKey);
      const decrypted = service.decrypt(rotated);
      expect(decrypted).toBe(plaintext);
    });

    it('should throw when old key is wrong', () => {
      const correctKey = 'correct-key';
      const wrongKey = 'wrong-key';
      const newKey = 'new-key';

      mockConfigService.get.mockReturnValue(correctKey);
      const encrypted = service.encrypt('test-value');

      expect(() =>
        service.rotateEncryption(wrongKey, newKey, encrypted),
      ).toThrow();
    });
  });

  describe('getEncryptionKey', () => {
    it('should throw when PLATFORM_ENCRYPTION_KEY is not configured', () => {
      mockConfigService.get.mockReturnValue(undefined);

      expect(() => service.encrypt('test')).toThrow(
        'PLATFORM_ENCRYPTION_KEY is not configured',
      );
    });
  });
});
