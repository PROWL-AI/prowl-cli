import { CliError, EXIT } from "../errors.js";
import { McpClient, toolJson, toolText } from "../mcp.js";

const NO_KEY = "Not authenticated. Set PROWL_API_KEY, pass --key, or write ~/.prowl/prowl_mcp_token.";

export async function authCmd(sub, args, ctx) {
  if (sub === "status") return status(ctx);

  if (sub === "login") {
    return [
      "Browser-based `prowl auth login` (device pairing) is not implemented yet.",
      "Generate a key at https://prowl.chat (MCP Home → API keys), then either:",
      "  export PROWL_API_KEY=prowl_...",
      "  or  mkdir -p ~/.prowl && printf %s 'prowl_...' > ~/.prowl/prowl_mcp_token && chmod 600 ~/.prowl/prowl_mcp_token",
    ].join("\n");
  }

  if (sub === "logout") {
    return "Nothing stored by the CLI to remove. If you wrote ~/.prowl/prowl_mcp_token, delete it manually.";
  }

  throw new CliError("usage: prowl auth <status|login|logout>", EXIT.USAGE);
}

/**
 * Does this key work, and what can it do?
 *
 * The previous implementation asked `/api/v1/wallet/balance` inside a bare
 * `catch {}` with `ok` initialised to `true`, so every failure — wrong URL,
 * network fault, revoked key — was swallowed and printed "Authenticated". The
 * one branch that could set `ok = false` was a 401, which that URL can never
 * return because it 404s first. It reported success unconditionally.
 *
 * Authentication is now proven the only way it can be: by making an
 * authenticated call and reading the answer.
 */
async function status(ctx) {
  const key = ctx.key;
  if (!key) {
    if (ctx.json) return { authenticated: false, reason: "no key configured" };
    throw new CliError(NO_KEY, EXIT.AUTH);
  }
  const masked = mask(key);
  const client = new McpClient(key, { fetchImpl: ctx.fetchImpl });

  let wallet = null;
  try {
    const result = await client.callTool("prowl_get_wallet", {});
    const text = toolText(result);
    if (/^\s*Error:/.test(text)) throw new CliError(text.trim(), EXIT.AUTH);
    wallet = toolJson(result);
  } catch (e) {
    const code = e instanceof CliError ? e.code : EXIT.RUNTIME;
    if (code === EXIT.AUTH) {
      if (ctx.json) return { authenticated: false, key: masked, reason: e.message };
      throw new CliError(`Key ${masked} is not accepted: ${e.message}`, EXIT.AUTH);
    }
    // A network fault or an older deployment says nothing about the key. Saying
    // "invalid" here would send someone to regenerate a key that is fine.
    if (ctx.json) return { authenticated: null, key: masked, reason: e.message };
    throw new CliError(`Could not verify key ${masked}: ${e.message}`, code);
  }

  if (ctx.json) return { authenticated: true, key: masked, wallet };
  const balance = wallet && typeof wallet.total_available_usd === "number" ? `, balance $${wallet.total_available_usd.toFixed(2)}` : "";
  const modes = wallet && wallet.entitlement ? `, modes: ${(wallet.entitlement.available_execution_modes || []).join(", ")}` : "";
  return `Authenticated (key ${masked}${balance}${modes}).`;
}

/** Show enough of the key to tell two apart, never enough to use one. */
function mask(key) {
  return key.length <= 12 ? "prowl_…" : `${key.slice(0, 10)}…${key.slice(-2)}`;
}
