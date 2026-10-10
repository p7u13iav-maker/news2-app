import { google } from "@ai-sdk/google";

/**
 * Google Gemini AI provider (via Vercel AI SDK).
 * The API key is read from GEMINI_API_KEY env var (set in Vercel project
 * settings for production, .env.local for local dev).
 *
 * Get a key: https://aistudio.google.com/apikey
 */
export const geminiModel =
  process.env.GEMINI_MODEL || "gemini-2.0-flash";

/** Check if Gemini is configured (has an API key). */
export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/** Return a Gemini language model instance. */
export function getGemini() {
  return google(geminiModel);
}
