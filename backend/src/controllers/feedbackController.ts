import { Request, Response } from 'express';
import { parseInput } from '../middleware/validateRequest.js';
import * as reviewService from '../services/reviewService.js';
import * as suggestionService from '../services/suggestionService.js';
import { reviewListQuerySchema } from '../validators/feedbackSchemas.js';

// Reviews

export async function createReview(req: Request, res: Response) {
  const review = await reviewService.createReview(req.user!.id, req.body);
  res.status(201).json({ success: true, data: { review }, message: 'Thanks for your review!' });
}

export async function listChefReviews(req: Request<{ id: string }>, res: Response) {
  const { page, limit } = parseInput(reviewListQuerySchema, req.query);
  const { reviews, pagination } = await reviewService.listChefReviews(req.params.id, page, limit);
  res.status(200).json({ success: true, data: reviews, pagination });
}

export async function listMealReviews(req: Request<{ id: string }>, res: Response) {
  const { page, limit } = parseInput(reviewListQuerySchema, req.query);
  const { reviews, pagination } = await reviewService.listMealReviews(req.params.id, page, limit);
  res.status(200).json({ success: true, data: reviews, pagination });
}

export async function listMyKitchenReviews(req: Request, res: Response) {
  const { page, limit } = parseInput(reviewListQuerySchema, req.query);
  const { reviews, pagination } = await reviewService.listOwnKitchenReviews(req.user!.id, page, limit);
  res.status(200).json({ success: true, data: reviews, pagination });
}

export async function respondToReview(req: Request<{ id: string }>, res: Response) {
  const review = await reviewService.respondToReview(req.user!.id, req.params.id, req.body.response);
  res.status(200).json({ success: true, data: { review }, message: 'Your reply has been posted' });
}

export async function reportReview(req: Request<{ id: string }>, res: Response) {
  await reviewService.reportReview(req.params.id, req.body.reason);
  res.status(200).json({ success: true, data: null, message: 'Thanks for letting us know. We will take a look.' });
}

// Dish requests

export async function createSuggestion(req: Request<{ id: string }>, res: Response) {
  const suggestion = await suggestionService.createSuggestion(req.user!.id, req.params.id, req.body);
  res.status(201).json({ success: true, data: { suggestion }, message: 'Your dish request has been sent to the chef' });
}

export async function listChefSuggestions(req: Request<{ id: string }>, res: Response) {
  const suggestions = await suggestionService.listChefSuggestions(req.params.id, req.user?.id);
  res.status(200).json({ success: true, data: suggestions });
}

export async function voteForSuggestion(req: Request<{ id: string }>, res: Response) {
  const suggestion = await suggestionService.vote(req.user!.id, req.params.id);
  res.status(200).json({ success: true, data: { suggestion } });
}

export async function removeSuggestionVote(req: Request<{ id: string }>, res: Response) {
  const suggestion = await suggestionService.removeVote(req.user!.id, req.params.id);
  res.status(200).json({ success: true, data: { suggestion } });
}

export async function listMyKitchenSuggestions(req: Request, res: Response) {
  const suggestions = await suggestionService.listOwnKitchenSuggestions(req.user!.id);
  res.status(200).json({ success: true, data: suggestions });
}

export async function updateMyKitchenSuggestion(req: Request<{ id: string }>, res: Response) {
  const suggestion = await suggestionService.updateSuggestion(req.user!.id, req.params.id, req.body);
  res.status(200).json({ success: true, data: { suggestion }, message: 'Request updated' });
}
