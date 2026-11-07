import { z } from 'zod';
import type { LlmPort } from '../ports';

export class StructuredOutputError extends Error {
  constructor(message: string, readonly issues: string) {
    super(message);
    this.name = 'StructuredOutputError';
  }
}

/**
 * Calls the LLM with a forced tool whose parameters are generated from `schema`, then
 * validates the result. One repair attempt with the validation errors fed back.
 */
export async function callStructured<S extends z.ZodType>(
  llm: LlmPort,
  args: { system: string; user: string; toolName: string; toolDescription: string; schema: S; maxTokens?: number },
): Promise<{ value: z.infer<S>; model: string; calls: number }> {
  const jsonSchema = z.toJSONSchema(args.schema, { target: 'draft-7', io: 'input' }) as Record<string, unknown>;
  delete jsonSchema.$schema;
  let user = args.user;
  let lastIssues = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    const { args: raw, model } = await llm.callTool({
      system: args.system,
      user,
      toolName: args.toolName,
      toolDescription: args.toolDescription,
      jsonSchema,
      maxTokens: args.maxTokens,
    });
    const parsed = args.schema.safeParse(raw);
    if (parsed.success) return { value: parsed.data, model, calls: attempt };
    lastIssues = z.prettifyError(parsed.error);
    user = `${args.user}\n\nYour previous tool call was invalid:\n${lastIssues}\nCall the tool again with corrected arguments.`;
  }
  throw new StructuredOutputError(`LLM output failed validation for ${args.toolName}`, lastIssues);
}
