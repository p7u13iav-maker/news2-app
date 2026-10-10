import { createGoogle } from "@ai-sdk/google";

/**
 * Google Gemini AI provider (via Vercel AI SDK).
 * The API key is read from GEMINI_API_KEY env var and passed explicitly to
 * createGoogle(), since the SDK defaults to GOOGLE_GENERATIVE_AI_API_KEY.
 *
 * Get a key: https://aistudio.google.com/apikey
 */
const apiKey =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
  "";

export const geminiModel =
  process.env.GEMINI_MODEL || "gemini-3.8-flash";

/** Check if Gemini is configured (has an API key). */
export function isGeminiConfigured(): boolean {
  return Boolean(apiKey);
}

/** Return a Gemini language model instance. */
export function getGemini() {
  const google = createGoogle({ apiKey });
  return google(geminiModel);
}
