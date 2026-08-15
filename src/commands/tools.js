import { CliError, EXIT } from "../errors.js";
import { intFlag, strFlag } from "../args.js";
import { need, runTool } from "./_shared.js";

export async function toolsCmd(sub, args, ctx) {
  if (sub === "list") {
    // The server answers with category COUNTS by default and returns names only
    // for `names=true` or one `category` — a deliberate change, because the old
    // unconditional dump cost ~4k tokens on the first call an agent makes. The
    // CLI passed nothing and so could never reach the names at all.
    return runTool(ctx, "prowl_list_tools", {
      category: strFlag(args, "category"),
      names: args.names === true || args.names === "true" ? true : undefined,
      limit: intFlag(args, "limit"),
      offset: intFlag(args, "offset"),
    });
  }

  if (sub === "search") {
    const query = need(args, 0, 'prowl tools search "<query>" [--category <c>] [--provider <p>] [--limit n] [--offset n]');
    return runTool(ctx, "prowl_search_tools", {
      query,
      category: strFlag(args, "category"),
      provider: strFlag(args, "provider"),
      limit: intFlag(args, "limit"),
      offset: intFlag(args, "offset"),
    });
  }

  if (sub === "info") {
    const name = need(args, 0, "prowl tools info <tool_name>");
    return runTool(ctx, "prowl_tool_info", { tool_name: name });
  }

  throw new CliError("usage: prowl tools <list|search|info>", EXIT.USAGE);
}
