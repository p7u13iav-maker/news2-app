import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * OITOMA AI (Okayama University) — OpenAI-compatible endpoint.
 * The API key is read from OITOMA_API_KEY env var (set in Vercel project
 * settings for production, .env.local for local dev).
 *
 * Docs: https://ironical.okayama-u.ac.jp/ai/explanation
 */
export const oitoma = createOpenAICompatible({
  name: "oitoma",
  apiKey: process.env.OITOMA_API_KEY,
  baseURL: process.env.OITOMA_BASE_URL || "https://ironical.okayama-u.ac.jp/ai/v1",
});

export const oitomaModel = process.env.OITOMA_MODEL || "qwen3.8-27b-it";

/** Check if OITOMA is configured (has an API key). */
export function isOitomaConfigured(): boolean {
  return Boolean(process.env.OITOMA_API_KEY);
}
