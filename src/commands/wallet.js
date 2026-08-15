import { runTool } from "./_shared.js";

/**
 * Wallet balance and what the key may actually run.
 *
 * This used to call `GET /api/v1/wallet/balance`, which is wrong three times
 * over: that path does not exist (the route is `/api/v1/wallet`), the route it
 * meant decodes a **JWT** so a `prowl_` key gets 401 there, and the response
 * carries `subscription_balance_usd`/`extra_balance_usd`/`total_available_usd`
 * rather than the `balance_usd`/`key_label` the renderer expected. The 404
 * branch caught the first failure and printed "endpoint not available on this
 * deployment yet", which read as a server limitation and was in fact the CLI
 * calling the wrong URL with a credential the API never accepts.
 *
 * `prowl_get_wallet` is the MCP-side answer, and the only one an API key can
 * reach.
 */
export async function walletCmd(args, ctx) {
  const data = await runTool(ctx, "prowl_get_wallet", {});
  if (ctx.json) return data;
  return render(typeof data === "string" ? safeParse(data) : data);
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function render(w) {
  if (!w || typeof w !== "object") return String(w ?? "");
  const usd = (n) => (typeof n === "number" ? `$${n.toFixed(2)}` : "n/a");
  const lines = [
    `Balance: ${usd(w.total_available_usd)} available ` + `(subscription ${usd(w.subscription_balance_usd)} + extra ${usd(w.extra_balance_usd)})`,
  ];

  const ent = w.entitlement;
  if (ent) {
    const modes = (ent.available_execution_modes || []).join(", ") || "none";
    lines.push(`Modes:   ${modes}`);
    // The silent downgrade, said out loud. Without a subscription a `--tier deep`
    // run does not fail — it executes and bills as basic, and the caller finds
    // out from a thinner report than they asked for, if at all.
    const down = ent.downgraded_modes || {};
    for (const [asked, actual] of Object.entries(down)) {
      lines.push(`         --tier ${asked} would run as ${actual} (needs an active subscription)`);
    }
  }

  const k = w.key_limits;
  if (k) {
    const caps = [
      k.daily_spend_limit_usd != null ? `daily ${usd(k.daily_spend_limit_usd)}` : null,
      k.total_spend_limit_usd != null ? `total ${usd(k.total_spend_limit_usd)}` : null,
    ].filter(Boolean);
    if (caps.length) lines.push(`Key cap: ${caps.join(", ")} — a batch can be refused while the wallet still has funds`);
    if ((k.allowed_categories || []).length) lines.push(`Key scope: only ${k.allowed_categories.join(", ")}`);
    if ((k.denied_categories || []).length) lines.push(`Key scope: not ${k.denied_categories.join(", ")}`);
  }
  return lines.join("\n");
}
