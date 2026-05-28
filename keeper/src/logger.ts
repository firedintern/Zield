// Simple structured logger (can be replaced with pino later)
export const logger = {
  info: (msg: string, meta?: Record<string, any>) => {
    console.log(JSON.stringify({ level: "info", msg, ...meta, ts: new Date().toISOString() }));
  },
  warn: (msg: string, meta?: Record<string, any>) => {
    console.warn(JSON.stringify({ level: "warn", msg, ...meta, ts: new Date().toISOString() }));
  },
  error: (msg: string, meta?: Record<string, any>) => {
    console.error(JSON.stringify({ level: "error", msg, ...meta, ts: new Date().toISOString() }));
  },
};
