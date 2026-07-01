import { v2 as cloudinary } from 'cloudinary';

import { env } from '../config/env';
import {
  isSupportedStoredImageExtension,
  supportedImageMimeTypes,
  type StoredImage,
  type StoreImageInput
} from './imageStorage';

function configureCloudinary() {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

export function storeImageInCloudinary(
  input: StoreImageInput
): Promise<StoredImage> {
  const extension = input.extension.toLowerCase();

  if (!isSupportedStoredImageExtension(extension)) {
    return Promise.reject(new Error('Unsupported Cloudinary image extension'));
  }

  if (!supportedImageMimeTypes.has(input.mimetype)) {
    return Promise.reject(new Error('Unsupported Cloudinary image MIME type'));
  }

  configureCloudinary();

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        folder: env.CLOUDINARY_FOLDER,
        use_filename: false,
        unique_filename: true,
        overwrite: false
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        if (!result) {
          reject(new Error('Cloudinary upload completed without a result'));
          return;
        }

        resolve({
          url: result.secure_url,
          filename: result.public_id,
          size: result.bytes,
          mimetype: input.mimetype,
          originalName: input.originalName
        });
      }
    );

    uploadStream.end(input.buffer);
  });
}
