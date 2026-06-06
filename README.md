# person-search-mcp

An [MCP](https://modelcontextprotocol.io) server that **researches a real person from public web sources and returns a cited briefing** — drop it into any MCP-capable agent (Claude Desktop, Cursor, Cline, Windsurf, OpenClaw, …) and your agent gains a `search_person` tool.

It's a thin, generic wrapper over the public **PersonSearch "Deep Search"** agent. Give it a name and a public profile link; it runs federated web research and returns a structured, **source-cited** markdown report (current role, background, online presence, notable quotes). No API key required.

```
You:    Research Paul Graham (https://x.com/paulg) before my call.
Agent:  → calls search_person → returns a cited briefing with numbered sources.
```

---

## The tool

**`search_person`**

| Argument | Required | Description |
| --- | --- | --- |
| `name` | yes | Full name, e.g. `"Paul Graham"`. |
| `profile_url` | yes | A public profile link (LinkedIn, personal site, GitHub, X, …). Anchors the research to the right individual. |
| `context` | no | Extra disambiguating context, e.g. `"Founder, Acme"`. |
| `force_refresh` | no | Re-run from scratch, bypassing any cached result. |

Returns the briefing markdown followed by a numbered **Sources** list. For people with little public presence it reports gaps honestly instead of inventing facts (and flags low evidence quality).

---

## Quick start

Requires Node.js ≥ 18.

### Run it in an MCP client

Add the server to your client's MCP config — `npx` fetches it, no clone or global install needed:

```jsonc
{
  "mcpServers": {
    "person-search": {
      "command": "npx",
      "args": ["-y", "@actualte/person-search-mcp"]
    }
  }
}
```

(You can also run it straight from source with `["-y", "github:DhanushKenkiri/PersonSearchAgent-MCP"]`.)

Config file locations:
- **Claude Desktop** — `claude_desktop_config.json` (`mcpServers` key)
- **Cursor** — `.cursor/mcp.json`
- **Cline / Windsurf / others** — their MCP settings JSON (same shape)

### Or run from a clone

```bash
git clone https://github.com/DhanushKenkiri/PersonSearchAgent-MCP.git
cd PersonSearchAgent-MCP
npm install        # builds automatically via the prepare script
node dist/index.js # starts the MCP server on stdio
```

Then point your client's `command`/`args` at `node` + the absolute path to `dist/index.js`.

### Try it without an MCP client (CLI)

```bash
npx -y @actualte/person-search-mcp search "Paul Graham" "https://x.com/paulg" "Y Combinator"
# or from a clone:
node dist/index.js search "Paul Graham" "https://x.com/paulg"
```

---

## OpenClaw

This works with [OpenClaw](https://www.npmjs.com/package/openclaw) agents too — see [`openclaw/README.md`](openclaw/README.md) for both paths:
- **MCP** — register this server through OpenClaw's built-in `mcporter` skill, or
- **Native skill** — drop the ready-made [`person-search` skill](openclaw/skills/person-search/) into `~/.openclaw/skills/`.

---

## Configuration

| Env var | Default | Purpose |
| --- | --- | --- |
| `PERSON_SEARCH_API_URL` | `https://mvp.actualte.tech` | Base URL of the research backend. Point it at your own deployment to self-host. |
| `PERSON_SEARCH_TIMEOUT_MS` | `180000` | Per-request timeout (deep research can take 1–2 minutes). |

The default backend is the hosted, public PersonSearch agent, so the server works out of the box. It calls a single public endpoint — `POST /api/research` — and adds no auth, storage, or state of its own.

---

## Develop

```bash
npm install     # install deps + build
npm run build   # compile src/ -> dist/
npm test        # build + run the MCP protocol tests (offline, deterministic)
```

The test suite (`test/mcp.test.mjs`) launches the built server over stdio and drives it with the official MCP SDK client against a local mock backend — verifying the `initialize` handshake, `tools/list`, a successful `tools/call`, and the error path.

## Publish (maintainer)

Published as **`@actualte/person-search-mcp`**. To cut a new version:

```bash
npm version patch
npm publish --access public
```

If your npm account has **package staging** enabled, the publish lands in
npmjs.com → *Staged Packages* — promote it there to make it live.

## License

MIT © Dhanush Kenkiri
