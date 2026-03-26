#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import meow from "meow";
import { App } from "./App.js";
import { parsePromRangeResponse, readStdin } from "./utils/prometheus.js";
import type { PromRangeResponse } from "./utils/prometheus.js";

const cli = meow(
  `
  Usage
    $ lgtm prom range 'rate(http_requests_total[5m])' | lgtm-chart
    $ lgtm-chart --file metrics.json

  Options
    --title, -t    Chart title
    --width, -w    Chart width in columns (default: terminal width or 80)
    --height, -h   Chart height in rows (default: 15)
    --no-stats     Hide stats table below chart
    --file, -f     Read from file instead of stdin

  Examples
    $ lgtm prom range 'up' --step 1m | lgtm-chart -t "Service Uptime"
    $ lgtm-chart -f range-result.json --height 20
`,
  {
    importMeta: import.meta,
    flags: {
      title: { type: "string", shortFlag: "t" },
      width: { type: "number", shortFlag: "w" },
      height: { type: "number", shortFlag: "h", default: 15 },
      stats: { type: "boolean", default: true },
      file: { type: "string", shortFlag: "f" },
    },
  },
);

async function main() {
  let raw: string;

  if (cli.flags.file) {
    const { readFileSync } = await import("fs");
    raw = readFileSync(cli.flags.file, "utf-8");
  } else if (!process.stdin.isTTY) {
    raw = await readStdin();
  } else {
    cli.showHelp();
    return;
  }

  let data: PromRangeResponse;
  try {
    data = JSON.parse(raw);
  } catch {
    console.error("Error: Invalid JSON input");
    process.exit(1);
    return;
  }

  if (data.status !== "success") {
    console.error(`Error: Prometheus query failed with status: ${data.status}`);
    process.exit(1);
    return;
  }

  const series = parsePromRangeResponse(data);

  const termWidth = process.stdout.columns || 80;
  const width = cli.flags.width ?? termWidth;

  const { waitUntilExit } = render(
    <App
      series={series}
      title={cli.flags.title}
      width={width}
      height={cli.flags.height}
      showStats={cli.flags.stats}
    />,
  );

  await waitUntilExit();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
