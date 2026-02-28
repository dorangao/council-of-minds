import type { ResearchResult } from "@/lib/types";

type TavilyResponse = {
  answer?: string;
  results?: {
    title?: string;
    url?: string;
    content?: string;
    score?: number;
  }[];
};

function toExcerpt(value: string | undefined): string {
  if (!value) {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, 420);
}

export function hasTavilyKey(): boolean {
  return Boolean(process.env.TAVILY_API_KEY);
}

export async function runTavilySearch(queries: string[]): Promise<ResearchResult[]> {
  const key = process.env.TAVILY_API_KEY;

  if (!key) {
    return [];
  }

  const uniqueQueries = queries
    .map((query) => query.trim())
    .filter((query, index, array) => query.length > 0 && array.indexOf(query) === index)
    .slice(0, 4);

  const results = await Promise.all(
    uniqueQueries.map(async (query): Promise<ResearchResult> => {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: key,
          query,
          max_results: 4,
          search_depth: "advanced",
          include_answer: true,
          include_raw_content: false,
        }),
      });

      if (!response.ok) {
        return { query, answer: "Search request failed.", results: [] };
      }

      const payload = (await response.json()) as TavilyResponse;
      const items =
        payload.results?.flatMap((entry) => {
          const title = entry.title?.trim();
          const url = entry.url?.trim();
          const content = toExcerpt(entry.content);

          if (!title || !url || !content) {
            return [];
          }

          return [{ title, url, content, score: entry.score }];
        }) ?? [];

      return {
        query,
        answer: payload.answer?.trim(),
        results: items,
      };
    }),
  );

  return results;
}

export function formatResearchForPrompt(research: ResearchResult[]): string {
  if (research.length === 0) {
    return "(No external research available.)";
  }

  return research
    .map((entry) => {
      const snippets =
        entry.results.length > 0
          ? entry.results
              .map(
                (item, index) =>
                  `${index + 1}. ${item.title}\nURL: ${item.url}\nSnippet: ${item.content}`,
              )
              .join("\n\n")
          : "(No results)";

      return `
Query: ${entry.query}
Answer: ${entry.answer ?? "(none)"}
Results:
${snippets}
`.trim();
    })
    .join("\n\n");
}
