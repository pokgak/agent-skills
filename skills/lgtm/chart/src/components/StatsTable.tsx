import React from "react";
import { Box, Text } from "ink";
import type { ParsedSeries } from "../utils/prometheus.js";
import { formatValue } from "../utils/prometheus.js";
import { getSeriesColor } from "../utils/colors.js";

interface Props {
  series: ParsedSeries[];
}

export function StatsTable({ series }: Props) {
  const labelWidth = 38;
  const numWidth = 10;

  const header =
    "Series".padEnd(labelWidth) +
    "Min".padStart(numWidth) +
    "Max".padStart(numWidth) +
    "Avg".padStart(numWidth) +
    "Last".padStart(numWidth);

  const divider = "─".repeat(labelWidth + numWidth * 4);

  const rows = series.map((s, i) => {
    const min = Math.min(...s.values);
    const max = Math.max(...s.values);
    const avg = s.values.reduce((a, b) => a + b, 0) / s.values.length;
    const last = s.values[s.values.length - 1];
    const label =
      s.label.length > labelWidth
        ? s.label.slice(0, labelWidth - 3) + "..."
        : s.label.padEnd(labelWidth);

    return {
      color: getSeriesColor(i),
      line:
        label +
        formatValue(min).padStart(numWidth) +
        formatValue(max).padStart(numWidth) +
        formatValue(avg).padStart(numWidth) +
        formatValue(last).padStart(numWidth),
    };
  });

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold>{header}</Text>
      <Text>{divider}</Text>
      {rows.map((row, i) => (
        <Text key={i} color={row.color}>
          {row.line}
        </Text>
      ))}
    </Box>
  );
}
