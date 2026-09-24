import { Request, Response } from 'express';
import { saveMealPhoto } from '../services/uploadService.js';
import { AppError } from '../utils/errors.js';

export async function uploadMealPhoto(req: Request, res: Response) {
  if (!req.file) throw new AppError(422, 'NO_FILE', 'Choose a photo to upload');
  const url = await saveMealPhoto(req.file.buffer);
  res.status(201).json({ success: true, data: { url } });
}
