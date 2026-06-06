# Using person-search with OpenClaw

[OpenClaw](https://www.npmjs.com/package/openclaw) agents can use this person-research capability two ways. Pick one.

---

## Option A — MCP (recommended)

OpenClaw imports standard MCP servers through its built-in **`mcporter`** skill. That means the exact same server documented in the [main README](../README.md) works inside OpenClaw, with the standard launch spec:

```
command: npx
args:    ["-y", "github:DhanushKenkiri/PersonSearchAgent-MCP"]
         (after npm publish: ["-y", "person-search-mcp"])
```

Steps:

1. Enable the `mcporter` skill (Control UI → Skills, or `openclaw config patch`).
2. Register the server above through mcporter (it manages MCP servers and exposes their tools to the agent).
3. The agent now has the `search_person` tool.

This path is fully covered by the project's automated MCP tests.

---

## Option B — Native OpenClaw skill (no MCP)

A ready-made skill lives in [`skills/person-search/`](skills/person-search/). It's self-contained — it just shells out to this package's CLI, so there's nothing else to configure.

**Install (one time):**

```bash
# 1. Copy the skill into your OpenClaw skills directory
cp -r skills/person-search ~/.openclaw/skills/

# 2. Make the CLI available (fast path — install once, globally)
npm install -g github:DhanushKenkiri/PersonSearchAgent-MCP
#   (after npm publish:  npm install -g person-search-mcp)

# 3. Enable the skill
openclaw config patch  # set skills.entries.person-search.enabled = true
#   ...or toggle "person-search" on in the Control UI → Skills
```

The agent reads `SKILL.md` and runs `person-search-mcp search "<name>" "<profile_url>"` when it needs to research someone.

---

## Configuration

Both paths honour the same env vars (see the main README): `PERSON_SEARCH_API_URL` to point at a self-hosted backend, `PERSON_SEARCH_TIMEOUT_MS` for the request timeout.
