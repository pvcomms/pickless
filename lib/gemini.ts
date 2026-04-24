// Robust Gemini caller with auto-fallback across models when one is overloaded.
// Tries the primary model first, then falls through alternates on 5xx/UNAVAILABLE.

const KEY = process.env.GEMINI_API_KEY;
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Lite first = fastest. Fall back to bigger models only on failure.
const FALLBACK_CHAIN = [
  "gemini-flash-lite-latest",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash-lite",
  "gemini-flash-latest",
  "gemini-2.5-flash",
];

export type GeminiOpts = {
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  models?: string[];
  timeoutMs?: number;
};

export type GeminiResult = {
  text: string;
  modelUsed: string;
  tries: number;
};

export async function callGemini(opts: GeminiOpts): Promise<GeminiResult> {
  const models = opts.models ?? FALLBACK_CHAIN;
  let lastErr: Error | null = null;
  let tries = 0;
  for (const model of models) {
    tries++;
    try {
      const ctl = new AbortController();
      const timeout = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 25000);
      const res = await fetch(`${BASE}/${model}:generateContent?key=${KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: opts.prompt }] }],
          generationConfig: {
            temperature: opts.temperature ?? 0.8,
            maxOutputTokens: opts.maxOutputTokens ?? 400,
          },
        }),
        signal: ctl.signal,
      });
      clearTimeout(timeout);
      if (res.status === 503 || res.status === 429 || res.status >= 500) {
        lastErr = new Error(`${model} → ${res.status}`);
        continue; // try next model
      }
      if (!res.ok) {
        const body = await res.text();
        lastErr = new Error(`${model} → ${res.status}: ${body.slice(0, 200)}`);
        continue;
      }
      const data = await res.json();
      const text: string =
        data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (!text) {
        lastErr = new Error(`${model} → empty response`);
        continue;
      }
      return { text, modelUsed: model, tries };
    } catch (e) {
      lastErr = e as Error;
    }
  }
  throw lastErr ?? new Error("all gemini models failed");
}

// Parse first JSON object out of a response (handles markdown fences too).
export function extractJson<T = any>(text: string): T | null {
  try {
    const m = text.match(/\{[\s\S]+\}/);
    if (!m) return null;
    return JSON.parse(m[0]) as T;
  } catch {
    return null;
  }
}
