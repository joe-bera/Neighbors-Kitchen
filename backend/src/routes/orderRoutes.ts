import { Router } from 'express';
import * as orderController from '../controllers/orderController.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validateRequest.js';
import { cancelOrderSchema, placeOrderSchema } from '../validators/orderSchemas.js';

// Orders placed by the signed-in person: /api/v1/orders/...
export const orderRoutes = Router();
orderRoutes.use(requireAuth);

orderRoutes.post('/', validateBody(placeOrderSchema), orderController.placeOrder);
orderRoutes.get('/', orderController.listMyOrders);
orderRoutes.get('/:id', orderController.getOrder);
orderRoutes.post('/:id/cancel', validateBody(cancelOrderSchema), orderController.cancelMyOrder);
