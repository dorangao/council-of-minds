import { MODELS } from "@/lib/config";
import { getOpenAIClient } from "@/lib/openai";
import { formatResearchForPrompt } from "@/lib/research";
import type { MeetingInput, PersonaResult, ResearchResult, ScenarioPlan } from "@/lib/types";

export async function consolidate(params: {
  input: MeetingInput;
  brief: string;
  results: PersonaResult[];
  scenario: ScenarioPlan;
  research: ResearchResult[];
}): Promise<string> {
  const { input, brief, results, scenario, research } = params;
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
- Explicitly separate evidence, assumptions, and uncertainty.

Rules:
- Do NOT invent facts; if unsure, label assumptions.
- Include confidence and key uncertainties.
- Keep language crisp and operational.
`.trim(),
      },
      {
        role: "user",
        content: `
Question:
${input.question}

Context:
${input.context ?? "(none)"}

Decision Criteria:
${input.decisionCriteria ?? "(none)"}

Assumptions:
${input.assumptions ?? "(none)"}

Risks:
${input.risks ?? "(none)"}

Scenario Routing:
- Type: ${scenario.type}
- Rationale: ${scenario.rationale}
- Moderator Guidance: ${scenario.moderatorAddendum}

Decision Brief:
${brief}

External Research:
${formatResearchForPrompt(research)}

Advisor Inputs:
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

4) DEBATE SUMMARY

5) CONTRARIAN ANALYSIS

6) DECISION MEMO
- Problem
- Constraints
- Tradeoffs
- Decision
- Why now

7) RED FLAGS / ASSUMPTIONS TO VERIFY

8) HEDGE PLAN (if we're wrong)

9) NEXT STEPS (owners + time horizons)
Format:
- [Now] (Owner: You) ...
- [This week] (Owner: You) ...
- [This month] (Owner: You) ...

10) CONFIDENCE SCORE (0-100)
Format exactly:
Confidence: <number>/100
Reason:

11) KEY UNCERTAINTIES (up to 5 bullets)
`.trim(),
      },
    ],
  });

  return response.output_text?.trim() ?? "";
}

export function extractConfidenceScore(unified: string): string {
  const match = unified.match(/Confidence:\s*(\d{1,3})\s*\/\s*100/i);
  if (!match?.[1]) {
    return "Unknown";
  }

  const numeric = Math.max(0, Math.min(100, Number(match[1])));
  return `${numeric}/100`;
}

export function extractKeyUncertainties(unified: string): string[] {
  const sectionMatch = unified.match(
    /11\)\s*KEY UNCERTAINTIES[\s\S]*?(?=\n\d+\)\s*[A-Z]|\s*$)/i,
  );

  if (!sectionMatch?.[0]) {
    return [];
  }

  return sectionMatch[0]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, ""))
    .slice(0, 5);
}
