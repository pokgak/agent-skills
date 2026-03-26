import React from "react";
import { Box, Text } from "ink";
import { TimeseriesChart } from "./components/TimeseriesChart.js";
import { StatsTable } from "./components/StatsTable.js";
import type { ParsedSeries } from "./utils/prometheus.js";

interface Props {
  series: ParsedSeries[];
  title?: string;
  width?: number;
  height?: number;
  showStats?: boolean;
}

export function App({ series, title, width = 80, height = 15, showStats = true }: Props) {
  if (series.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="red">No timeseries data found in input.</Text>
        <Text dimColor>Expected Prometheus range query JSON (resultType: "matrix").</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <TimeseriesChart
        series={series}
        title={title}
        width={width}
        height={height}
      />
      {showStats && <StatsTable series={series} />}
    </Box>
  );
}
