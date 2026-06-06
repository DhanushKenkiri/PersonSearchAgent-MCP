---
name: person-search
description: Research a real person from public web sources and get a cited briefing (role, background, online presence, quotes). Use before a meeting, call, or outreach, or whenever you need grounded context on someone from a name + a public profile link.
---

# Person Search

Research a person from their public web footprint and return a **source-cited**
briefing. Powered by the PersonSearch "Deep Search" agent.

## When to use

- Before a sales / investor / recruiting call — get context on the person.
- Before cold outreach — know who you're writing to.
- Any time the user asks "who is X" / "research X" / "look up X" and gives a
  name plus a public link.

## Prerequisite (one time)

The CLI must be installed:

```bash
npm install -g @actualte/person-search-mcp
```

## How to run

```bash
person-search-mcp search "<full name>" "<public profile url>" "<optional role/company>"
```

Example:

```bash
person-search-mcp search "Paul Graham" "https://x.com/paulg" "Y Combinator"
```

- A **public profile link is required** (LinkedIn, personal site, GitHub, X…)
  — it anchors the research to the right person.
- The command prints a markdown briefing followed by a numbered **Sources**
  list. Relay the briefing to the user and keep the source numbers intact.
- Deep research can take **1–2 minutes**; wait for it to finish.

## Notes

- Works best for people with a real public presence. For very common names or
  thin presence, the report flags low evidence quality and leaves gaps empty
  rather than guessing — **always trust the cited sources over assumptions**.
- To research against a self-hosted backend, set `PERSON_SEARCH_API_URL`.
