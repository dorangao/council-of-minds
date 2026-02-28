# Council of Minds

AI-powered decision system built with Next.js + TypeScript.

This app turns one question into a structured decision workflow:

1. Capture structured input (`context`, `decision criteria`, `assumptions`, `risks`)
2. Route with a high-level orchestrator (scenario detector)
3. Pull external evidence with Tavily
4. Run multi-persona advisory round + debate + red team
5. Consolidate into recommendation, scorecard, memo, confidence, and uncertainties
6. Export a Markdown decision log
7. Generate a comparison-ready analysis record (Council vs Real decision)

## Stack

- Next.js (App Router), TypeScript
- OpenAI Responses API
- LangGraph (`@langchain/langgraph`) for orchestration
- Tavily Search API for external research grounding

## Environment Variables

Create `.env.local`:

```bash
OPENAI_API_KEY=your_openai_key
TAVILY_API_KEY=your_tavily_key
```

`TAVILY_API_KEY` is optional, but strongly recommended for evidence-backed outputs.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API

- `POST /api/meeting`
  - Input:
    - `question` (required)
    - `context` (optional)
    - `decisionCriteria` (optional)
    - `assumptions` (optional)
    - `risks` (optional)
  - Returns:
    - `scenario` routing decision
    - `research` (Tavily snapshot)
    - `brief`
    - `meeting` advisor outputs
    - `unified` moderator output
    - `confidenceScore`
    - `keyUncertainties`

- `POST /api/decision-log`
  - Input: meeting payload
  - Returns: downloadable Markdown memo (`.md`)

- `POST /api/analysis-record`
  - Input: meeting payload + optional `realDecision`, `evidenceNotes`, `decisionId`
  - Returns: downloadable markdown analysis record (`.md`) for decision-quality comparison

## Architecture

High-level architecture is documented in:

- [docs/ARCHITECTURE.md](/Users/dorangao/study/council-of-minds/docs/ARCHITECTURE.md)

## Key Files

- [lib/meeting.ts](/Users/dorangao/study/council-of-minds/lib/meeting.ts): LangGraph workflow
- [lib/orchestrator.ts](/Users/dorangao/study/council-of-minds/lib/orchestrator.ts): scenario detector + prompt routing
- [lib/research.ts](/Users/dorangao/study/council-of-minds/lib/research.ts): Tavily integration
- [lib/prep.ts](/Users/dorangao/study/council-of-minds/lib/prep.ts): decision brief extractor
- [lib/consolidate.ts](/Users/dorangao/study/council-of-minds/lib/consolidate.ts): moderator synthesis
- [lib/analysis-record.ts](/Users/dorangao/study/council-of-minds/lib/analysis-record.ts): council vs real-world analysis generation
- [app/page.tsx](/Users/dorangao/study/council-of-minds/app/page.tsx): structured input UI

## Repository Structure

- [decisions](/Users/dorangao/study/council-of-minds/decisions): normalized decision baselines
- [records](/Users/dorangao/study/council-of-minds/records): analysis outputs and comparisons
- [evidence](/Users/dorangao/study/council-of-minds/evidence): source artifacts for validation
