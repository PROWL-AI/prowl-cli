import { McpClient, toolJson, toolText } from "../mcp.js";
import { CliError, EXIT } from "../errors.js";
const TIERS = new Set(["basic", "deep", "max"]);
export async function analyzeCmd(args, ctx) {
  const query = args._[0]; if (!query) throw new CliError('usage: prowl analyze "<query>" [--tier basic|deep|max] [--playbook <id>] [--session <id>]', EXIT.USAGE);
  const tier = args.tier || "basic"; if (!TIERS.has(tier)) throw new CliError("--tier must be one of basic|deep|max", EXIT.USAGE);
  const params = { query, execution_mode: tier };
  if (args.playbook) params.playbook_id = args.playbook; if (args.session) params.session_id = args.session;
  const client = new McpClient(ctx.key, { fetchImpl: ctx.fetchImpl });
  const r = await client.callTool("prowl_analyze", params);
  return ctx.json ? toolJson(r) : toolText(r);
}
