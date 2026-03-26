import React from "react";
import { Box, Text } from "ink";
import asciichart from "asciichart";
import type { ParsedSeries } from "../utils/prometheus.js";
import { formatTimestamp, formatValue } from "../utils/prometheus.js";
import { getAnsiColor, getSeriesColor, ANSI_RESET } from "../utils/colors.js";

interface Props {
  series: ParsedSeries[];
  width?: number;
  height?: number;
  title?: string;
}

export function TimeseriesChart({
  series,
  width = 80,
  height = 15,
  title,
}: Props) {
  if (series.length === 0) {
    return <Text color="red">No data to chart</Text>;
  }

  // Downsample series to fit chart width (leave room for y-axis labels ~10 chars)
  const chartWidth = Math.max(width - 12, 20);
  const downsampled = series.map((s) => downsample(s.values, chartWidth));

  // Compute nice tick intervals so we only label round values
  const allValues = downsampled.flat();
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const niceTicks = computeNiceTicks(min, max, height);

  // Build asciichart config with colors per series
  const colors = series.map((_, i) => getAnsiColor(i));
  const labelWidth = 8;
  const config: asciichart.PlotConfig = {
    height,
    colors: colors.map((c) => c),
    format: (v: number) => {
      if (isNearNiceTick(v, niceTicks, min, max, height)) {
        return formatValue(v).padStart(labelWidth);
      }
      return " ".repeat(labelWidth);
    },
  };

  // Render chart
  const chart = asciichart.plot(downsampled, config);

  // Build time axis labels
  const firstSeries = series[0];
  const timeLabels = buildTimeAxis(
    firstSeries.timestamps,
    chartWidth,
  );

  return (
    <Box flexDirection="column">
      {title && (
        <Box marginBottom={1}>
          <Text bold>{title}</Text>
        </Box>
      )}

      <Text>{chart}</Text>

      <Text>
        {"         "}{timeLabels}
      </Text>

      <Box marginTop={1} flexDirection="column">
        {series.map((s, i) => (
          <Box key={i} gap={1}>
            <Text color={getSeriesColor(i)}>{"━━"}</Text>
            <Text>{truncateLabel(s.label, width - 10)}</Text>
            <Text dimColor>
              (last: {formatValue(s.values[s.values.length - 1])})
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function downsample(values: number[], targetLen: number): number[] {
  if (values.length <= targetLen) return values;

  const result: number[] = [];
  const step = values.length / targetLen;
  for (let i = 0; i < targetLen; i++) {
    const start = Math.floor(i * step);
    const end = Math.floor((i + 1) * step);
    const slice = values.slice(start, end);
    result.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  return result;
}

function buildTimeAxis(timestamps: number[], chartWidth: number): string {
  if (timestamps.length === 0) return "";

  const first = formatTimestamp(timestamps[0]);
  const last = formatTimestamp(timestamps[timestamps.length - 1]);
  const mid = formatTimestamp(timestamps[Math.floor(timestamps.length / 2)]);

  const gap1 = Math.max(0, Math.floor(chartWidth / 2) - first.length - Math.floor(mid.length / 2));
  const gap2 = Math.max(0, chartWidth - first.length - gap1 - mid.length - last.length);

  return `${first}${" ".repeat(gap1)}${mid}${" ".repeat(gap2)}${last}`;
}

function truncateLabel(label: string, maxLen: number): string {
  if (label.length <= maxLen) return label;
  return label.slice(0, maxLen - 3) + "...";
}

function niceNumber(value: number, round: boolean): number {
  const exp = Math.floor(Math.log10(value));
  const frac = value / Math.pow(10, exp);
  let nice: number;
  if (round) {
    if (frac < 1.5) nice = 1;
    else if (frac < 3) nice = 2;
    else if (frac < 7) nice = 5;
    else nice = 10;
  } else {
    if (frac <= 1) nice = 1;
    else if (frac <= 2) nice = 2;
    else if (frac <= 5) nice = 5;
    else nice = 10;
  }
  return nice * Math.pow(10, exp);
}

function computeNiceTicks(min: number, max: number, maxTicks: number): number[] {
  if (max === min) return [min];

  const range = niceNumber(max - min, false);
  const desiredTicks = Math.min(maxTicks, Math.max(4, Math.floor(maxTicks / 3)));
  const tickSpacing = niceNumber(range / (desiredTicks - 1), true);
  const niceMin = Math.floor(min / tickSpacing) * tickSpacing;
  const niceMax = Math.ceil(max / tickSpacing) * tickSpacing;

  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + tickSpacing * 0.5; v += tickSpacing) {
    ticks.push(v);
  }
  return ticks;
}

function isNearNiceTick(
  value: number,
  niceTicks: number[],
  min: number,
  max: number,
  height: number,
): boolean {
  if (max === min) return true;
  const rowHeight = (max - min) / height;
  const tolerance = rowHeight * 0.5;
  return niceTicks.some((tick) => Math.abs(value - tick) <= tolerance);
}
