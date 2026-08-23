import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type { Environment } from '../config/environment';

const UPLOAD_URL_TTL_SECONDS = 15 * 60;
const READ_URL_TTL_SECONDS = 15 * 60;

@Injectable()
export class StorageService {
  private readonly client: S3Client | null;
  private readonly bucket: string | null;

  constructor(
    private readonly configService: ConfigService<Environment, true>,
  ) {
    const endpoint = this.configService.get('S3_ENDPOINT', {
      infer: true,
    });

    const region = this.configService.get('S3_REGION', {
      infer: true,
    });

    const bucket = this.configService.get('S3_BUCKET', {
      infer: true,
    });

    const accessKeyId = this.configService.get('S3_ACCESS_KEY_ID', {
      infer: true,
    });

    const secretAccessKey = this.configService.get('S3_SECRET_ACCESS_KEY', {
      infer: true,
    });

    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
      this.client = null;
      this.bucket = null;

      return;
    }

    this.bucket = bucket;

    this.client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  isConfigured(): boolean {
    return this.client !== null && this.bucket !== null;
  }

  async createUploadUrl(input: {
    storageKey: string;
    contentType: string;
  }): Promise<{
    url: string;
    expiresInSeconds: number;
  }> {
    const { client, bucket } = this.requireStorage();

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: input.storageKey,
      ContentType: input.contentType,
    });

    const url = await getSignedUrl(client, command, {
      expiresIn: UPLOAD_URL_TTL_SECONDS,
    });

    return {
      url,
      expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    };
  }

  async createReadUrl(storageKey: string): Promise<{
    url: string;
    expiresInSeconds: number;
  }> {
    const { client, bucket } = this.requireStorage();

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: storageKey,
    });

    const url = await getSignedUrl(client, command, {
      expiresIn: READ_URL_TTL_SECONDS,
    });

    return {
      url,
      expiresInSeconds: READ_URL_TTL_SECONDS,
    };
  }

  async getObjectMetadata(storageKey: string): Promise<{
    contentType: string | null;
    contentLength: number | null;
  }> {
    const { client, bucket } = this.requireStorage();

    const response = await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: storageKey,
      }),
    );

    return {
      contentType: response.ContentType ?? null,

      contentLength: response.ContentLength ?? null,
    };
  }

  async deleteObject(storageKey: string): Promise<void> {
    const { client, bucket } = this.requireStorage();

    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: storageKey,
      }),
    );
  }

  private requireStorage(): {
    client: S3Client;
    bucket: string;
  } {
    if (!this.client || !this.bucket) {
      throw new ServiceUnavailableException('Object storage is not configured');
    }

    return {
      client: this.client,
      bucket: this.bucket,
    };
  }
}
