// Standard MCP protocol test: launches the built server over stdio and drives
// it with the official MCP SDK client (initialize handshake → tools/list →
// tools/call → error path). The research backend is replaced with a local mock
// HTTP server so the test is deterministic, offline, and fast.
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const SERVER_PATH = fileURLToPath(new URL("../dist/index.js", import.meta.url));

function startMockApi() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const reqJson = (() => {
          try {
            return JSON.parse(body || "{}");
          } catch {
            return {};
          }
        })();

        // Mock the real contract: POST /api/research -> { success, profile, ... }.
        if (req.method !== "POST" || !req.url.startsWith("/api/research")) {
          res.writeHead(404).end();
          return;
        }
        res.writeHead(200, { "content-type": "application/json" });
        if (reqJson.personaName === "Error Person") {
          res.end(JSON.stringify({ success: false, error: "no meaningful evidence found" }));
          return;
        }
        res.end(
          JSON.stringify({
            success: true,
            cached: false,
            profile: {
              name: reqJson.personaName,
              briefing: `# Person Intelligence Report\n\nThis is a test briefing about ${reqJson.personaName}. Context received: ${reqJson.context}`,
              sources: [{ title: "Example Source", url: "https://example.com/profile", type: "web" }],
              searchMeta: { evidenceQuality: "rich" },
            },
            contextString: "ctx",
          })
        );
      });
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function withClient(port, fn) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER_PATH],
    env: { ...process.env, PERSON_SEARCH_API_URL: `http://127.0.0.1:${port}` },
  });
  const client = new Client({ name: "person-search-test", version: "1.0.0" });
  await client.connect(transport); // performs the MCP initialize handshake
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

test("lists the search_person tool with a typed schema", async () => {
  const mock = await startMockApi();
  try {
    await withClient(mock.address().port, async (client) => {
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === "search_person");
      assert.ok(tool, "search_person tool should be advertised");
      assert.match(tool.description ?? "", /research a real person/i);
      const props = tool.inputSchema?.properties ?? {};
      assert.ok(props.name, "input schema exposes `name`");
      assert.ok(props.profile_url, "input schema exposes `profile_url`");
    });
  } finally {
    mock.close();
  }
});

test("calls search_person and returns the briefing + sources", async () => {
  const mock = await startMockApi();
  try {
    await withClient(mock.address().port, async (client) => {
      const result = await client.callTool({
        name: "search_person",
        arguments: { name: "Paul Graham", profile_url: "https://x.com/paulg", context: "Y Combinator" },
      });
      assert.notEqual(result.isError, true);
      const text = (result.content ?? []).map((c) => c.text).join("\n");
      assert.match(text, /test briefing about Paul Graham/);
      assert.match(text, /Context received: Y Combinator \| https:\/\/x\.com\/paulg/);
      assert.match(text, /## Sources/);
      assert.match(text, /example\.com\/profile/);
    });
  } finally {
    mock.close();
  }
});

test("surfaces backend errors as an MCP tool error (isError)", async () => {
  const mock = await startMockApi();
  try {
    await withClient(mock.address().port, async (client) => {
      const result = await client.callTool({
        name: "search_person",
        arguments: { name: "Error Person", profile_url: "https://x.com/nobody" },
      });
      assert.equal(result.isError, true);
      const text = (result.content ?? []).map((c) => c.text).join("\n");
      assert.match(text, /no meaningful evidence found/);
    });
  } finally {
    mock.close();
  }
});
