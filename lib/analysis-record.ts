import { MODELS } from "@/lib/config";
import { getOpenAIClient } from "@/lib/openai";

export type AnalysisRecordInput = {
  question: string;
  generatedAt: string;
  scenarioType?: string;
  scenarioRationale?: string;
  brief?: string;
  unified?: string;
  confidenceScore?: string;
  keyUncertainties?: string[];
  assumptions?: string;
  decisionCriteria?: string;
  risks?: string;
  realDecision?: string;
  evidenceNotes?: string;
  decisionId?: string;
  type?: string;
  source?: string;
  status?: string;
};

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug.length > 0 ? slug : "decision";
}

function inferType(input: AnalysisRecordInput): string {
  if (input.type) {
    return input.type;
  }

  const text = [input.question, input.scenarioType ?? ""].join(" ").toLowerCase();

  if (/(layoff|workforce|headcount|org reduction)/.test(text)) {
    return "ai_productivity_layoff";
  }

  if (/(build vs buy|cloud api|local inference)/.test(text)) {
    return "build_vs_buy";
  }

  return "strategy_decision";
}

function createDecisionId(input: AnalysisRecordInput): string {
  if (input.decisionId) {
    return input.decisionId;
  }

  const date = new Date(input.generatedAt || Date.now()).toISOString().slice(0, 10);
  return `${slugify(input.question).slice(0, 36)}-${date}`;
}

function fallbackMarkdown(input: AnalysisRecordInput, decisionId: string): string {
  const uncertainties =
    input.keyUncertainties && input.keyUncertainties.length > 0
      ? input.keyUncertainties.map((item) => `- ${item}`).join("\n")
      : "- Unknown";

  return `
# Decision Analysis Record

## Reference Record

- decision_id: ${decisionId}
- type: ${inferType(input)}
- source: ${input.source ?? "council_of_minds"}
- status: ${input.status ?? "simulated"}

## Question

${input.question}

## Council Recommendation (Extracted)

${input.unified ?? "(missing council output)"}

## Real-World Decision (Ground Truth)

${input.realDecision ?? "Unknown (not provided yet)."}

## Comparison

Manual comparison pending.

## Decision Quality Evaluation

- financial_alignment: pending
- risk_management: pending
- strategic_alignment: pending
- innovation_risk: pending

## Assumption Validation Record

Assumptions input:
${input.assumptions ?? "(none)"}

## Confidence + Uncertainties

Confidence: ${input.confidenceScore ?? "Unknown"}

${uncertainties}

## Open Questions

- What assumptions are still unvalidated?
- Which KPI checkpoints should gate execution?
- What evidence would reverse the decision?
`.trim();
}

export async function buildAnalysisRecord(
  input: AnalysisRecordInput,
): Promise<{ decisionId: string; markdown: string }> {
  const decisionId = createDecisionId(input);
  const type = inferType(input);
  const source = input.source ?? "council_of_minds";
  const status = input.status ?? "simulated";

  try {
    const openai = getOpenAIClient();
    const response = await openai.responses.create({
      model: MODELS.main,
      input: [
        {
          role: "system",
          content: `
You convert council outputs into structured decision analysis records for later comparison and learning.
Keep it concrete, concise, and evaluative. Do not invent facts.
If data is missing, mark it as Unknown.
Return markdown only.
`.trim(),
        },
        {
          role: "user",
          content: `
Create a markdown record with exactly these sections:

1) # Decision Analysis Record
2) ## Reference Record
3) ## Question
4) ## Council Recommendation (Extracted)
5) ## Real-World Decision (Ground Truth)
6) ## Comparison Record
7) ## Decision Quality Evaluation
8) ## Assumption Validation Record
9) ## Council Strengths
10) ## Real Decision Strengths
11) ## Council Weaknesses
12) ## Real Decision Weaknesses
13) ## Open Questions
14) ## Evidence Notes

In "Comparison Record", include a YAML block with:
- decision_id
- council (recommendation, risk_level, timeline)
- real_world (recommendation, risk_level, timeline)
- alignment (direction, confidence_gap)

In "Decision Quality Evaluation", include:
- financial_alignment
- risk_management
- strategic_alignment
- innovation_risk
with "council", "real", and "reason".

Reference metadata:
- decision_id: ${decisionId}
- type: ${type}
- source: ${source}
- status: ${status}
- generated_at: ${input.generatedAt}

Question:
${input.question}

Scenario:
- type: ${input.scenarioType ?? "Unknown"}
- rationale: ${input.scenarioRationale ?? "Unknown"}

Council brief:
${input.brief ?? "(none)"}

Council recommendation text:
${input.unified ?? "(none)"}

Council confidence:
${input.confidenceScore ?? "Unknown"}

Council key uncertainties:
${input.keyUncertainties?.map((item) => `- ${item}`).join("\n") ?? "(none)"}

Decision criteria:
${input.decisionCriteria ?? "(none)"}

Assumptions:
${input.assumptions ?? "(none)"}

Risks:
${input.risks ?? "(none)"}

Real-world decision:
${input.realDecision ?? "Unknown"}

Evidence notes:
${input.evidenceNotes ?? "Unknown"}
`.trim(),
        },
      ],
    });

    const markdown = response.output_text?.trim();
    if (markdown) {
      return { decisionId, markdown };
    }
  } catch {
    // Fall through to deterministic fallback.
  }

  return { decisionId, markdown: fallbackMarkdown(input, decisionId) };
}
