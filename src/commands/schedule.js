import { CliError, EXIT } from "../errors.js";
import { intFlag, strFlag } from "../args.js";
import { need, oneOf, runTool } from "./_shared.js";
import { TIERS } from "./analyze.js";

const TRIGGERS = ["interval", "webhook"];

export async function scheduleCmd(sub, args, ctx) {
  if (sub === "create") {
    const query = need(args, 0, 'prowl schedule create "<query>" [--cadence <c>] [--tier basic|deep|max] [--playbook <id>] [--trigger interval|webhook] [--hour 0-23]');
    return runTool(ctx, "prowl_schedule_create", {
      query,
      trigger_type: oneOf(args.trigger, TRIGGERS, "trigger"),
      execution_mode: oneOf(args.tier, TIERS, "tier"),
      playbook_id: strFlag(args, "playbook"),
      cadence: strFlag(args, "cadence"),
      run_at_hour: intFlag(args, "hour"),
    });
  }

  if (sub === "list") {
    return runTool(ctx, "prowl_schedule_list", { limit: intFlag(args, "limit"), offset: intFlag(args, "offset") });
  }

  // pause / resume / cancel share a shape: one job id, one tool.
  const byId = { pause: "prowl_schedule_pause", resume: "prowl_schedule_resume", cancel: "prowl_schedule_cancel" };
  if (byId[sub]) {
    const id = need(args, 0, `prowl schedule ${sub} <job_id>`);
    return runTool(ctx, byId[sub], { job_id: id });
  }

  throw new CliError("usage: prowl schedule <create|list|pause|resume|cancel>", EXIT.USAGE);
}
