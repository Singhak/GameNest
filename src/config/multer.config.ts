import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';

/**
 * Basic Multer options for storing files in memory.
 * Validation (file type, size) is now handled by `ParseFilePipe` in controllers
 * for more explicit, per-route validation.
 */
export const multerOptions: MulterOptions = {
  // Store files in memory for processing
  storage: memoryStorage(),
};