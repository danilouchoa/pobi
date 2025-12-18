import crypto from 'crypto';

export type LogLevel = 'info' | 'warn' | 'error';

export type LogEventPayload = {
  event: string;
  level?: LogLevel;
  requestId?: string;
  correlationId?: string;
  userId?: string;
  ip?: string | null;
  meta?: Record<string, unknown>;
};

const generateId = () => crypto.randomBytes(6).toString('hex');

export const logEvent = ({ event, level = 'info', requestId, correlationId, userId, ip, meta = {} }: LogEventPayload) => {
  const resolvedRequestId = requestId || correlationId || generateId();
  const entry = {
    event,
    ts: new Date().toISOString(),
    requestId: resolvedRequestId,
    userId: userId ?? undefined,
    ip: ip ?? undefined,
    meta,
  };

  const logger = console[level] ?? console.info;
  logger(`[${event}]`, entry);
  return entry;
};

export const maskEmail = (email: string) => {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  if (local.length <= 2) return `${local[0] ?? ''}***@${domain}`;
  return `${local.slice(0, 1)}***${local.slice(-1)}@${domain}`;
};

export const sanitizeUrlForLog = (raw?: string | null) => {
  if (!raw) return '';
  const [scheme, rest] = raw.split('://');
  if (!rest) return raw;
  const withoutCreds = rest.includes('@') ? rest.slice(rest.indexOf('@') + 1) : rest;
  return `${scheme}://${withoutCreds}`;
};

export const describeTarget = (label: string, raw?: string | null) => {
  if (!raw) return `${label}: not configured`;
  return `${label}: ${sanitizeUrlForLog(raw)}`;
};
