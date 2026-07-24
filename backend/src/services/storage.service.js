import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

const s3 = new S3Client({
  region: 'auto',
  endpoint: env.r2.endpoint,
  credentials: {
    accessKeyId: env.r2.accessKeyId,
    secretAccessKey: env.r2.secretAccessKey,
  },
});

/**
 * Uploads a file to Cloudflare R2
 * @param {Buffer|string} fileContent - Buffer or Base64 string
 * @param {string} folder - Folder name (e.g., 'profile-photos')
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} - Public URL of the uploaded file
 */
export const uploadFile = async (fileContent, folder = 'general', contentType = 'image/jpeg') => {
  try {
    let buffer;
    if (typeof fileContent === 'string' && fileContent.startsWith('data:')) {
      // Handle Base64 Data URL
      const base64Data = fileContent.split(',')[1];
      buffer = Buffer.from(base64Data, 'base64');
      contentType = fileContent.split(';')[0].split(':')[1];
    } else if (Buffer.isBuffer(fileContent)) {
      buffer = fileContent;
    } else {
      throw new Error('Invalid file content type');
    }

    const fileExtension = contentType.split('/')[1] || 'jpg';
    const fileName = `${folder}/${uuidv4()}.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: env.r2.bucket,
      Key: fileName,
      Body: buffer,
      ContentType: contentType,
    });

    await s3.send(command);

    const publicUrl = env.r2.publicUrl
      ? `${env.r2.publicUrl}/${fileName}`
      : `${env.r2.endpoint}/${env.r2.bucket}/${fileName}`;

    logger.info(`File uploaded to R2: ${fileName}`);
    return publicUrl;
  } catch (error) {
    logger.error('R2 Upload Error', error);
    throw error;
  }
};

export const deleteFile = async (fileUrl) => {
  try {
    if (!fileUrl) return;

    // Extract key from URL
    // This is naive and depends on how publicUrl is formatted
    let key;
    if (env.r2.publicUrl && fileUrl.startsWith(env.r2.publicUrl)) {
      key = fileUrl.replace(`${env.r2.publicUrl}/`, '');
    } else {
      // Fallback: try to extract after bucket name
      const parts = fileUrl.split(`${env.r2.bucket}/`);
      if (parts.length > 1) key = parts[1];
    }

    if (!key) return;

    const command = new DeleteObjectCommand({
      Bucket: env.r2.bucket,
      Key: key,
    });

    await s3.send(command);
    logger.info(`File deleted from R2: ${key}`);
  } catch (error) {
    logger.error('R2 Delete Error', error);
  }
};
