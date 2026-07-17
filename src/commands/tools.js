import { McpClient, toolJson, toolText } from "../mcp.js";
import { CliError, EXIT } from "../errors.js";
export async function toolsCmd(sub, args, ctx) {
  const client = new McpClient(ctx.key, { fetchImpl: ctx.fetchImpl });
  if (sub === "list") { const r = await client.callTool("prowl_list_tools", {}); return ctx.json ? toolJson(r) : toolText(r); }
  if (sub === "search") { const q = args._[0]; if (!q) throw new CliError("usage: prowl tools search <query>", EXIT.USAGE); const r = await client.callTool("prowl_search_tools", { query: q }); return ctx.json ? toolJson(r) : toolText(r); }
  if (sub === "info") { const name = args._[0]; if (!name) throw new CliError("usage: prowl tools info <tool_name>", EXIT.USAGE); const r = await client.callTool("prowl_tool_info", { tool_name: name }); return ctx.json ? toolJson(r) : toolText(r); }
  throw new CliError("usage: prowl tools <list|search|info>", EXIT.USAGE);
}
