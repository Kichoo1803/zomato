import { logger } from "../lib/logger.js";
import { orderDispatchService } from "../modules/orders/order-dispatch.service.js";

export const runDeliveryDispatchCycle = async () => {
  const result = await orderDispatchService.rebroadcastUnassignedOrders();

  logger.info("Delivery dispatch cycle completed", result);

  return result;
};
