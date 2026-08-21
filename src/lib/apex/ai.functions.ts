import { createServerFn } from "@tanstack/react-start";
import { briefSchema, runReasoningChain, type ApexBrief, type ApexReasoning } from "./ai.server";

export type { ApexBrief, ApexReasoning };

export const apexReasoning = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => briefSchema.parse(data))
  .handler(async ({ data }): Promise<ApexReasoning> => runReasoningChain(data));
