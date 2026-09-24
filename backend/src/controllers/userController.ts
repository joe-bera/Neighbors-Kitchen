import { Request, Response } from 'express';
import { getCurrentUser } from '../services/userService.js';

export async function getMe(req: Request, res: Response) {
  const user = await getCurrentUser(req.user!.id);
  res.status(200).json({ success: true, data: { user } });
}
