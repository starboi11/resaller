import { Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

@Injectable()
export class MediaStorageService {
  private readonly root = resolve(process.env.MEDIA_ROOT ?? './data/media');
  private readonly driver = process.env.MEDIA_STORAGE_DRIVER ?? 'local';
  private readonly bucket = process.env.S3_BUCKET;
  private readonly privateBucket = process.env.S3_PRIVATE_BUCKET;
  private readonly privateRoot = resolve(
    process.env.PRIVATE_MEDIA_ROOT ?? './data/private-media',
  );
  private readonly s3 =
    this.driver === 's3'
      ? new S3Client({
          region: process.env.S3_REGION ?? 'auto',
          forcePathStyle:
            (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true',
          ...(process.env.S3_ENDPOINT
            ? { endpoint: process.env.S3_ENDPOINT }
            : {}),
          ...(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
            ? {
                credentials: {
                  accessKeyId: process.env.S3_ACCESS_KEY_ID,
                  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
                },
              }
            : {}),
        })
      : null;

  async put(key: string, bytes: Buffer, contentType: string): Promise<void> {
    if (this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.requiredBucket(),
          Key: key,
          Body: bytes,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      return;
    }
    await mkdir(this.root, { recursive: true });
    await writeFile(resolve(this.root, key), bytes, { flag: 'wx' });
  }

  async get(key: string): Promise<Buffer> {
    if (this.s3) {
      const result = await this.s3.send(
        new GetObjectCommand({ Bucket: this.requiredBucket(), Key: key }),
      );
      return Buffer.from(await result.Body!.transformToByteArray());
    }
    return readFile(resolve(this.root, key));
  }

  async delete(key: string): Promise<void> {
    if (this.s3) {
      await this.s3.send(
        new DeleteObjectCommand({ Bucket: this.requiredBucket(), Key: key }),
      );
      return;
    }
    await unlink(resolve(this.root, key)).catch(() => undefined);
  }

  async putPrivate(key: string, bytes: Buffer, contentType: string): Promise<void> {
    if (this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.requiredPrivateBucket(),
          Key: key,
          Body: bytes,
          ContentType: contentType,
          CacheControl: 'private, no-store',
        }),
      );
      return;
    }
    await mkdir(this.privateRoot, { recursive: true });
    await writeFile(resolve(this.privateRoot, key), bytes, {
      flag: 'wx',
      mode: 0o600,
    });
  }

  async getPrivate(key: string): Promise<Buffer> {
    if (this.s3) {
      const result = await this.s3.send(
        new GetObjectCommand({ Bucket: this.requiredPrivateBucket(), Key: key }),
      );
      return Buffer.from(await result.Body!.transformToByteArray());
    }
    return readFile(resolve(this.privateRoot, key));
  }

  async deletePrivate(key: string): Promise<void> {
    if (this.s3) {
      await this.s3.send(
        new DeleteObjectCommand({ Bucket: this.requiredPrivateBucket(), Key: key }),
      );
      return;
    }
    await unlink(resolve(this.privateRoot, key)).catch(() => undefined);
  }

  private requiredBucket(): string {
    if (!this.bucket)
      throw new Error('S3_BUCKET is required when MEDIA_STORAGE_DRIVER=s3');
    return this.bucket;
  }

  private requiredPrivateBucket(): string {
    if (!this.privateBucket)
      throw new Error(
        'S3_PRIVATE_BUCKET is required when MEDIA_STORAGE_DRIVER=s3',
      );
    return this.privateBucket;
  }
}
