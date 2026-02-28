import { getOpenAIClient } from "@/lib/openai";
import { MODELS } from "@/lib/config";
import type { PersonaResult } from "@/lib/meeting";

export async function consolidate(params: {
  question: string;
  context?: string;
  brief: string;
  results: PersonaResult[];
}): Promise<string> {
  const { question, context, brief, results } = params;
  const openai = getOpenAIClient();

  const transcript = results
    .map(
      (result) => `
## ${result.name}
Lens: ${result.lens}

Answer:
${result.answer}

Critique:
${result.critique ?? "(none)"}
`.trim(),
    )
    .join("\n\n");

  const response = await openai.responses.create({
    model: MODELS.main,
    input: [
      {
        role: "system",
        content: `
You are the Moderator of a high-performance advisory council.

Goals:
- Combine perspectives into one coherent plan.
- Preserve useful disagreements as explicit tradeoffs.
- Output must be practical, specific, and executable.

Rules:
- Do NOT invent facts; if unsure, label assumptions.
- Prefer checklists over vague inspiration.
- Keep language crisp.
`.trim(),
      },
      {
        role: "user",
        content: `
Decision Brief:
${brief}

Question:
${question}

Context:
${context ?? "(none)"}

Advisor inputs:
${transcript}

Produce EXACTLY these sections:

1) UNIFIED RECOMMENDATION (7-12 bullets max)

2) OPTIONS (at least 3)
- Option A:
- Option B:
- Option C:

3) DECISION SCORECARD (1-5, higher is better)
Score each option on:
- Speed to ship
- Cost
- Risk
- Long-term leverage
- Complexity
Then: "Scorecard winner: ___"

4) DECISION MEMO
- Problem
- Constraints
- Tradeoffs
- Decision
- Why now

5) RED FLAGS / ASSUMPTIONS TO VERIFY

6) HEDGE PLAN (if we're wrong)

7) NEXT STEPS (owners + time horizons)
Format:
- [Now] (Owner: You) ...
- [This week] (Owner: You) ...
- [This month] (Owner: You) ...
`.trim(),
      },
    ],
  });

  return response.output_text?.trim() ?? "";
}
