import { getOpenAIClient } from "@/lib/openai";
import { MODELS } from "@/lib/config";
import { personas } from "@/lib/personas";
import { prepareBrief } from "@/lib/prep";

export type MeetingInput = {
  question: string;
  context?: string;
};

export type PersonaResult = {
  id: string;
  name: string;
  lens: string;
  answer: string;
  critique?: string;
};

async function personaAnswer(
  prompt: string,
  brief: string,
  question: string,
  context?: string,
): Promise<string> {
  const openai = getOpenAIClient();
  const response = await openai.responses.create({
    model: MODELS.mini,
    input: [
      { role: "system", content: prompt },
      {
        role: "user",
        content: `
Decision Brief:
${brief}

Question:
${question}

Context:
${context ?? "(none)"}

Respond with:
1) Key insight (1-2 lines)
2) Recommended approach (bullets)
3) Risks / tradeoffs (bullets)
4) Next 3 actions (numbered)
`.trim(),
      },
    ],
  });

  return response.output_text?.trim() ?? "";
}

async function personaCritique(
  prompt: string,
  brief: string,
  question: string,
  context: string | undefined,
  others: { name: string; lens: string; answer: string }[],
): Promise<string> {
  const openai = getOpenAIClient();
  const transcript = others
    .map((other) => `## ${other.name}\nLens: ${other.lens}\n${other.answer}`)
    .join("\n\n");

  const response = await openai.responses.create({
    model: MODELS.mini,
    input: [
      { role: "system", content: prompt },
      {
        role: "user",
        content: `
Decision Brief:
${brief}

Question:
${question}

Context:
${context ?? "(none)"}

Other advisors' answers:
${transcript}

Now critique them from your lens:
- What is missing?
- What is risky or naive?
- What would you change?
- What is the single most important correction?

Output:
1) Critique bullets (5-8 bullets max)
2) One correction (1 paragraph)
`.trim(),
      },
    ],
  });

  return response.output_text?.trim() ?? "";
}

export async function runMeeting(
  input: MeetingInput,
): Promise<{ brief: string; results: PersonaResult[] }> {
  const { question, context } = input;
  const brief = await prepareBrief(question, context);

  const answers = await Promise.all(
    personas.map(async (persona) => ({
      id: persona.id,
      name: persona.name,
      lens: persona.lens,
      answer: await personaAnswer(persona.prompt, brief, question, context),
    })),
  );

  const nonContrarians = answers.filter((answer) => answer.id !== "contrarian");
  const contrarian = answers.find((answer) => answer.id === "contrarian");

  const critiquesNonContrarian: PersonaResult[] = await Promise.all(
    nonContrarians.map(async (result) => {
      const persona = personas.find((item) => item.id === result.id)!;
      const others = answers.filter((item) => item.id !== result.id);
      const critique = await personaCritique(persona.prompt, brief, question, context, others);

      return { ...result, critique };
    }),
  );

  let contrarianWithCritique: PersonaResult | null = null;

  if (contrarian) {
    const persona = personas.find((item) => item.id === "contrarian");

    if (persona) {
      const othersPlus = critiquesNonContrarian.map(({ name, lens, answer, critique }) => ({
        name,
        lens,
        answer: `${answer}\n\nCritique:\n${critique ?? ""}`.trim(),
      }));

      const critique = await personaCritique(persona.prompt, brief, question, context, othersPlus);
      contrarianWithCritique = { ...contrarian, critique };
    }
  }

  return {
    brief,
    results: contrarianWithCritique
      ? [...critiquesNonContrarian, contrarianWithCritique]
      : critiquesNonContrarian,
  };
}
