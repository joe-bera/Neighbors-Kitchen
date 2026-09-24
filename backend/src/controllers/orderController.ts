import { Request, Response } from 'express';
import { parseInput } from '../middleware/validateRequest.js';
import * as orderService from '../services/orderService.js';
import { orderListQuerySchema } from '../validators/orderSchemas.js';

// Customers

export async function placeOrder(req: Request, res: Response) {
  const order = await orderService.placeOrder(req.user!.id, req.body);
  res.status(201).json({ success: true, data: { order }, message: 'Your pre-order has been sent to the chef' });
}

export async function listMyOrders(req: Request, res: Response) {
  const orders = await orderService.listCustomerOrders(req.user!.id);
  res.status(200).json({ success: true, data: orders });
}

export async function getOrder(req: Request<{ id: string }>, res: Response) {
  const order = await orderService.getOrderForUser(req.user!.id, req.params.id);
  res.status(200).json({ success: true, data: { order } });
}

export async function cancelMyOrder(req: Request<{ id: string }>, res: Response) {
  const order = await orderService.cancelOrderAsCustomer(req.user!.id, req.params.id, req.body.reason);
  res.status(200).json({ success: true, data: { order }, message: 'Your order has been cancelled' });
}

// Chefs

export async function listKitchenOrders(req: Request, res: Response) {
  const { view } = parseInput(orderListQuerySchema, req.query);
  const orders = await orderService.listChefOrders(req.user!.id, view);
  res.status(200).json({ success: true, data: orders });
}

export async function updateKitchenOrderStatus(req: Request<{ id: string }>, res: Response) {
  const order = await orderService.advanceOrderStatus(req.user!.id, req.params.id, req.body.status);
  res.status(200).json({ success: true, data: { order } });
}

export async function cancelKitchenOrder(req: Request<{ id: string }>, res: Response) {
  const order = await orderService.cancelOrderAsChef(req.user!.id, req.params.id, req.body.reason);
  res.status(200).json({ success: true, data: { order }, message: 'The order has been cancelled' });
}
