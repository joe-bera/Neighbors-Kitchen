import { Router } from 'express';
import * as feedbackController from '../controllers/feedbackController.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validateRequest.js';
import { createReviewSchema, reportReviewSchema } from '../validators/feedbackSchemas.js';

// Reviews written by the signed-in customer: /api/v1/reviews/...
export const reviewRoutes = Router();
reviewRoutes.use(requireAuth);

reviewRoutes.post('/', validateBody(createReviewSchema), feedbackController.createReview);
reviewRoutes.post('/:id/report', validateBody(reportReviewSchema), feedbackController.reportReview);

// Votes on dish requests: /api/v1/suggestions/...
export const suggestionRoutes = Router();
suggestionRoutes.use(requireAuth);

suggestionRoutes.post('/:id/vote', feedbackController.voteForSuggestion);
suggestionRoutes.delete('/:id/vote', feedbackController.removeSuggestionVote);
