import { Request, Response } from 'express';
import * as practiceMailbox from '../services/notifications/practiceMailbox.js';

export async function listEmails(_req: Request, res: Response) {
  const emails = await practiceMailbox.listPracticeEmails();
  res.status(200).json({ success: true, data: { emails } });
}

export async function getEmail(req: Request<{ id: string }>, res: Response) {
  const email = await practiceMailbox.getPracticeEmail(req.params.id);
  res.status(200).json({ success: true, data: { email } });
}
