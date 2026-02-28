import { consolidate } from "@/lib/consolidate";
import { runMeeting } from "@/lib/meeting";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type MeetingRequestBody = {
  question?: unknown;
  context?: unknown;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as MeetingRequestBody;
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const context =
      typeof body.context === "string" && body.context.trim().length > 0
        ? body.context.trim()
        : undefined;

    if (!question) {
      return NextResponse.json({ error: "Missing question" }, { status: 400 });
    }

    const { brief, results } = await runMeeting({ question, context });
    const unified = await consolidate({ question, context, brief, results });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      question,
      context: context ?? null,
      brief,
      meeting: results,
      unified,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to run meeting.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
