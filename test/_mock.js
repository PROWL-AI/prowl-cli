/**
 * A mock Prowl MCP endpoint that records what the CLI actually sent.
 *
 * The bugs this suite exists to catch are contract bugs — a right-looking
 * command carrying the wrong parameter name — so the mock keeps every
 * `tools/call` and the tests assert on the recorded request, not only on the
 * rendered output. `analyze --tier deep` printing a report proves nothing if the
 * server was sent a key it ignores.
 */
export function mockMcp({ toolPayload, text, status = 200, isError = false, error = null } = {}) {
  const calls = [];
  const headers = new Map([
    ["content-type", "application/json"],
    ["mcp-session-id", "sess-1"],
  ]);
  const mkRes = (obj, st = 200) => ({
    status: st,
    ok: st < 400,
    headers: { get: (k) => headers.get(k.toLowerCase()) },
    text: async () => JSON.stringify(obj),
    json: async () => obj,
  });

  const fetchImpl = async (url, opts) => {
    const body = JSON.parse(opts.body);
    if (body.method === "initialize") {
      return mkRes({ jsonrpc: "2.0", id: body.id, result: { protocolVersion: "2025-06-18", capabilities: {}, serverInfo: { name: "prowl" } } });
    }
    if (body.method === "notifications/initialized") return mkRes({}, 202);
    if (body.method === "tools/call") {
      calls.push({ name: body.params.name, args: body.params.arguments, headers: opts.headers });
      if (status !== 200) return mkRes({ jsonrpc: "2.0", id: body.id, error: { code: -32000, message: "boom" } }, status);
      if (error) return mkRes({ jsonrpc: "2.0", id: body.id, error });
      const payload = text !== undefined ? text : JSON.stringify(toolPayload ?? {});
      return mkRes({ jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: payload }], isError } });
    }
    return mkRes({}, 400);
  };

  fetchImpl.calls = calls;
  /** The single recorded tool call, asserting there was exactly one. */
  fetchImpl.only = () => {
    if (calls.length !== 1) throw new Error(`expected exactly 1 tool call, got ${calls.length}: ${calls.map((c) => c.name).join(", ")}`);
    return calls[0];
  };
  return fetchImpl;
}

/** Run the CLI with no ambient key/env leaking in from the developer's shell. */
export async function runClean(run, argv, opts = {}) {
  const saved = {};
  for (const k of ["PROWL_API_KEY", "PROWL_BASE_URL", "PROWL_MCP_URL", "PROWL_TIMEOUT_MS"]) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  try {
    return await run(argv, opts);
  } finally {
    for (const [k, v] of Object.entries(saved)) if (v !== undefined) process.env[k] = v;
  }
}
