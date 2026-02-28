export type MeetingInput = {
  question: string;
  context?: string;
  decisionCriteria?: string;
  assumptions?: string;
  risks?: string;
};

export type PersonaResult = {
  id: string;
  name: string;
  lens: string;
  answer: string;
  critique?: string;
};

export type ScenarioType =
  | "ai_layoff_decision"
  | "build_vs_buy"
  | "product_strategy"
  | "cost_optimization"
  | "risk_compliance"
  | "general_decision";

export type ScenarioPlan = {
  type: ScenarioType;
  rationale: string;
  advisorAddendum: string;
  moderatorAddendum: string;
  suggestedQueries: string[];
};

export type ResearchResult = {
  query: string;
  answer?: string;
  results: {
    title: string;
    url: string;
    content: string;
    score?: number;
  }[];
};

export type MeetingRunResult = {
  brief: string;
  results: PersonaResult[];
  unified: string;
  confidenceScore: string;
  keyUncertainties: string[];
  scenario: ScenarioPlan;
  research: ResearchResult[];
};
