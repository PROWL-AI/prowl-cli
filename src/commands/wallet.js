import { BASE_URL } from "../config.js";
import { CliError, EXIT } from "../errors.js";
export async function walletCmd(args, ctx, { fetchImpl } = {}) {
  const f = fetchImpl || globalThis.fetch;
  const url = BASE_URL.replace(/\/$/, "") + "/api/v1/wallet/balance";
  let res;
  try { res = await f(url, { headers: ctx.key ? { authorization: `Bearer ${ctx.key}` } : {} }); }
  catch (e) { throw new CliError(`Network error contacting ${url}: ${e.message}`, EXIT.NETWORK); }
  if (res.status === 401) throw new CliError("Unauthorized \u2014 set a valid key via --key or PROWL_API_KEY.", EXIT.AUTH);
  if (res.status === 404) return ctx.json ? { balance_usd: null, note: "wallet balance endpoint not available on this deployment yet" } : "Wallet balance endpoint not available on this deployment yet.";
  if (!res.ok) throw new CliError(`Wallet lookup failed (HTTP ${res.status}).`, EXIT.NETWORK);
  const data = await res.json();
  if (ctx.json) return data;
  const b = data.balance_usd;
  return `Balance: $${typeof b === "number" ? b.toFixed(2) : b} (key: ${data.key_label || "?"})`;
}
