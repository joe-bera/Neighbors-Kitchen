import { Router } from 'express';
import * as devController from '../controllers/devController.js';

// Development-only tools: /api/v1/dev/... Mounted only when practiceMailboxEnabled() (never in production).
export const devRoutes = Router();

devRoutes.get('/emails', devController.listEmails);
devRoutes.get('/emails/:id', devController.getEmail);
