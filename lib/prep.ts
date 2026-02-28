import { getOpenAIClient } from "@/lib/openai";
import { MODELS } from "@/lib/config";

export async function prepareBrief(question: string, context?: string): Promise<string> {
  const openai = getOpenAIClient();
  const response = await openai.responses.create({
    model: MODELS.mini,
    input: [
      {
        role: "system",
        content:
          "You are a decision-brief extractor. Be crisp and specific. If unknown, label it as Unknown.",
      },
      {
        role: "user",
        content: `
Question:
${question}

Context:
${context ?? "(none)"}

Return exactly these sections:

GOAL:
CONSTRAINTS:
ASSUMPTIONS (5-10):
UNKNOWNS / QUESTIONS (5-10):
SUCCESS CRITERIA (3-5):
`.trim(),
      },
    ],
  });

  return response.output_text?.trim() ?? "";
}
