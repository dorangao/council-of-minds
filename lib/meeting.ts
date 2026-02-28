import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { MODELS } from "@/lib/config";
import { consolidate, extractConfidenceScore, extractKeyUncertainties } from "@/lib/consolidate";
import { getOpenAIClient } from "@/lib/openai";
import { detectScenarioPlan } from "@/lib/orchestrator";
import { personas } from "@/lib/personas";
import { prepareBrief } from "@/lib/prep";
import { formatResearchForPrompt, runTavilySearch } from "@/lib/research";
import type {
  MeetingInput,
  MeetingRunResult,
  PersonaResult,
  ResearchResult,
  ScenarioPlan,
} from "@/lib/types";

const DEFAULT_SCENARIO: ScenarioPlan = {
  type: "general_decision",
  rationale: "Default routing fallback.",
  advisorAddendum:
    "Focus on concrete tradeoffs, explicit assumptions, and execution constraints. Avoid generic advice.",
  moderatorAddendum:
    "Deliver an executable plan with clear tradeoffs and uncertainty handling.",
  suggestedQueries: [
    "decision framework under uncertainty",
    "strategic tradeoff scorecard examples",
    "red team checklist for executive decisions",
  ],
};

function renderStructuredInput(input: MeetingInput): string {
  return `
Question:
${input.question}

Context (facts):
${input.context ?? "(none)"}

Decision Criteria:
${input.decisionCriteria ?? "(none)"}

Assumptions:
${input.assumptions ?? "(none)"}

Risks:
${input.risks ?? "(none)"}
`.trim();
}

async function personaAnswer(params: {
  personaPrompt: string;
  scenario: ScenarioPlan;
  input: MeetingInput;
  brief: string;
  research: ResearchResult[];
}): Promise<string> {
  const { personaPrompt, scenario, input, brief, research } = params;
  const openai = getOpenAIClient();

  const response = await openai.responses.create({
    model: MODELS.mini,
    input: [
      {
        role: "system",
        content: `${personaPrompt}\n\nScenario guidance:\n${scenario.advisorAddendum}`,
      },
      {
        role: "user",
        content: `
Structured Input:
${renderStructuredInput(input)}

Decision Brief:
${brief}

External Research:
${formatResearchForPrompt(research)}

Respond with:
1) Key insight (1-2 lines)
2) Recommended approach (bullets)
3) Risks / tradeoffs (bullets)
4) Next 3 actions (numbered)
5) Evidence used (URLs or "none")
`.trim(),
      },
    ],
  });

  return response.output_text?.trim() ?? "";
}

async function personaCritique(params: {
  personaPrompt: string;
  scenario: ScenarioPlan;
  input: MeetingInput;
  brief: string;
  others: { name: string; lens: string; answer: string }[];
}): Promise<string> {
  const { personaPrompt, scenario, input, brief, others } = params;
  const openai = getOpenAIClient();

  const transcript = others
    .map((other) => `## ${other.name}\nLens: ${other.lens}\n${other.answer}`)
    .join("\n\n");

  const response = await openai.responses.create({
    model: MODELS.mini,
    input: [
      {
        role: "system",
        content: `${personaPrompt}\n\nScenario guidance:\n${scenario.advisorAddendum}`,
      },
      {
        role: "user",
        content: `
Structured Input:
${renderStructuredInput(input)}

Decision Brief:
${brief}

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

const CouncilState = Annotation.Root({
  input: Annotation<MeetingInput>(),
  scenario: Annotation<ScenarioPlan | null>(),
  research: Annotation<ResearchResult[] | null>(),
  brief: Annotation<string | null>(),
  answers: Annotation<PersonaResult[] | null>(),
  results: Annotation<PersonaResult[] | null>(),
  unified: Annotation<string | null>(),
  confidenceScore: Annotation<string | null>(),
  keyUncertainties: Annotation<string[] | null>(),
});

const graph = new StateGraph(CouncilState)
  .addNode("detect_scenario", async (state) => {
    const scenario = await detectScenarioPlan(state.input);
    return { scenario };
  })
  .addNode("run_research", async (state) => {
    const scenario = state.scenario ?? DEFAULT_SCENARIO;
    const research = await runTavilySearch(scenario.suggestedQueries);
    return { research };
  })
  .addNode("prepare_brief", async (state) => {
    const scenario = state.scenario ?? DEFAULT_SCENARIO;
    const research = state.research ?? [];
    const brief = await prepareBrief({ input: state.input, scenario, research });
    return { brief };
  })
  .addNode("advisor_answers", async (state) => {
    const scenario = state.scenario ?? DEFAULT_SCENARIO;
    const brief = state.brief ?? "";
    const research = state.research ?? [];

    const answers = await Promise.all(
      personas.map(async (persona) => ({
        id: persona.id,
        name: persona.name,
        lens: persona.lens,
        answer: await personaAnswer({
          personaPrompt: persona.prompt,
          scenario,
          input: state.input,
          brief,
          research,
        }),
      })),
    );

    return { answers };
  })
  .addNode("debate_round", async (state) => {
    const scenario = state.scenario ?? DEFAULT_SCENARIO;
    const brief = state.brief ?? "";
    const answers = state.answers ?? [];
    const nonContrarians = answers.filter((answer) => answer.id !== "contrarian");

    const debated: PersonaResult[] = await Promise.all(
      nonContrarians.map(async (result) => {
        const persona = personas.find((item) => item.id === result.id)!;
        const others = answers.filter((item) => item.id !== result.id);

        const critique = await personaCritique({
          personaPrompt: persona.prompt,
          scenario,
          input: state.input,
          brief,
          others,
        });

        return { ...result, critique };
      }),
    );

    return { results: debated };
  })
  .addNode("contrarian_round", async (state) => {
    const scenario = state.scenario ?? DEFAULT_SCENARIO;
    const brief = state.brief ?? "";
    const answers = state.answers ?? [];
    const existingResults = state.results ?? [];
    const contrarian = answers.find((answer) => answer.id === "contrarian");

    if (!contrarian) {
      return {};
    }

    const contrarianPersona = personas.find((item) => item.id === "contrarian");
    if (!contrarianPersona) {
      return {};
    }

    const others = existingResults.map(({ name, lens, answer, critique }) => ({
      name,
      lens,
      answer: `${answer}\n\nCritique:\n${critique ?? "(none)"}`.trim(),
    }));

    const critique = await personaCritique({
      personaPrompt: contrarianPersona.prompt,
      scenario,
      input: state.input,
      brief,
      others,
    });

    return { results: [...existingResults, { ...contrarian, critique }] };
  })
  .addNode("consolidate", async (state) => {
    const scenario = state.scenario ?? DEFAULT_SCENARIO;
    const research = state.research ?? [];
    const brief = state.brief ?? "";
    const results = state.results ?? [];

    const unified = await consolidate({
      input: state.input,
      brief,
      results,
      scenario,
      research,
    });

    return {
      unified,
      confidenceScore: extractConfidenceScore(unified),
      keyUncertainties: extractKeyUncertainties(unified),
    };
  })
  .addEdge(START, "detect_scenario")
  .addEdge("detect_scenario", "run_research")
  .addEdge("run_research", "prepare_brief")
  .addEdge("prepare_brief", "advisor_answers")
  .addEdge("advisor_answers", "debate_round")
  .addEdge("debate_round", "contrarian_round")
  .addEdge("contrarian_round", "consolidate")
  .addEdge("consolidate", END)
  .compile();

export async function runMeeting(input: MeetingInput): Promise<MeetingRunResult> {
  const state = await graph.invoke({
    input,
    scenario: null,
    research: null,
    brief: null,
    answers: null,
    results: null,
    unified: null,
    confidenceScore: null,
    keyUncertainties: null,
  });

  return {
    brief: state.brief ?? "",
    results: state.results ?? [],
    unified: state.unified ?? "",
    confidenceScore: state.confidenceScore ?? "Unknown",
    keyUncertainties: state.keyUncertainties ?? [],
    scenario: state.scenario ?? DEFAULT_SCENARIO,
    research: state.research ?? [],
  };
}
