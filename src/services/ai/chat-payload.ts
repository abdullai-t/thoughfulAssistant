import type { AiMessage } from './ai-provider';

export interface PreparedTurn {
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
}

/** Shape messages so providers do not receive empty text, an empty system prompt, or a leading assistant turn. */
export function prepareProviderMessages(messages: AiMessage[]): { system?: string; turns: PreparedTurn[] } {
  const system = messages
    .filter(message => message.role === 'system')
    .map(message => message.content.trim())
    .filter(Boolean)
    .join('\n\n') || undefined;

  const turns: PreparedTurn[] = [];
  for (const message of messages) {
    if (message.role === 'system') continue;
    const images = message.images?.map(image => image.trim()).filter(Boolean);
    const content = message.content.trim();
    if (!content && !images?.length) continue;
    const text = content || 'See the attached screen image.';
    const previous = turns.at(-1);
    if (previous && previous.role === message.role) {
      previous.content = `${previous.content}\n\n${text}`;
      if (images?.length) previous.images = [...(previous.images ?? []), ...images];
      continue;
    }
    turns.push({ role: message.role, content: text, ...(images?.length ? { images } : {}) });
  }
  while (turns[0]?.role === 'assistant') turns.shift();
  if (!turns.length) turns.push({ role: 'user', content: 'Continue.' });
  return { system, turns };
}
