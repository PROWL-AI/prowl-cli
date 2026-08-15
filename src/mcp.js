import { MCP_URL, VERSION } from "./config.js";
import { CliError, EXIT } from "./errors.js";

const PROTOCOL_VERSION = "2025-06-18";

/**
 * Two deadlines, because one number cannot serve both kinds of call.
 *
 * A catalogue read answers in under a second. `prowl_analyze` states 30 seconds
 * to 5 minutes for basic/deep and 5-10 for max, and the server heartbeats every
 * ~15s over SSE precisely to keep that stream warm behind Cloudflare.
 *
 * The CLI aborted every call at 30s, so `prowl analyze --tier deep` could not
 * succeed: the client gave up, the server ran to completion, and the wallet was
 * debited for a report the caller never received. A timeout that costs money on
 * expiry has to be longer than the work it is timing.
 */
export const QUICK_TIMEOUT_MS = 60_000;
export const LONG_TIMEOUT_MS = 900_000;

function envTimeout() {
  const raw = process.env.PROWL_TIMEOUT_MS;
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseBody(contentType, text) {
  if ((contentType || "").includes("text/event-stream")) {
    let last = null;
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^data:\s?(.*)$/);
      if (m && m[1]) {
        try {
          last = JSON.parse(m[1]);
        } catch {}
      }
    }
    return last;
  }
  return text ? JSON.parse(text) : null;
}

export class McpClient {
  constructor(key, { fetchImpl, timeoutMs } = {}) {
    this.key = key;
    this._fetch = fetchImpl || globalThis.fetch;
    this._id = 0;
    this._sessionId = null;
    this._initialized = false;
    this._timeoutMs = timeoutMs || envTimeout() || QUICK_TIMEOUT_MS;
  }

  async _post(payload, { timeoutMs } = {}) {
    const headers = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "user-agent": `prowl-cli/${VERSION}`,
    };
    if (this.key) headers["authorization"] = `Bearer ${this.key}`;
    if (this._sessionId) headers["mcp-session-id"] = this._sessionId;

    const limit = timeoutMs || this._timeoutMs;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), limit);
    let res;
    try {
      res = await this._fetch(MCP_URL, { method: "POST", headers, body: JSON.stringify(payload), signal: ctrl.signal });
    } catch (e) {
      // An abort is not a network fault, and saying so sends the reader to
      // check their connection. Name the deadline and how to raise it.
      if (e && (e.name === "AbortError" || e.name === "TimeoutError")) {
        throw new CliError(
          `Timed out after ${Math.round(limit / 1000)}s waiting for ${MCP_URL}. ` +
            `The run may still be completing server-side and may still be billed — check \`prowl session list\`. ` +
            `Raise the deadline with PROWL_TIMEOUT_MS, or start long work with \`prowl session start\` and poll it.`,
          EXIT.NETWORK,
        );
      }
      throw new CliError(`Network error contacting ${MCP_URL}: ${e.message}`, EXIT.NETWORK);
    } finally {
      clearTimeout(timer);
    }

    const sid = res.headers && res.headers.get && res.headers.get("mcp-session-id");
    if (sid) this._sessionId = sid;
    if (res.status === 401) throw new CliError("Unauthorized — run `prowl auth status`; set a valid key via --key or PROWL_API_KEY.", EXIT.AUTH);
    if (res.status === 402) throw new CliError("Insufficient wallet balance. Top up at https://prowl.chat.", EXIT.BALANCE);
    if (res.status === 429) throw new CliError("Rate limited by the Prowl MCP. Slow down and retry.", EXIT.NETWORK);
    const text = await res.text();
    if (res.status >= 500) throw new CliError(`Prowl MCP server error (${res.status}).`, EXIT.NETWORK);
    const body = parseBody(res.headers && res.headers.get && res.headers.get("content-type"), text);
    if (res.status >= 400) {
      const msg = (body && body.error && body.error.message) || `HTTP ${res.status}`;
      throw new CliError(msg, EXIT.RUNTIME);
    }
    return body;
  }

  async initialize() {
    if (this._initialized) return;
    const initRes = await this._post({
      jsonrpc: "2.0",
      id: ++this._id,
      method: "initialize",
      params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "prowl-cli", version: VERSION } },
    });
    if (initRes && initRes.error) throw new CliError(initRes.error.message || "initialize failed", EXIT.RUNTIME);
    try {
      await this._post({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });
    } catch {}
    this._initialized = true;
  }

  async callTool(name, args = {}, { timeoutMs } = {}) {
    await this.initialize();
    const res = await this._post({ jsonrpc: "2.0", id: ++this._id, method: "tools/call", params: { name, arguments: args } }, { timeoutMs });
    if (res && res.error) throw unknownToolError(name, res.error.message) || new CliError(res.error.message || `tool ${name} failed`, EXIT.RUNTIME);
    const result = res && res.result;
    if (!result) throw new CliError(`Empty response from tool ${name}.`, EXIT.RUNTIME);
    if (result.isError) {
      const t = (result.content || []).map((c) => c.text || "").join("\n");
      throw unknownToolError(name, t) || new CliError(t || `tool ${name} returned an error`, EXIT.RUNTIME);
    }
    return result;
  }
}

/**
 * A tool this CLI knows about but the deployment does not.
 *
 * The CLI ships independently of the server, so a fresh client can meet an older
 * endpoint. "Unknown tool: prowl_get_wallet" is accurate and useless; the reader
 * needs to know that their install is ahead of the server, not broken.
 */
function unknownToolError(name, message) {
  if (!message) return null;
  if (!/unknown tool|tool not found|no such tool|method not found/i.test(String(message))) return null;
  return new CliError(
    `This Prowl deployment does not serve \`${name}\` yet — your CLI is newer than the server at ${MCP_URL}. ` +
      `Run \`prowl tools list\` to see what it does serve.`,
    EXIT.RUNTIME,
  );
}

export function toolText(result) {
  return (result.content || [])
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");
}

export function toolJson(result) {
  const t = toolText(result);
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}

/**
 * Some tools answer with a plain "Error: …" string rather than an MCP error, so
 * a failure would otherwise be printed as a successful result and exit 0. A
 * script that branches on the exit code would treat it as a win.
 */
export function failOnErrorText(text, code = EXIT.RUNTIME) {
  if (typeof text === "string" && /^\s*Error:/.test(text)) throw new CliError(text.trim(), code);
  return text;
}
