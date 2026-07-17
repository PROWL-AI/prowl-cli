import { BASE_URL } from "../config.js";
import { CliError, EXIT } from "../errors.js";
export async function authCmd(sub, args, ctx, { fetchImpl } = {}) {
  if (sub === "status") {
    const key = ctx.key; if (!key) return ctx.json ? { authenticated: false } : "Not authenticated. Set PROWL_API_KEY, pass --key, or write ~/.prowl/prowl_mcp_token.";
    const masked = key.slice(0, 10) + "\u2026" + key.slice(-2);
    const f = fetchImpl || globalThis.fetch;
    let balance = null, ok = true;
    try { const res = await f(BASE_URL.replace(/\/$/, "") + "/api/v1/wallet/balance", { headers: { authorization: `Bearer ${key}` } }); if (res.status === 401) ok = false; else if (res.ok) { const d = await res.json(); balance = d.balance_usd; } } catch {}
    if (ctx.json) return { authenticated: ok, key: masked, balance_usd: balance };
    return ok ? `Authenticated (key ${masked}${balance != null ? `, balance $${Number(balance).toFixed(2)}` : ""}).` : `Key ${masked} is invalid or revoked.`;
  }
  if (sub === "login") return ["Browser-based `prowl auth login` (device pairing) ships in v0.2.", "For now: generate a key at https://prowl.chat (MCP Home -> API keys), then either", "  export PROWL_API_KEY=prowl_...   (shell)", "  or  mkdir -p ~/.prowl && printf %s 'prowl_...' > ~/.prowl/prowl_mcp_token && chmod 600 ~/.prowl/prowl_mcp_token"].join("\n");
  if (sub === "logout") return "Nothing stored by the CLI to remove. If you wrote ~/.prowl/prowl_mcp_token, delete it manually.";
  throw new CliError("usage: prowl auth <status|login|logout>", EXIT.USAGE);
}
