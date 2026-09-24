import { Request, Response } from 'express';
import { parseInput } from '../middleware/validateRequest.js';
import * as chefService from '../services/chefService.js';
import * as mealService from '../services/mealService.js';
import { chefListQuerySchema, mealListQuerySchema } from '../validators/catalogSchemas.js';

export async function listChefs(req: Request, res: Response) {
  const { chefs, pagination } = await chefService.listChefs(parseInput(chefListQuerySchema, req.query));
  res.status(200).json({ success: true, data: chefs, pagination });
}

export async function getChef(req: Request<{ id: string }>, res: Response) {
  const chef = await chefService.getChefProfile(req.params.id);
  res.status(200).json({ success: true, data: { chef } });
}

export async function getOrderSlots(req: Request<{ id: string }>, res: Response) {
  const slots = await chefService.getOrderSlots(req.params.id);
  res.status(200).json({ success: true, data: slots });
}

export async function listMeals(req: Request, res: Response) {
  const { meals, pagination } = await mealService.listMeals(parseInput(mealListQuerySchema, req.query));
  res.status(200).json({ success: true, data: meals, pagination });
}

export async function getMeal(req: Request<{ id: string }>, res: Response) {
  const meal = await mealService.getMeal(req.params.id);
  res.status(200).json({ success: true, data: { meal } });
}

export async function getMealFilters(_req: Request, res: Response) {
  const filters = await mealService.getMealFilters();
  res.status(200).json({ success: true, data: filters });
}
