import { BadRequestException } from '@nestjs/common';

export const imageFileFilter = (
  _req: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  // Check MIME type
  if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
    return callback(
      new BadRequestException(
        'Only image files (jpg, jpeg, png, webp) are allowed',
      ),
      false,
    );
  }

  // Additional check: verify file extension matches MIME type
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  const fileExtension = file.originalname
    .toLowerCase()
    .substring(file.originalname.lastIndexOf('.'));

  if (!allowedExtensions.includes(fileExtension)) {
    return callback(new BadRequestException('Invalid file extension'), false);
  }

  callback(null, true);
};

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
