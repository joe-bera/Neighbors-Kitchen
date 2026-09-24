import { Request, Response } from 'express';
import * as chefMealService from '../services/chefMealService.js';
import * as kitchenService from '../services/kitchenService.js';

export async function becomeChef(req: Request, res: Response) {
  const chefProfile = await kitchenService.becomeChef(req.user!.id, req.body);
  res.status(201).json({ success: true, data: { chefProfile }, message: 'Your kitchen is set up' });
}

export async function getMyKitchen(req: Request, res: Response) {
  const chefProfile = await kitchenService.getOwnKitchen(req.user!.id);
  res.status(200).json({ success: true, data: { chefProfile } });
}

export async function updateMyKitchen(req: Request, res: Response) {
  const chefProfile = await kitchenService.updateOwnKitchen(req.user!.id, req.body);
  res.status(200).json({ success: true, data: { chefProfile }, message: 'Kitchen updated' });
}

export async function updateMyAvailability(req: Request, res: Response) {
  const chefProfile = await kitchenService.updateAvailability(req.user!.id, req.body);
  res.status(200).json({ success: true, data: { chefProfile }, message: 'Availability saved' });
}

export async function listMyMeals(req: Request, res: Response) {
  const meals = await chefMealService.listOwnMeals(req.user!.id);
  res.status(200).json({ success: true, data: meals });
}

export async function createMyMeal(req: Request, res: Response) {
  const meal = await chefMealService.createMeal(req.user!.id, req.body);
  res.status(201).json({ success: true, data: { meal }, message: 'Meal added' });
}

export async function updateMyMeal(req: Request<{ id: string }>, res: Response) {
  const meal = await chefMealService.updateMeal(req.user!.id, req.params.id, req.body);
  res.status(200).json({ success: true, data: { meal }, message: 'Meal updated' });
}

export async function deleteMyMeal(req: Request<{ id: string }>, res: Response) {
  await chefMealService.deleteMeal(req.user!.id, req.params.id);
  res.status(204).end();
}
