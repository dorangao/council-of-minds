"use client";

import { FormEvent, useState } from "react";

type PersonaResult = {
  id: string;
  name: string;
  lens: string;
  answer: string;
  critique?: string;
};

type ScenarioPlan = {
  type: string;
  rationale: string;
  advisorAddendum: string;
  moderatorAddendum: string;
  suggestedQueries: string[];
};

type ResearchResult = {
  query: string;
  answer?: string;
  results: {
    title: string;
    url: string;
    content: string;
    score?: number;
  }[];
};

type MeetingResponse = {
  generatedAt: string;
  question: string;
  context: string | null;
  decisionCriteria: string | null;
  assumptions: string | null;
  risks: string | null;
  scenario: ScenarioPlan;
  research: ResearchResult[];
  brief: string;
  meeting: PersonaResult[];
  unified: string;
  confidenceScore: string;
  keyUncertainties: string[];
};

function formatError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Something went wrong.";
}

function parseFilename(contentDisposition: string | null): string {
  if (!contentDisposition) {
    return "decision-log.md";
  }

  const match = contentDisposition.match(/filename="?([^"]+)"?/i);
  return match?.[1] ?? "decision-log.md";
}

const BLOCK_EXAMPLE = {
  question: "Should Block reduce workforce by ~40% based on expected AI productivity gains?",
  context: `Company: Block Inc.
Industry: Fintech / Payments

Financial:
- Q4 Revenue: ~$6.25B
- Gross profit growth: +24%
- EPS growth: positive

Annual:
- Revenue growth slowing
- Profit improving

Stock:
- Volatile
- Rose after layoffs

Workforce:
- ~10,000 employees before layoffs
- ~4,000 layoffs announced

Technology:
- Heavy AI investment
- CEO states AI enables smaller teams`,
  decisionCriteria: `1) Financial impact
2) Strategic impact
3) Organizational impact
4) Market impact`,
  assumptions: `- AI productivity gain 30-50%
- Revenue growth 5-10%
- Fintech market stable`,
  risks: `- AI productivity overestimated
- Talent loss harms innovation
- Execution slowdown
- Competitor advantage
- Customer support worsens`,
  realDecision: `Strategy: immediate_large_layoff
Layoff size: ~40%
Timeline: immediate
Justification:
- AI productivity
- efficiency
- lean organization`,
  evidenceNotes: `Evidence to attach:
- Jack Dorsey letter
- Block earnings report
- Layoff coverage and market reaction`,
};

export default function Home() {
  const [question, setQuestion] = useState("");
  const [context, setContext] = useState("");
  const [decisionCriteria, setDecisionCriteria] = useState("");
  const [assumptions, setAssumptions] = useState("");
  const [risks, setRisks] = useState("");
  const [realDecision, setRealDecision] = useState("");
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [decisionId, setDecisionId] = useState("");
  const [result, setResult] = useState<MeetingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingAnalysis, setIsExportingAnalysis] = useState(false);

  const loadExample = () => {
    setQuestion(BLOCK_EXAMPLE.question);
    setContext(BLOCK_EXAMPLE.context);
    setDecisionCriteria(BLOCK_EXAMPLE.decisionCriteria);
    setAssumptions(BLOCK_EXAMPLE.assumptions);
    setRisks(BLOCK_EXAMPLE.risks);
    setRealDecision(BLOCK_EXAMPLE.realDecision);
    setEvidenceNotes(BLOCK_EXAMPLE.evidenceNotes);
    setDecisionId("block-ai-layoff-2026");
  };

  const runCouncil = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!question.trim()) {
      setError("Please provide a decision question.");
      return;
    }

    setError(null);
    setIsRunning(true);

    try {
      const response = await fetch("/api/meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          context: context.trim() || undefined,
          decisionCriteria: decisionCriteria.trim() || undefined,
          assumptions: assumptions.trim() || undefined,
          risks: risks.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as MeetingResponse | { error: string };

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Failed to run the council.");
      }

      setResult(payload);
    } catch (caught) {
      setError(formatError(caught));
    } finally {
      setIsRunning(false);
    }
  };

  const downloadDecisionLog = async () => {
    if (!result) {
      return;
    }

    setError(null);
    setIsExporting(true);

    try {
      const response = await fetch("/api/decision-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to export decision log.");
      }

      const blob = await response.blob();
      const filename = parseFilename(response.headers.get("content-disposition"));
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(formatError(caught));
    } finally {
      setIsExporting(false);
    }
  };

  const downloadAnalysisRecord = async () => {
    if (!result) {
      return;
    }

    setError(null);
    setIsExportingAnalysis(true);

    try {
      const response = await fetch("/api/analysis-record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...result,
          decisionId: decisionId.trim() || undefined,
          realDecision: realDecision.trim() || undefined,
          evidenceNotes: evidenceNotes.trim() || undefined,
          source: "council_of_minds",
          status: "simulated",
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to export analysis record.");
      }

      const blob = await response.blob();
      const filename = parseFilename(response.headers.get("content-disposition"));
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(formatError(caught));
    } finally {
      setIsExportingAnalysis(false);
    }
  };

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">The Council of Minds</p>
        <h1>Decision system with orchestration, debate, and red-team review.</h1>
        <p className="heroText">
          Separate facts from assumptions, route the question through a scenario-aware orchestrator,
          enrich with Tavily search, and produce an executable memo with confidence and uncertainties.
        </p>
      </section>

      <form className="panel formPanel" onSubmit={runCouncil}>
        <label className="field">
          <span>Decision question</span>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Should Block reduce workforce significantly based on expected AI productivity gains?"
            rows={3}
            required
          />
        </label>

        <label className="field">
          <span>Context (facts only)</span>
          <textarea
            value={context}
            onChange={(event) => setContext(event.target.value)}
            placeholder="Company, financial data, market behavior, workforce data, technology context..."
            rows={7}
          />
        </label>

        <section className="gridFields">
          <label className="field">
            <span>Decision criteria</span>
            <textarea
              value={decisionCriteria}
              onChange={(event) => setDecisionCriteria(event.target.value)}
              placeholder="Financial impact, strategic impact, organizational impact, market impact..."
              rows={5}
            />
          </label>

          <label className="field">
            <span>Assumptions</span>
            <textarea
              value={assumptions}
              onChange={(event) => setAssumptions(event.target.value)}
              placeholder="AI productivity gain 30-50%, revenue growth 5-10%, ..."
              rows={5}
            />
          </label>
        </section>

        <label className="field">
          <span>Risks</span>
          <textarea
            value={risks}
            onChange={(event) => setRisks(event.target.value)}
            placeholder="AI productivity overestimated, talent loss, execution slowdown..."
            rows={4}
          />
        </label>

        <section className="gridFields">
          <label className="field">
            <span>Real-world decision (for comparison)</span>
            <textarea
              value={realDecision}
              onChange={(event) => setRealDecision(event.target.value)}
              placeholder="What did the company actually do? timeline, magnitude, stated rationale..."
              rows={6}
            />
          </label>

          <label className="field">
            <span>Evidence notes (optional)</span>
            <textarea
              value={evidenceNotes}
              onChange={(event) => setEvidenceNotes(event.target.value)}
              placeholder="Links, earnings transcript notes, CEO letter highlights..."
              rows={6}
            />
          </label>
        </section>

        <label className="field">
          <span>Decision ID (optional, for records)</span>
          <textarea
            className="compactTextarea"
            value={decisionId}
            onChange={(event) => setDecisionId(event.target.value)}
            placeholder="block-ai-layoff-2026"
            rows={2}
          />
        </label>

        <div className="actionRow">
          <button type="submit" disabled={isRunning}>
            {isRunning ? "Running Council..." : "Run the Council"}
          </button>
          <button type="button" onClick={loadExample} disabled={isRunning}>
            Load Block Example
          </button>
          <button type="button" disabled={!result || isExporting} onClick={downloadDecisionLog}>
            {isExporting ? "Preparing Markdown..." : "Download Decision Log (.md)"}
          </button>
          <button
            type="button"
            disabled={!result || isExportingAnalysis}
            onClick={downloadAnalysisRecord}
          >
            {isExportingAnalysis
              ? "Preparing Analysis Record..."
              : "Download Analysis Record (.md)"}
          </button>
        </div>

        {error ? <p className="errorBanner">{error}</p> : null}
      </form>

      {result ? (
        <section className="results">
          <section className="panel">
            <h2>Orchestrator + Confidence</h2>
            <p className="metaLine">Generated: {new Date(result.generatedAt).toLocaleString()}</p>
            <p>
              <strong>Scenario:</strong> {result.scenario.type}
            </p>
            <p>
              <strong>Rationale:</strong> {result.scenario.rationale}
            </p>
            <p>
              <strong>Confidence:</strong> {result.confidenceScore}
            </p>
            <h4>Key uncertainties</h4>
            {result.keyUncertainties.length > 0 ? (
              <ul className="list">
                {result.keyUncertainties.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">(none returned)</p>
            )}
          </section>

          <section className="panel">
            <h2>Tavily Research Snapshot</h2>
            {result.research.length > 0 ? (
              <div className="advisorList">
                {result.research.map((entry) => (
                  <article className="advisorCard" key={entry.query}>
                    <header>
                      <h3>{entry.query}</h3>
                      <p>{entry.answer ?? "No summary returned."}</p>
                    </header>
                    {entry.results.length > 0 ? (
                      <ul className="list">
                        {entry.results.map((item) => (
                          <li key={`${entry.query}-${item.url}`}>
                            <a href={item.url} target="_blank" rel="noreferrer">
                              {item.title}
                            </a>
                            <p className="muted">{item.content}</p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted">No sources returned.</p>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted">
                No Tavily research results (check `TAVILY_API_KEY` if you expected results).
              </p>
            )}
          </section>

          <section className="panel">
            <h2>Decision Brief</h2>
            <pre>{result.brief || "(empty brief)"}</pre>
          </section>

          <section className="panel">
            <h2>Advisor Inputs + Critiques</h2>
            <div className="advisorList">
              {result.meeting.map((advisor) => (
                <article className="advisorCard" key={advisor.id}>
                  <header>
                    <h3>{advisor.name}</h3>
                    <p>{advisor.lens}</p>
                  </header>
                  <div className="advisorGrid">
                    <section>
                      <h4>Answer</h4>
                      <pre>{advisor.answer || "(empty answer)"}</pre>
                    </section>
                    <section>
                      <h4>Critique</h4>
                      <pre>{advisor.critique ?? "(no critique returned)"}</pre>
                    </section>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2>Unified Recommendation</h2>
            <pre>{result.unified || "(empty response)"}</pre>
          </section>
        </section>
      ) : null}
    </main>
  );
}
