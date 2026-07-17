import { MCP_URL } from "./config.js";
import { CliError, EXIT } from "./errors.js";
const PROTOCOL_VERSION = "2025-06-18";
const TIMEOUT_MS = 30000;
function parseBody(contentType, text) {
  if ((contentType || "").includes("text/event-stream")) {
    let last = null;
    for (const line of text.split(/\r?\n/)) { const m = line.match(/^data:\s?(.*)$/); if (m && m[1]) { try { last = JSON.parse(m[1]); } catch {} } }
    return last;
  }
  return text ? JSON.parse(text) : null;
}
export class McpClient {
  constructor(key, { fetchImpl } = {}) { this.key = key; this._fetch = fetchImpl || globalThis.fetch; this._id = 0; this._sessionId = null; this._initialized = false; }
  async _post(payload, extraHeaders = {}) {
    const headers = { "content-type": "application/json", "accept": "application/json, text/event-stream", ...extraHeaders };
    if (this.key) headers["authorization"] = `Bearer ${this.key}`;
    if (this._sessionId) headers["mcp-session-id"] = this._sessionId;
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res;
    try { res = await this._fetch(MCP_URL, { method: "POST", headers, body: JSON.stringify(payload), signal: ctrl.signal }); }
    catch (e) { throw new CliError(`Network error contacting ${MCP_URL}: ${e.message}`, EXIT.NETWORK); }
    finally { clearTimeout(timer); }
    const sid = res.headers && res.headers.get && res.headers.get("mcp-session-id"); if (sid) this._sessionId = sid;
    if (res.status === 401) throw new CliError("Unauthorized \u2014 run `prowl auth status`; set a valid key via --key or PROWL_API_KEY.", EXIT.AUTH);
    if (res.status === 402) throw new CliError("Insufficient wallet balance. Top up at https://prowl.chat.", EXIT.BALANCE);
    if (res.status === 429) throw new CliError("Rate limited by the Prowl MCP. Slow down and retry.", EXIT.NETWORK);
    const text = await res.text();
    if (res.status >= 500) throw new CliError(`Prowl MCP server error (${res.status}).`, EXIT.NETWORK);
    const body = parseBody(res.headers && res.headers.get && res.headers.get("content-type"), text);
    if (res.status >= 400) { const msg = (body && body.error && body.error.message) || `HTTP ${res.status}`; throw new CliError(msg, EXIT.RUNTIME); }
    return body;
  }
  async initialize() {
    if (this._initialized) return;
    const initRes = await this._post({ jsonrpc: "2.0", id: ++this._id, method: "initialize", params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "prowl-cli", version: "0.1.0" } } });
    if (initRes && initRes.error) throw new CliError(initRes.error.message || "initialize failed", EXIT.RUNTIME);
    try { await this._post({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }); } catch {}
    this._initialized = true;
  }
  async callTool(name, args = {}) {
    await this.initialize();
    const res = await this._post({ jsonrpc: "2.0", id: ++this._id, method: "tools/call", params: { name, arguments: args } });
    if (res && res.error) throw new CliError(res.error.message || `tool ${name} failed`, EXIT.RUNTIME);
    const result = res && res.result;
    if (!result) throw new CliError(`Empty response from tool ${name}.`, EXIT.RUNTIME);
    if (result.isError) { const t = (result.content || []).map((c) => c.text || "").join("\n"); throw new CliError(t || `tool ${name} returned an error`, EXIT.RUNTIME); }
    return result;
  }
}
export function toolText(result) { return (result.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n"); }
export function toolJson(result) { const t = toolText(result); try { return JSON.parse(t); } catch { return t; } }
