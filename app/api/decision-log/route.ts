import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PersonaResult = {
  id: string;
  name: string;
  lens: string;
  answer: string;
  critique?: string;
};

type DecisionLogRequest = {
  question?: unknown;
  context?: unknown;
  brief?: unknown;
  meeting?: unknown;
  unified?: unknown;
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
  brief?: string;
  meeting: PersonaResult[];
  unified?: string;
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

  const unified = payload.unified ?? "";
  const executiveSummary = extractExecutiveSummary(unified);

  return `
# Council of Minds - Decision Log

Generated: ${payload.generatedAt}

## Executive Summary

Question: ${payload.question}

${executiveSummary}

---

## Input

### Question
${payload.question}

### Context
${payload.context ?? "(none)"}

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
      brief: toOptionalText(body.brief),
      meeting: toMeeting(body.meeting),
      unified: toOptionalText(body.unified),
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
