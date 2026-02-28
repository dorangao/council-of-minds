import { MODELS } from "@/lib/config";
import { getOpenAIClient } from "@/lib/openai";
import type { MeetingInput, ScenarioPlan, ScenarioType } from "@/lib/types";

const SCENARIO_LIBRARY: Record<
  ScenarioType,
  { advisorAddendum: string; moderatorAddendum: string; defaultQueries: string[] }
> = {
  ai_layoff_decision: {
    advisorAddendum: `
Focus this analysis on workforce reduction decisions tied to AI productivity assumptions.
Force explicit assumptions, benchmark ranges, and operational safeguards.
`.trim(),
    moderatorAddendum: `
Include a staffing recommendation range, tripwires, and contingency actions if productivity gains do not materialize.
Call out what evidence is still missing before irreversible cuts.
`.trim(),
    defaultQueries: [
      "AI productivity benchmarks software engineering 2025 2026",
      "workforce reduction outcomes product velocity retention case study",
      "fintech company layoffs impact customer trust",
    ],
  },
  build_vs_buy: {
    advisorAddendum: `
Focus this analysis on build-vs-buy tradeoffs: speed, cost, lock-in, and long-term control.
Quantify switching costs and migration risks where possible.
`.trim(),
    moderatorAddendum: `
Recommend a staged decision path with explicit exit criteria and kill criteria.
Provide a near-term ship plan plus long-term architecture guardrails.
`.trim(),
    defaultQueries: [
      "build vs buy AI platform tradeoffs startup",
      "cloud API vs local inference cost comparison 2026",
      "vendor lock-in mitigation patterns for AI products",
    ],
  },
  product_strategy: {
    advisorAddendum: `
Focus this analysis on product narrative, user value concentration, and sequencing.
Prioritize one wedge use case and measurable adoption signals.
`.trim(),
    moderatorAddendum: `
Include a sharp product thesis, scope cuts, and user-centric success metrics.
Highlight what to postpone intentionally.
`.trim(),
    defaultQueries: [
      "product strategy prioritization framework B2B SaaS",
      "AI product adoption metrics activation retention",
      "case studies focused product wedges",
    ],
  },
  cost_optimization: {
    advisorAddendum: `
Focus this analysis on capital efficiency, unit economics, and downside control.
Differentiate reversible cost cuts from strategic capability damage.
`.trim(),
    moderatorAddendum: `
Provide a phased efficiency plan that protects core growth engines.
Include non-negotiable capabilities that must not be degraded.
`.trim(),
    defaultQueries: [
      "software cost optimization without hurting growth",
      "engineering organization efficiency benchmarks 2026",
      "operational leverage metrics technology companies",
    ],
  },
  risk_compliance: {
    advisorAddendum: `
Focus this analysis on legal, regulatory, and operational risk exposure.
Surface compliance obligations and decision gating checks.
`.trim(),
    moderatorAddendum: `
Include explicit risk controls, ownership, and sign-off checkpoints before execution.
Identify must-pass compliance gates.
`.trim(),
    defaultQueries: [
      "AI governance controls enterprise deployment",
      "fintech AI regulatory risk management",
      "model risk management framework practical checklist",
    ],
  },
  general_decision: {
    advisorAddendum: `
Focus this analysis on first-principles tradeoffs, decision quality, and execution realism.
Do not rely on generic advice.
`.trim(),
    moderatorAddendum: `
Ensure the final decision is executable, risk-aware, and time-boxed.
Preserve unresolved uncertainty as explicit follow-up work.
`.trim(),
    defaultQueries: [
      "decision quality framework uncertainty assumptions",
      "strategic decision scorecard examples",
      "red team decision review checklist",
    ],
  },
};

type ClassifierPayload = {
  scenarioType?: ScenarioType;
  rationale?: string;
  suggestedQueries?: string[];
};

function extractCompany(context?: string): string | null {
  if (!context) {
    return null;
  }

  const companyLine = context.match(/company\s*:\s*([^\n\r]+)/i);
  if (companyLine?.[1]) {
    return companyLine[1].trim();
  }

  const sentenceMatch = context.match(/\b([A-Z][a-zA-Z0-9&.\- ]{1,40})\b/);
  return sentenceMatch?.[1]?.trim() ?? null;
}

function sanitizeQueries(queries: string[] | undefined, fallback: string[]): string[] {
  const cleaned =
    queries
      ?.map((query) => query.trim())
      .filter((query, index, array) => query.length > 0 && array.indexOf(query) === index)
      .slice(0, 4) ?? [];

  if (cleaned.length > 0) {
    return cleaned;
  }

  return fallback.slice(0, 4);
}

function detectScenarioHeuristic(input: MeetingInput): ScenarioType {
  const text = [
    input.question,
    input.context ?? "",
    input.decisionCriteria ?? "",
    input.assumptions ?? "",
    input.risks ?? "",
  ]
    .join(" ")
    .toLowerCase();

  if (/(layoff|reduce workforce|headcount|restructure|org reduction)/.test(text)) {
    return "ai_layoff_decision";
  }

  if (/(build vs buy|build or buy|local inference|cloud api|vendor lock-in)/.test(text)) {
    return "build_vs_buy";
  }

  if (/(go[- ]to[- ]market|distribution|pricing|positioning|product strategy)/.test(text)) {
    return "product_strategy";
  }

  if (/(cost control|cost optimization|runway|burn|efficiency)/.test(text)) {
    return "cost_optimization";
  }

  if (/(compliance|regulatory|legal risk|policy|audit)/.test(text)) {
    return "risk_compliance";
  }

  return "general_decision";
}

function parseClassifierJson(text: string): ClassifierPayload | null {
  const trimmed = text.trim();
  const withoutCodeFence = trimmed.replace(/^```json\s*|\s*```$/g, "");

  try {
    const parsed = JSON.parse(withoutCodeFence) as ClassifierPayload;
    return parsed;
  } catch {
    return null;
  }
}

function buildScenarioPlan(
  type: ScenarioType,
  rationale: string,
  input: MeetingInput,
  suggestedQueries?: string[],
): ScenarioPlan {
  const libraryEntry = SCENARIO_LIBRARY[type];
  const company = extractCompany(input.context);
  const companyScopedQueries = company
    ? [
        `${company} latest quarterly results`,
        `${company} AI strategy productivity comments`,
        `${company} layoffs or workforce update`,
      ]
    : [];

  const queries = sanitizeQueries(
    suggestedQueries,
    [...companyScopedQueries, ...libraryEntry.defaultQueries].slice(0, 4),
  );

  return {
    type,
    rationale,
    advisorAddendum: libraryEntry.advisorAddendum,
    moderatorAddendum: libraryEntry.moderatorAddendum,
    suggestedQueries: queries,
  };
}

export async function detectScenarioPlan(input: MeetingInput): Promise<ScenarioPlan> {
  const heuristicType = detectScenarioHeuristic(input);
  const heuristicPlan = buildScenarioPlan(
    heuristicType,
    "Heuristic routing based on question and context terms.",
    input,
  );

  try {
    const openai = getOpenAIClient();
    const response = await openai.responses.create({
      model: MODELS.mini,
      input: [
        {
          role: "system",
          content: `
You are a decision-orchestration classifier.
Choose the best scenarioType for routing prompts.

Allowed scenarioType values:
- ai_layoff_decision
- build_vs_buy
- product_strategy
- cost_optimization
- risk_compliance
- general_decision

Return ONLY valid JSON:
{
  "scenarioType": "...",
  "rationale": "1-2 sentence explanation",
  "suggestedQueries": ["query 1", "query 2", "query 3"]
}
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
`.trim(),
        },
      ],
    });

    const parsed = parseClassifierJson(response.output_text ?? "");

    if (!parsed?.scenarioType || !(parsed.scenarioType in SCENARIO_LIBRARY)) {
      return heuristicPlan;
    }

    return buildScenarioPlan(
      parsed.scenarioType,
      parsed.rationale?.trim() || "LLM routing selected this scenario.",
      input,
      parsed.suggestedQueries,
    );
  } catch {
    return heuristicPlan;
  }
}
