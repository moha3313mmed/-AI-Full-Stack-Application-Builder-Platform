import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: S3Client | null = null;
  private bucket: string;
  private isAvailable = false;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('MINIO_BUCKET', 'builder-files');
  }

  async onModuleInit() {
    const endpoint = this.configService.get<string>('MINIO_ENDPOINT');
    const port = this.configService.get<string>('MINIO_PORT');
    const accessKey = this.configService.get<string>('MINIO_ACCESS_KEY');
    const secretKey = this.configService.get<string>('MINIO_SECRET_KEY');

    if (!endpoint || !accessKey || !secretKey) {
      this.logger.warn(
        'MinIO configuration not found. Operating in memory-only mode. ' +
          'Set MINIO_ENDPOINT, MINIO_ACCESS_KEY, and MINIO_SECRET_KEY to enable persistent storage.',
      );
      return;
    }

    const endpointUrl = `http://${endpoint}:${port || '9000'}`;

    this.client = new S3Client({
      endpoint: endpointUrl,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
    });

    await this.ensureBucketExists();
  }

  /**
   * Whether the storage backend is connected and available.
   */
  get available(): boolean {
    return this.isAvailable;
  }

  /**
   * Upload file content to S3/MinIO.
   * Returns the S3 key for the stored object.
   */
  async uploadFile(projectId: string, path: string, content: string): Promise<string> {
    if (!this.client) {
      throw new Error('Storage service is not available');
    }

    const s3Key = this.buildS3Key(projectId, path);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
        Body: content,
        ContentType: 'text/plain; charset=utf-8',
      }),
    );

    return s3Key;
  }

  /**
   * Download file content from S3/MinIO.
   */
  async downloadFile(s3Key: string): Promise<string> {
    if (!this.client) {
      throw new Error('Storage service is not available');
    }

    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
      }),
    );

    const body = await response.Body?.transformToString('utf-8');
    return body || '';
  }

  /**
   * Delete a file from S3/MinIO.
   */
  async deleteFile(s3Key: string): Promise<void> {
    if (!this.client) {
      throw new Error('Storage service is not available');
    }

    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
      }),
    );
  }

  /**
   * List all file keys for a project in S3/MinIO.
   */
  async listProjectFiles(projectId: string): Promise<string[]> {
    if (!this.client) {
      throw new Error('Storage service is not available');
    }

    const prefix = `projects/${projectId}/`;
    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );

      if (response.Contents) {
        for (const obj of response.Contents) {
          if (obj.Key) {
            keys.push(obj.Key);
          }
        }
      }

      continuationToken = response.IsTruncated
        ? response.NextContinuationToken
        : undefined;
    } while (continuationToken);

    return keys;
  }

  private buildS3Key(projectId: string, filePath: string): string {
    // Normalize path: remove leading slash for S3 key
    const normalizedPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    return `projects/${projectId}/${normalizedPath}`;
  }

  private async ensureBucketExists(): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.isAvailable = true;
      this.logger.log(`Connected to MinIO storage. Bucket: ${this.bucket}`);
    } catch (error: unknown) {
      const statusCode = (error as { $metadata?: { httpStatusCode?: number } })
        ?.$metadata?.httpStatusCode;

      if (statusCode === 404) {
        try {
          await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
          this.isAvailable = true;
          this.logger.log(`Created MinIO bucket: ${this.bucket}`);
        } catch (createError) {
          this.logger.warn(
            `Failed to create bucket "${this.bucket}". Operating in memory-only mode.`,
            createError,
          );
          this.client = null;
        }
      } else {
        this.logger.warn(
          'Could not connect to MinIO. Operating in memory-only mode.',
          error,
        );
        this.client = null;
      }
    }
  }
}
