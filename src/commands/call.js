import { McpClient, toolJson, toolText } from "../mcp.js";
import { CliError, EXIT } from "../errors.js";
export async function callCmd(args, ctx) {
  const name = args._[0]; if (!name) throw new CliError("usage: prowl call <tool_name> --params '<json>'", EXIT.USAGE);
  let params = {}; if (args.params) { try { params = JSON.parse(args.params); } catch { throw new CliError("--params must be valid JSON", EXIT.USAGE); } }
  const client = new McpClient(ctx.key, { fetchImpl: ctx.fetchImpl });
  const r = await client.callTool("prowl_call_tool", { tool_name: name, params });
  return ctx.json ? toolJson(r) : toolText(r);
}
