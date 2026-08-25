const DEFAULT_BASE_URL = 'https://api.aicredits.in/v1';
const TIMEOUT_MS = 30_000;

export class AiProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiProviderError';
  }
}

export interface AiProviderConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

export function getAiProviderConfig(): AiProviderConfig | null {
  const apiKey = process.env['AICREDITS_API_KEY']?.trim() ?? '';

  if (apiKey === '') {
    return null;
  }

  const model = process.env['AICREDITS_MODEL']?.trim() ?? '';

  if (model === '') {
    throw new AiProviderError(
      'AICREDITS_MODEL is required when AICREDITS_API_KEY is set',
    );
  }

  return {
    apiKey,
    model,
    baseUrl: (process.env['AICREDITS_BASE_URL']?.trim() || DEFAULT_BASE_URL).replace(/\/$/, ''),
  };
}

export function isAiConfigured(): boolean {
  try {
    return getAiProviderConfig() !== null;
  } catch {
    return false;
  }
}

export async function completeJson(systemPrompt: string, userPayload: unknown): Promise<unknown> {
  const config = getAiProviderConfig();

  if (!config) {
    throw new AiProviderError('AI assistance is not configured');
  }

  let response: Response;

  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(userPayload, null, 2) },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new AiProviderError(
      `AI provider request failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');

    throw new AiProviderError(`AI provider returned status ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`);
  }

  const body = (await response.json().catch(() => null)) as
    | { choices?: Array<{ message?: { content?: string } }> }
    | null;

  const content = body?.choices?.[0]?.message?.content;

  if (typeof content !== 'string' || content.trim() === '') {
    throw new AiProviderError('AI provider returned an empty completion');
  }

  return parseJsonContent(content);
}

function parseJsonContent(content: string): unknown {
  const stripped = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  try {
    return JSON.parse(stripped);
  } catch {
    throw new AiProviderError('AI completion was not valid JSON');
  }
}
