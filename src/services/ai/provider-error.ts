const SECRET = /(?:sk-ant-|sk-|gsk_)[A-Za-z0-9_-]{4,}/g;

/** Anthropic nests the reason at error.error.type/message. OpenAI and Groq use error.type/message. */
export function providerErrorDetail(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const body = (error as { error?: unknown }).error;
  const nested = body && typeof body === 'object' && 'error' in body
    ? (body as { error?: unknown }).error
    : body;
  if (!nested || typeof nested !== 'object') return null;
  const fields = nested as { type?: unknown; code?: unknown; message?: unknown };
  const kind = typeof fields.type === 'string' ? fields.type : typeof fields.code === 'string' ? fields.code : '';
  const message = typeof fields.message === 'string' ? fields.message : '';
  const cleaned = `${kind}${kind && message ? ': ' : ''}${message}`
    .replace(SECRET, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
  if (!cleaned || /data:image\/|base64,/i.test(cleaned)) return null;
  return cleaned;
}
