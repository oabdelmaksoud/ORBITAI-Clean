/**
 * Shared LLM Provider Interface
 *
 * Canonical contract for "standard" providers that expose the
 * `(prompt, model, config?)` shape. Concrete providers satisfy this
 * structurally (no `implements` clause required) so that existing
 * per-file `LLMResponse`/`LLMConfig` types remain untouched.
 *
 * Note: a few providers (Groq, OpenRouter, Vertex, Azure) intentionally use a
 * different `generateContent(model, messages, options)` signature dictated by
 * their callers and are NOT expected to satisfy this interface. They still
 * expose `generateContentStream` mirroring their own signature so streaming is
 * uniformly available across every provider.
 */

/**
 * Standard LLM response shape, mirroring the duplicated definitions in
 * OpenAIService / AnthropicService / etc.
 */
export interface LLMResponse {
  text: string;
  functionCalls?: Array<{
    name: string;
    args: Record<string, any>;
  }>;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Standard generation config. Superset of the per-file `LLMConfig` shapes:
 * `responseFormat` is present on OpenAI/Ollama/vLLM/OpenAICompatible but absent
 * on Anthropic/Mistral — keeping it optional here lets all standard providers
 * satisfy the interface structurally.
 */
export interface LLMConfig {
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: 'json_object' | 'text' };
  tools?: any[];
}

/**
 * Shared interface implemented (structurally) by standard LLM providers.
 */
export interface ILLMProvider {
  /**
   * Generate a complete (non-streaming) response.
   */
  generateContent(prompt: string, model: string, config?: LLMConfig): Promise<LLMResponse>;

  /**
   * Generate a response as an async stream of text chunks. Providers that
   * cannot stream natively yield the full text once as a correct fallback.
   */
  generateContentStream(
    prompt: string,
    model: string,
    config?: LLMConfig
  ): AsyncGenerator<string, void, unknown>;

  /**
   * Whether the provider is currently usable (e.g. API key configured).
   */
  isAvailable(): Promise<boolean>;
}
