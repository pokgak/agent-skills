import React from "react";
import { Box, Text } from "ink";
import { TimeseriesChart } from "./components/TimeseriesChart.js";
import { StatsTable } from "./components/StatsTable.js";
import { BarChart } from "./components/BarChart.js";
import { Heatmap } from "./components/Heatmap.js";
import type { ParsedSeries } from "./utils/prometheus.js";

export type ChartType = "timeseries" | "bar" | "heatmap";

interface Props {
  series: ParsedSeries[];
  type?: ChartType;
  title?: string;
  width?: number;
  height?: number;
  showStats?: boolean;
}

export function App({ series, type = "timeseries", title, width = 80, height = 15, showStats = true }: Props) {
  if (series.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="red">No data found in input.</Text>
        <Text dimColor>Expected Prometheus range query JSON (resultType: "matrix").</Text>
      </Box>
    );
  }

  switch (type) {
    case "bar":
      return <BarChart series={series} title={title} width={width} />;

    case "heatmap":
      return <Heatmap series={series} title={title} width={width} />;

    case "timeseries":
    default:
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
}
