import cron from "node-cron";
import { runDeliveryDispatchCycle } from "./deliveryDispatch.job.js";
import { logger } from "../lib/logger.js";
import { dispatchNotificationReminders } from "./notificationReminders.job.js";
import { cleanupArchivedOrders } from "./orderCleanup.job.js";

let schedulerStarted = false;

export const startCronJobs = () => {
  if (schedulerStarted) {
    return;
  }

  schedulerStarted = true;

  cron.schedule(
    "*/1 * * * *",
    () => {
      void runDeliveryDispatchCycle().catch((error) => {
        logger.error("Delivery dispatch cycle failed", {
          error: error instanceof Error ? error.message : "Unknown dispatch cycle error",
        });
      });
    },
    {
      timezone: "Asia/Kolkata",
    },
  );

  cron.schedule(
    "*/30 * * * *",
    () => {
      void dispatchNotificationReminders().catch((error) => {
        logger.error("Notification reminder job failed", {
          error: error instanceof Error ? error.message : "Unknown notification reminder error",
        });
      });
    },
    {
      timezone: "Asia/Kolkata",
    },
  );

  cron.schedule(
    "0 2 * * *",
    () => {
      void cleanupArchivedOrders().catch((error) => {
        logger.error("Order cleanup job failed", {
          error: error instanceof Error ? error.message : "Unknown cleanup error",
        });
      });
    },
    {
      timezone: "Asia/Kolkata",
    },
  );

  logger.info("Cron jobs started", {
    jobs: [
      {
        name: "deliveryDispatch",
        schedule: "*/1 * * * *",
        timezone: "Asia/Kolkata",
      },
      {
        name: "notificationReminders",
        schedule: "*/30 * * * *",
        timezone: "Asia/Kolkata",
      },
      {
        name: "orderCleanup",
        schedule: "0 2 * * *",
        timezone: "Asia/Kolkata",
      },
    ],
  });
};
