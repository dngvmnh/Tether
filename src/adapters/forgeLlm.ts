/** LlmPort on Forge LLMs (Atlassian-hosted Claude). No API keys, Runs-on-Atlassian eligible. */
import { chat } from '@forge/llm';
import { PortError, type LlmPort, type LlmToolRequest } from '../engine/ports';

export class ForgeLlmAdapter implements LlmPort {
  /** @param models tried in order; e.g. a model returning 403 "not allowed" falls through. */
  constructor(private readonly models: string[]) {}

  async callTool(req: LlmToolRequest): Promise<{ args: unknown; model: string }> {
    let last: unknown;
    for (const model of this.models) {
      try {
        // Note: temperature/top_p are rejected by newer models (claude-sonnet-5, claude-opus-5), so never send them.
        const res = await chat({
          model,
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.user },
          ],
          tools: [{ type: 'function', function: { name: req.toolName, description: req.toolDescription, parameters: req.jsonSchema } }],
          tool_choice: { type: 'function', function: { name: req.toolName } },
          max_completion_tokens: req.maxTokens ?? 2000,
        });
        const call = res.choices[0]?.message.tool_calls?.find((t) => t.function.name === req.toolName);
        if (!call) throw new PortError(`${model} did not call ${req.toolName}`, 'LLM_NO_TOOL_CALL', true);
        const args = typeof call.function.arguments === 'string' ? JSON.parse(call.function.arguments) : call.function.arguments;
        return { args, model };
      } catch (e) {
        last = e;
        console.warn(`[tether] LLM call failed on ${model}`, (e as { context?: { responseText?: string } }).context?.responseText ?? e);
      }
    }
    throw new PortError(`All configured models failed: ${(last as Error)?.message ?? last}`, 'LLM_UNAVAILABLE', true);
  }
}
