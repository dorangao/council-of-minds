import { buildAnalysisRecord } from "@/lib/analysis-record";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type AnalysisRecordRequest = {
  question?: unknown;
  generatedAt?: unknown;
  scenario?: unknown;
  brief?: unknown;
  unified?: unknown;
  confidenceScore?: unknown;
  keyUncertainties?: unknown;
  assumptions?: unknown;
  decisionCriteria?: unknown;
  risks?: unknown;
  realDecision?: unknown;
  evidenceNotes?: unknown;
  decisionId?: unknown;
  type?: unknown;
  source?: unknown;
  status?: unknown;
};

function text(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function textArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap((item) => (typeof item === "string" ? [item.trim()] : []))
    .filter((item) => item.length > 0);
}

function safeFilename(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug.length > 0 ? slug.slice(0, 64) : "analysis-record";
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AnalysisRecordRequest;
    const scenario = body.scenario && typeof body.scenario === "object" ? body.scenario : {};
    const scenarioObject = scenario as Record<string, unknown>;

    const question = text(body.question);
    if (!question) {
      return NextResponse.json({ error: "Missing question" }, { status: 400 });
    }

    const generatedAt = text(body.generatedAt) ?? new Date().toISOString();

    const { decisionId, markdown } = await buildAnalysisRecord({
      question,
      generatedAt,
      scenarioType: text(scenarioObject.type),
      scenarioRationale: text(scenarioObject.rationale),
      brief: text(body.brief),
      unified: text(body.unified),
      confidenceScore: text(body.confidenceScore),
      keyUncertainties: textArray(body.keyUncertainties),
      assumptions: text(body.assumptions),
      decisionCriteria: text(body.decisionCriteria),
      risks: text(body.risks),
      realDecision: text(body.realDecision),
      evidenceNotes: text(body.evidenceNotes),
      decisionId: text(body.decisionId),
      type: text(body.type),
      source: text(body.source),
      status: text(body.status),
    });

    const filename = `${safeFilename(decisionId)}-analysis.md`;

    return new Response(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build analysis record.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
