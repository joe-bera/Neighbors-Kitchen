import { Request, Response } from 'express';
import { getCurrentUser, updateEmailSettings as saveEmailSettings } from '../services/userService.js';

export async function getMe(req: Request, res: Response) {
  const user = await getCurrentUser(req.user!.id);
  res.status(200).json({ success: true, data: { user } });
}

export async function updateEmailSettings(req: Request, res: Response) {
  const emailSettings = await saveEmailSettings(req.user!.id, req.body);
  res.status(200).json({ success: true, data: { emailSettings }, message: 'Email settings saved' });
}
