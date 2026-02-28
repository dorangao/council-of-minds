/**
 * Centralized model configuration for OpenAI API calls.
 */
export const MODELS = {
  /** Main model for consolidation and complex reasoning */
  main: "gpt-5.2",
  /** Faster, cheaper model for persona answers, critiques, and brief prep */
  mini: "gpt-5-mini",
} as const;
