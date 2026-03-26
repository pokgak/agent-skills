import React from "react";
import { Box, Text } from "ink";
import type { ParsedSeries } from "../utils/prometheus.js";
import { formatValue } from "../utils/prometheus.js";
import { getSeriesColor } from "../utils/colors.js";

interface Props {
  series: ParsedSeries[];
  width?: number;
  title?: string;
  maxBars?: number;
}

export function BarChart({ series, width = 80, title, maxBars = 20 }: Props) {
  if (series.length === 0) {
    return <Text color="red">No data to chart</Text>;
  }

  // For bar chart, use the last value of each series (or single value for instant queries)
  const bars = series
    .map((s, i) => ({
      label: s.label,
      value: s.values[s.values.length - 1],
      colorIndex: i,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, maxBars);

  const maxValue = Math.max(...bars.map((b) => b.value));
  const labelWidth = Math.min(
    Math.max(...bars.map((b) => b.label.length)),
    30,
  );
  const valueWidth = Math.max(...bars.map((b) => formatValue(b.value).length));
  const barArea = Math.max(width - labelWidth - valueWidth - 4, 10);

  return (
    <Box flexDirection="column">
      {title && (
        <Box marginBottom={1}>
          <Text bold>{title}</Text>
        </Box>
      )}

      {bars.map((bar, i) => {
        const barLen =
          maxValue > 0 ? Math.round((bar.value / maxValue) * barArea) : 0;
        const label =
          bar.label.length > labelWidth
            ? bar.label.slice(0, labelWidth - 3) + "..."
            : bar.label.padEnd(labelWidth);
        const valStr = formatValue(bar.value).padStart(valueWidth);

        return (
          <Box key={i}>
            <Text>{label} </Text>
            <Text color={getSeriesColor(bar.colorIndex)}>
              {"█".repeat(barLen)}{"░".repeat(Math.max(0, barArea - barLen))}
            </Text>
            <Text> {valStr}</Text>
          </Box>
        );
      })}

      {series.length > maxBars && (
        <Box marginTop={1}>
          <Text dimColor>
            Showing top {maxBars} of {series.length} series
          </Text>
        </Box>
      )}
    </Box>
  );
}
