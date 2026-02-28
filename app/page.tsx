"use client";

import { FormEvent, useState } from "react";

type PersonaResult = {
  id: string;
  name: string;
  lens: string;
  answer: string;
  critique?: string;
};

type MeetingResponse = {
  generatedAt: string;
  question: string;
  context: string | null;
  brief: string;
  meeting: PersonaResult[];
  unified: string;
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

export default function Home() {
  const [question, setQuestion] = useState("");
  const [context, setContext] = useState("");
  const [result, setResult] = useState<MeetingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

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

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">The Council of Minds</p>
        <h1>Run an AI advisory meeting before making your next big decision.</h1>
        <p className="heroText">
          Ask one question, force assumptions into the open, hear distinct advisor lenses, pressure
          test the plan with a contrarian, and export an executable decision memo.
        </p>
      </section>

      <form className="panel formPanel" onSubmit={runCouncil}>
        <label className="field">
          <span>Decision question</span>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Should I build local inference now or use cloud APIs first?"
            rows={4}
            required
          />
        </label>

        <label className="field">
          <span>Context (optional)</span>
          <textarea
            value={context}
            onChange={(event) => setContext(event.target.value)}
            placeholder="Solo dev, limited budget, must ship fast, long-term cost matters."
            rows={4}
          />
        </label>

        <div className="actionRow">
          <button type="submit" disabled={isRunning}>
            {isRunning ? "Running Council..." : "Run the Council"}
          </button>
          <button type="button" disabled={!result || isExporting} onClick={downloadDecisionLog}>
            {isExporting ? "Preparing Markdown..." : "Download Decision Log (.md)"}
          </button>
        </div>

        {error ? <p className="errorBanner">{error}</p> : null}
      </form>

      {result ? (
        <section className="results">
          <section className="panel">
            <h2>Decision Brief</h2>
            <p className="metaLine">Generated: {new Date(result.generatedAt).toLocaleString()}</p>
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
