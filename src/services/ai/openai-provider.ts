import OpenAI from 'openai';
import { AiProvider, AiMessage, AiStreamEvent } from './ai-provider';
import { prepareProviderMessages } from './chat-payload';
import { providerErrorDetail } from './provider-error';
import { limitVisionDataUrl } from './vision-image';

function describeError(error: unknown): string {
  const details = error as { status?: number; name?: string } | null;
  const reason = providerErrorDetail(error);
  switch (details?.status) {
    case 401: return 'OpenAI rejected the API key. Check the OpenAI API key in Settings.';
    case 403: return 'OpenAI access denied. Check your project permissions and model access.';
    case 404: return 'OpenAI model not found or unavailable to this account. Choose another model in Settings.';
    case 413: return 'OpenAI request is too large. Clear context or capture fewer screens.';
    case 429: return 'OpenAI rate or quota limit reached. Wait before retrying and check your usage limits.';
    case 400: case 422:
      return reason
        ? `OpenAI rejected this request (${reason}). Check the model ID, model access, and context size in Settings.`
        : 'OpenAI rejected this request. Check the model ID, model access, and context size in Settings.';
  }
  if (details?.status && details.status >= 500) return 'OpenAI is temporarily unavailable. Try again shortly.';
  if (details?.name === 'APIConnectionTimeoutError') return 'OpenAI timed out. Check your connection and try again.';
  return 'Could not complete the OpenAI request. Check your internet connection and OpenAI settings.';
}

export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';
  private client: OpenAI | null = null;
  private apiKey: string;
  private model: string;
  private abortController: AbortController | null = null;

  constructor(apiKey: string, model: string = 'gpt-4o') {
    this.apiKey = apiKey;
    this.model = model;
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    }
  }

  async streamChat(messages: AiMessage[], onEvent: (event: AiStreamEvent) => void): Promise<void> {
    if (!this.client) {
      onEvent({ type: 'error', content: 'OpenAI API key not configured' });
      return;
    }

    this.abortController = new AbortController();

    try {
      const prepared = prepareProviderMessages(messages);
      const stream = await this.client.chat.completions.create(
        {
          model: this.model,
          messages: [
            ...(prepared.system ? [{ role: 'system' as const, content: prepared.system }] : []),
            ...prepared.turns.map(turn => turn.role === 'user' && turn.images?.length
              ? { role: 'user' as const, content: [
                { type: 'text' as const, text: turn.content },
                ...turn.images.map(url => ({ type: 'image_url' as const, image_url: { url: limitVisionDataUrl(url).dataUrl, detail: 'auto' as const } }))
              ] }
              : { role: turn.role, content: turn.content })
          ],
          stream: true,
          temperature: 0.7,
          max_tokens: 2048
        },
        { signal: this.abortController.signal }
      );

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          onEvent({ type: 'token', content: delta });
        }
      }

      onEvent({ type: 'done', content: '' });
    } catch (err: unknown) {
      const name = err && typeof err === 'object' && 'name' in err ? String((err as { name?: unknown }).name) : '';
      if (name === 'AbortError') return;
      onEvent({ type: 'error', content: describeError(err) });
    } finally {
      this.abortController = null;
    }
  }

  cancelStream(): void {
    this.abortController?.abort();
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async supportsImages(): Promise<boolean> { return true; }

  setApiKey(key: string): void {
    this.apiKey = key;
    this.client = key ? new OpenAI({ apiKey: key }) : null;
  }

  setModel(model: string): void {
    this.model = model;
  }
}
