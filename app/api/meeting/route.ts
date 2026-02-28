import { runMeeting } from "@/lib/meeting";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type MeetingRequestBody = {
  question?: unknown;
  context?: unknown;
  decisionCriteria?: unknown;
  assumptions?: unknown;
  risks?: unknown;
};

function readOptionalText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as MeetingRequestBody;
    const question = readOptionalText(body.question) ?? "";
    const context = readOptionalText(body.context);
    const decisionCriteria = readOptionalText(body.decisionCriteria);
    const assumptions = readOptionalText(body.assumptions);
    const risks = readOptionalText(body.risks);

    if (!question) {
      return NextResponse.json({ error: "Missing question" }, { status: 400 });
    }

    const { brief, results, unified, confidenceScore, keyUncertainties, scenario, research } =
      await runMeeting({
        question,
        context,
        decisionCriteria,
        assumptions,
        risks,
      });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      question,
      context: context ?? null,
      decisionCriteria: decisionCriteria ?? null,
      assumptions: assumptions ?? null,
      risks: risks ?? null,
      scenario,
      research,
      brief,
      meeting: results,
      unified,
      confidenceScore,
      keyUncertainties,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to run meeting.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
