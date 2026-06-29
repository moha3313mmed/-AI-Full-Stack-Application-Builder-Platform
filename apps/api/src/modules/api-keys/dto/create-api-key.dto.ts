export class CreateApiKeyDto {
  name!: string;
  scopes?: string[];
  expiresAt?: string; // ISO date string
}
