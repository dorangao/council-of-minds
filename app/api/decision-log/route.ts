import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PersonaResult = {
  id: string;
  name: string;
  lens: string;
  answer: string;
  critique?: string;
};

type ScenarioPlan = {
  type?: string;
  rationale?: string;
};

type ResearchResult = {
  query?: string;
  answer?: string;
  results?: {
    title?: string;
    url?: string;
    content?: string;
    score?: number;
  }[];
};

type DecisionLogRequest = {
  question?: unknown;
  context?: unknown;
  decisionCriteria?: unknown;
  assumptions?: unknown;
  risks?: unknown;
  scenario?: unknown;
  research?: unknown;
  brief?: unknown;
  meeting?: unknown;
  unified?: unknown;
  confidenceScore?: unknown;
  keyUncertainties?: unknown;
  generatedAt?: unknown;
};

function toOptionalText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toMeeting(value: unknown): PersonaResult[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const candidate = entry as Record<string, unknown>;
    const id = toOptionalText(candidate.id);
    const name = toOptionalText(candidate.name);
    const lens = toOptionalText(candidate.lens);
    const answer = toOptionalText(candidate.answer);
    const critique = toOptionalText(candidate.critique);

    if (!name || !lens || !answer) {
      return [];
    }

    return [
      {
        id: id ?? name.toLowerCase().replace(/\s+/g, "-"),
        name,
        lens,
        answer,
        critique,
      },
    ];
  });
}

function toScenario(value: unknown): ScenarioPlan | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  return {
    type: toOptionalText(candidate.type),
    rationale: toOptionalText(candidate.rationale),
  };
}

function toResearch(value: unknown): ResearchResult[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const candidate = entry as Record<string, unknown>;
    const query = toOptionalText(candidate.query);
    if (!query) {
      return [];
    }

    const answer = toOptionalText(candidate.answer);
    const results = Array.isArray(candidate.results)
      ? candidate.results.flatMap((result) => {
          if (!result || typeof result !== "object") {
            return [];
          }

          const row = result as Record<string, unknown>;
          const title = toOptionalText(row.title);
          const url = toOptionalText(row.url);
          const content = toOptionalText(row.content);
          const score = typeof row.score === "number" ? row.score : undefined;

          if (!title || !url || !content) {
            return [];
          }

          return [{ title, url, content, score }];
        })
      : [];

    return [{ query, answer, results }];
  });
}

function toTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap((entry) => (typeof entry === "string" ? [entry.trim()] : []))
    .filter((entry) => entry.length > 0);
}

function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug.length > 0 ? slug.slice(0, 48) : "decision-log";
}

function extractExecutiveSummary(unified: string): string {
  const lines = unified
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);

  if (lines.length === 0) {
    return "_Moderator output unavailable._";
  }

  return lines.join("\n");
}

function buildMarkdown(payload: {
  question: string;
  context?: string;
  decisionCriteria?: string;
  assumptions?: string;
  risks?: string;
  scenario: ScenarioPlan | null;
  research: ResearchResult[];
  brief?: string;
  meeting: PersonaResult[];
  unified?: string;
  confidenceScore?: string;
  keyUncertainties: string[];
  generatedAt: string;
}): string {
  const advisorSection =
    payload.meeting.length > 0
      ? payload.meeting
          .map(
            (advisor) => `
### ${advisor.name} (${advisor.lens})

#### Answer
${advisor.answer}

#### Critique
${advisor.critique ?? "(none)"}
`.trim(),
          )
          .join("\n\n")
      : "_No advisor output._";

  const researchSection =
    payload.research.length > 0
      ? payload.research
          .map((entry) => {
            const list =
              entry.results && entry.results.length > 0
                ? entry.results
                    .map(
                      (result, index) =>
                        `${index + 1}. [${result.title}](${result.url})\n   - ${result.content}`,
                    )
                    .join("\n")
                : "_No source results._";

            return `
### Query: ${entry.query}
Summary: ${entry.answer ?? "(none)"}

${list}
`.trim();
          })
          .join("\n\n")
      : "_No external research was attached._";

  const uncertaintySection =
    payload.keyUncertainties.length > 0
      ? payload.keyUncertainties.map((item) => `- ${item}`).join("\n")
      : "_None captured._";

  const unified = payload.unified ?? "";
  const executiveSummary = extractExecutiveSummary(unified);

  return `
# Council of Minds - Decision Log

Generated: ${payload.generatedAt}

## Executive Summary

Question: ${payload.question}

${executiveSummary}

Confidence: ${payload.confidenceScore ?? "Unknown"}

## Key Uncertainties

${uncertaintySection}

---

## Structured Input

### Question
${payload.question}

### Context (Facts)
${payload.context ?? "(none)"}

### Decision Criteria
${payload.decisionCriteria ?? "(none)"}

### Assumptions
${payload.assumptions ?? "(none)"}

### Risks
${payload.risks ?? "(none)"}

## Orchestrator Routing

Scenario type: ${payload.scenario?.type ?? "(none)"}

Rationale: ${payload.scenario?.rationale ?? "(none)"}

## Research Snapshot

${researchSection}

## Decision Brief

${payload.brief ?? "(none)"}

## Advisor Round

${advisorSection}

## Moderator Output

${unified || "(none)"}
`.trim();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DecisionLogRequest;
    const question = toOptionalText(body.question);

    if (!question) {
      return NextResponse.json({ error: "Missing question" }, { status: 400 });
    }

    const payload = {
      question,
      context: toOptionalText(body.context),
      decisionCriteria: toOptionalText(body.decisionCriteria),
      assumptions: toOptionalText(body.assumptions),
      risks: toOptionalText(body.risks),
      scenario: toScenario(body.scenario),
      research: toResearch(body.research),
      brief: toOptionalText(body.brief),
      meeting: toMeeting(body.meeting),
      unified: toOptionalText(body.unified),
      confidenceScore: toOptionalText(body.confidenceScore),
      keyUncertainties: toTextArray(body.keyUncertainties),
      generatedAt: toOptionalText(body.generatedAt) ?? new Date().toISOString(),
    };

    const markdown = buildMarkdown(payload);
    const filename = `${slugify(question)}-${payload.generatedAt.slice(0, 10)}.md`;

    return new Response(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build decision log.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
