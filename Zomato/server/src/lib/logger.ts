type LogContext = Record<string, unknown> | undefined;

const writeLog = (level: "info" | "warn" | "error", message: string, context?: LogContext) => {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context ? { context } : {}),
  };

  console[level](JSON.stringify(entry));
};

export const logger = {
  info: (message: string, context?: LogContext) => writeLog("info", message, context),
  warn: (message: string, context?: LogContext) => writeLog("warn", message, context),
  error: (message: string, context?: LogContext) => writeLog("error", message, context),
};

export const loggerStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};
