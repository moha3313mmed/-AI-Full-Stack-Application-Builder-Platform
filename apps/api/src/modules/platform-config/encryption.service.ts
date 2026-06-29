import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 16;
  private readonly authTagLength = 16;

  constructor(private readonly configService: ConfigService) {}

  private getEncryptionKey(): Buffer {
    const key = this.configService.get<string>('PLATFORM_ENCRYPTION_KEY');
    if (!key) {
      throw new Error('PLATFORM_ENCRYPTION_KEY is not configured');
    }
    // Ensure key is 32 bytes for AES-256
    return crypto.createHash('sha256').update(key).digest();
  }

  encrypt(plaintext: string): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    // Format: base64(iv):base64(authTag):base64(ciphertext)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  }

  decrypt(encryptedValue: string): string {
    const key = this.getEncryptionKey();
    return this.decryptWithKey(key, encryptedValue);
  }

  rotateEncryption(oldKey: string, newKey: string, encryptedValue: string): string {
    // Decrypt with old key
    const oldKeyBuffer = crypto.createHash('sha256').update(oldKey).digest();
    const plaintext = this.decryptWithKey(oldKeyBuffer, encryptedValue);

    // Re-encrypt with new key
    const newKeyBuffer = crypto.createHash('sha256').update(newKey).digest();
    return this.encryptWithKey(newKeyBuffer, plaintext);
  }

  private encryptWithKey(key: Buffer, plaintext: string): string {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  }

  private decryptWithKey(key: Buffer, encryptedValue: string): string {
    const parts = encryptedValue.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted value format');
    }

    const [ivBase64, authTagBase64, ciphertext] = parts;
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');

    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
