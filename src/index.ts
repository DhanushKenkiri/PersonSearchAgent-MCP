#!/usr/bin/env node
/**
 * person-search-mcp
 *
 * A Model Context Protocol (MCP) server — and a tiny CLI — that researches a
 * real person from public web sources and returns a cited briefing you can act
 * on or feed to an LLM.
 *
 * It is a thin, generic client over the public PersonSearch "Deep Search"
 * agent: one tool, `search_person`, POSTs to the hosted research API and
 * returns the briefing markdown plus its numbered sources. No API key needed.
 *
 * The backend is configurable via PERSON_SEARCH_API_URL (default: the hosted
 * service), so the exact same server also works against a self-hosted
 * deployment of the agent.
 *
 *   Run as an MCP server (stdio):   person-search-mcp
 *   Run a one-shot CLI query:       person-search-mcp search "<name>" "<profile_url>" ["<context>"]
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const VERSION = "1.0.0";
const API_BASE = (process.env.PERSON_SEARCH_API_URL || "https://mvp.actualte.tech").replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = Number(process.env.PERSON_SEARCH_TIMEOUT_MS) || 180_000;

// ---- shape of the research API response (only the fields we use) ----
interface ResearchSource {
  title?: string;
  url: string;
  type?: string;
  snippet?: string;
}
interface ResearchProfile {
  name: string;
  briefing: string;
  sources?: ResearchSource[];
  searchMeta?: { evidenceQuality?: "rich" | "thin" | "empty" };
}
interface ResearchResponse {
  success?: boolean;
  error?: string;
  profile?: ResearchProfile;
  contextString?: string;
}

const inputShape = {
  name: z
    .string()
    .min(1)
    .describe('Full name of the person to research, e.g. "Paul Graham".'),
  profile_url: z
    .string()
    .url()
    .describe(
      "A public profile link for the person (LinkedIn, personal site, GitHub, X, etc.). Required — it anchors the research to the right individual."
    ),
  context: z
    .string()
    .optional()
    .describe('Optional extra context such as a role or company, e.g. "Founder, Acme". Improves disambiguation.'),
  force_refresh: z
    .boolean()
    .optional()
    .describe("Bypass any cached result and re-run the research from scratch."),
};

type SearchArgs = {
  name: string;
  profile_url: string;
  context?: string;
  force_refresh?: boolean;
};

/** Call the public research API and return its parsed response (or throw). */
async function researchPerson(args: SearchArgs): Promise<ResearchResponse> {
  const contextParts = [args.context, args.profile_url].map((s) => (s || "").trim()).filter(Boolean);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/api/research`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        personaName: args.name,
        context: contextParts.join(" | "),
        forceRefresh: args.force_refresh === true,
      }),
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as ResearchResponse;
    if (!res.ok || data.error || data.success === false) {
      throw new Error(data.error || `Research API returned HTTP ${res.status}`);
    }
    if (!data.profile) throw new Error("Research API returned no profile.");
    return data;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Research timed out after ${Math.round(REQUEST_TIMEOUT_MS / 1000)}s.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Render a research response as a single markdown string. */
function formatBriefing(data: ResearchResponse): string {
  const p = data.profile;
  if (!p) return "No profile returned.";
  const out: string[] = [p.briefing?.trim() || "(empty briefing)"];
  const sources = p.sources ?? [];
  if (sources.length) {
    out.push("\n## Sources");
    sources.forEach((s, i) => out.push(`${i + 1}. ${s.title?.trim() || s.url} — ${s.url}`));
  }
  const eq = p.searchMeta?.evidenceQuality;
  if (eq && eq !== "rich") {
    out.push(
      `\n> Evidence quality: **${eq}**. Public coverage was limited — treat sparse sections as "not found", not as fact.`
    );
  }
  return out.join("\n");
}

/** Build the MCP server with the single `search_person` tool. */
function buildServer(): McpServer {
  const server = new McpServer({ name: "person-search", version: VERSION });

  server.registerTool(
    "search_person",
    {
      title: "Search / research a person",
      description:
        "Research a real person from public web sources and return a cited briefing. " +
        "Provide the person's name plus a public profile link (LinkedIn, personal site, GitHub, X, …). " +
        "Returns a structured markdown report — current role, background, online presence, notable quotes — " +
        "with numbered sources. Works best for people with a real public footprint; for very common names or " +
        "thin online presence the report is honest about gaps rather than inventing facts.",
      inputSchema: inputShape,
    },
    async (args: SearchArgs) => {
      try {
        const data = await researchPerson(args);
        return { content: [{ type: "text" as const, text: formatBriefing(data) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Person research failed: ${message}` }], isError: true };
      }
    }
  );

  return server;
}

/** One-shot CLI: person-search-mcp search "<name>" "<profile_url>" ["<context>"] */
async function runCli(rest: string[]): Promise<void> {
  const [name, profileUrl, context] = rest;
  if (!name || !profileUrl) {
    console.error('Usage: person-search-mcp search "<name>" "<profile_url>" ["<context>"]');
    process.exit(2);
  }
  const data = await researchPerson({ name, profile_url: profileUrl, context });
  console.log(formatBriefing(data));
}

async function main(): Promise<void> {
  const [, , cmd, ...rest] = process.argv;
  if (cmd === "search") {
    await runCli(rest);
    return;
  }
  await buildServer().connect(new StdioServerTransport());
  // The stdio server now runs until the MCP client disconnects.
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack || err.message : String(err));
  process.exit(1);
});
