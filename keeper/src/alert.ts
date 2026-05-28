import { logger } from './logger.js';
import { KEEPER_CONFIG } from './config.js';

interface AlertPayload {
  title: string;
  message: string;
  level: 'info' | 'warning' | 'error' | 'success';
  metadata?: Record<string, any>;
}

/**
 * Sends an alert via webhook if configured.
 * Currently supports generic JSON webhooks (Discord, Slack, etc. via simple format).
 * Non-blocking and resilient.
 */
export async function sendAlert(payload: AlertPayload): Promise<void> {
  const webhookUrl = KEEPER_CONFIG.ALERT_WEBHOOK_URL;

  if (!webhookUrl) {
    // No webhook configured — just log it
    logger.info(`[ALERT] ${payload.title}: ${payload.message}`, {
      level: payload.level,
      ...payload.metadata,
    });
    return;
  }

  const body = {
    content: null,
    embeds: [
      {
        title: payload.title,
        description: payload.message,
        color: getColorForLevel(payload.level),
        fields: payload.metadata
          ? Object.entries(payload.metadata).map(([name, value]) => ({
              name,
              value: String(value),
              inline: true,
            }))
          : [],
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      logger.warn('Failed to send alert webhook', {
        status: response.status,
        statusText: response.statusText,
      });
    }
  } catch (error) {
    logger.error('Error sending alert webhook', { error: String(error) });
  }
}

function getColorForLevel(level: AlertPayload['level']): number {
  switch (level) {
    case 'success': return 0x22c55e; // green
    case 'warning': return 0xf59e0b; // amber
    case 'error':   return 0xef4444; // red
    default:        return 0x3b82f6; // blue
  }
}

// Convenience helpers
export const alert = {
  success: (title: string, message: string, metadata?: Record<string, any>) =>
    sendAlert({ title, message, level: 'success', metadata }),

  warning: (title: string, message: string, metadata?: Record<string, any>) =>
    sendAlert({ title, message, level: 'warning', metadata }),

  error: (title: string, message: string, metadata?: Record<string, any>) =>
    sendAlert({ title, message, level: 'error', metadata }),

  info: (title: string, message: string, metadata?: Record<string, any>) =>
    sendAlert({ title, message, level: 'info', metadata }),
};
