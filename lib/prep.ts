import { MODELS } from "@/lib/config";
import { getOpenAIClient } from "@/lib/openai";
import { formatResearchForPrompt } from "@/lib/research";
import type { MeetingInput, ResearchResult, ScenarioPlan } from "@/lib/types";

export async function prepareBrief(params: {
  input: MeetingInput;
  scenario: ScenarioPlan;
  research: ResearchResult[];
}): Promise<string> {
  const { input, scenario, research } = params;
  const openai = getOpenAIClient();

  const response = await openai.responses.create({
    model: MODELS.mini,
    input: [
      {
        role: "system",
        content:
          "You are a decision-brief extractor. Be crisp, specific, and evidence-aware. If unknown, label it as Unknown.",
      },
      {
        role: "user",
        content: `
Question:
${input.question}

Context (facts only):
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

External Research:
${formatResearchForPrompt(research)}

Return exactly these sections in order:

GOAL:
CONSTRAINTS:
ASSUMPTIONS (5-10):
UNKNOWNS / QUESTIONS (5-10):
SUCCESS CRITERIA (3-5):
DECISION FRAME:
EVIDENCE SNAPSHOT:
`.trim(),
      },
    ],
  });

  return response.output_text?.trim() ?? "";
}
