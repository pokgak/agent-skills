import React from "react";
import { Box, Text } from "ink";
import type { ParsedSeries } from "../utils/prometheus.js";
import { formatTimestamp, formatValue } from "../utils/prometheus.js";

interface Props {
  series: ParsedSeries[];
  width?: number;
  title?: string;
}

// Block characters from empty to full intensity
const BLOCKS = [" ", "░", "▒", "▓", "█"];

// Color gradient: low (blue) -> mid (yellow) -> high (red)
const HEAT_COLORS = [
  "blue",
  "cyan",
  "green",
  "yellow",
  "red",
] as const;

export function Heatmap({ series, width = 80, title }: Props) {
  if (series.length === 0) {
    return <Text color="red">No data to chart</Text>;
  }

  // Sort series by bucket bound (extract le/bucket label)
  const sorted = sortByBucket(series);

  // All series should share the same timestamps
  const timestamps = sorted[0].timestamps;
  const numCols = timestamps.length;

  // Compute label width from bucket names
  const labels = sorted.map((s) => extractBucketLabel(s.label));
  const labelWidth = Math.min(Math.max(...labels.map((l) => l.length)), 16);

  // Available width for the heatmap cells
  const cellArea = Math.max(width - labelWidth - 2, 20);

  // Compute cell width: stretch each data point to fill the available space
  const cellWidth = Math.max(1, Math.floor(cellArea / numCols));
  const displayCols = cellWidth * numCols;

  // If data points exceed available space, downsample instead
  const downsample = numCols > cellArea;
  const step = downsample ? Math.ceil(numCols / cellArea) : 1;
  const effectiveCols = downsample ? Math.ceil(numCols / step) : numCols;
  const effectiveCellWidth = downsample ? 1 : cellWidth;
  const effectiveDisplayCols = effectiveCols * effectiveCellWidth;

  // Compute per-bucket deltas (like Grafana: subtract lower bucket from upper)
  // This shows where requests actually fall rather than cumulative counts
  const isCumulative = detectCumulative(sorted);
  const deltaValues: number[][] = isCumulative
    ? sorted.map((s, si) => {
        if (si === 0) return s.values;
        return s.values.map((v, vi) => Math.max(0, v - sorted[si - 1].values[vi]));
      })
    : sorted.map((s) => s.values);

  // Build the value grid and find global min/max for normalization
  const grid: number[][] = deltaValues.map((values) => {
    const row: number[] = [];
    if (downsample) {
      for (let i = 0; i < numCols; i += step) {
        const slice = values.slice(i, Math.min(i + step, numCols));
        row.push(Math.max(...slice));
      }
    } else {
      for (const v of values) {
        row.push(v);
      }
    }
    return row;
  });

  const allVals = grid.flat().filter((v) => v > 0);
  const globalMax = allVals.length > 0 ? Math.max(...allVals) : 1;
  const globalMin = allVals.length > 0 ? Math.min(...allVals) : 0;

  // Build time axis
  const timeLabels = buildTimeAxis(timestamps, effectiveDisplayCols);

  return (
    <Box flexDirection="column">
      {title && (
        <Box marginBottom={1}>
          <Text bold>{title}</Text>
        </Box>
      )}

      {/* Rows from top (highest bucket) to bottom (lowest) */}
      {[...sorted].reverse().map((s, ri) => {
        const rowIdx = sorted.length - 1 - ri;
        const row = grid[rowIdx];
        const label = labels[rowIdx];
        const paddedLabel =
          label.length > labelWidth
            ? label.slice(0, labelWidth - 2) + ".."
            : label.padStart(labelWidth);

        return (
          <Box key={ri}>
            <Text dimColor>{paddedLabel} </Text>
            <Text>
              {row.map((v) => cellToString(v, globalMin, globalMax).repeat(effectiveCellWidth)).join("")}
            </Text>
          </Box>
        );
      })}

      {/* Time axis */}
      <Text>
        {" ".repeat(labelWidth + 1)}
        {timeLabels}
      </Text>

      {/* Legend */}
      <Box marginTop={1} gap={1}>
        <Text dimColor>Low </Text>
        {HEAT_COLORS.map((c, i) => (
          <Text key={i} color={c}>
            {BLOCKS[i + 1]}
          </Text>
        ))}
        <Text dimColor> High</Text>
        <Text dimColor>
          {"  "}(min: {formatValue(globalMin)}, max: {formatValue(globalMax)})
        </Text>
      </Box>
    </Box>
  );
}

function cellToString(value: number, min: number, max: number): string {
  if (value === 0) return " ";

  // Use log scale for better contrast on skewed distributions (like Grafana)
  const logMin = min > 0 ? Math.log1p(min) : 0;
  const logMax = Math.log1p(max);
  const logVal = Math.log1p(value);
  const logRange = logMax - logMin || 1;
  const normalized = (logVal - logMin) / logRange;

  const blockIdx = Math.min(
    Math.floor(normalized * BLOCKS.length),
    BLOCKS.length - 1,
  );
  return BLOCKS[Math.max(1, blockIdx)];
}

function detectCumulative(sorted: ParsedSeries[]): boolean {
  // Histogram buckets are cumulative if each bucket's values are >= the previous bucket
  if (sorted.length < 2) return false;
  const hasLeBuckets = sorted.some((s) => s.label.includes('le="'));
  if (!hasLeBuckets) return false;

  // Check a sample of timestamps
  for (let vi = 0; vi < Math.min(sorted[0].values.length, 5); vi++) {
    for (let si = 1; si < sorted.length; si++) {
      if (sorted[si].values[vi] < sorted[si - 1].values[vi]) return false;
    }
  }
  return true;
}

function extractBucketLabel(label: string): string {
  // Extract "le" label value for histogram buckets
  const leMatch = label.match(/le="([^"]+)"/);
  if (leMatch) {
    const v = parseFloat(leMatch[1]);
    if (leMatch[1] === "+Inf") return "+Inf";
    return formatValue(v);
  }
  // Fall back to full label
  return label.length > 16 ? label.slice(0, 13) + "..." : label;
}

function sortByBucket(series: ParsedSeries[]): ParsedSeries[] {
  return [...series].sort((a, b) => {
    const aVal = extractLeValue(a.label);
    const bVal = extractLeValue(b.label);
    return aVal - bVal;
  });
}

function extractLeValue(label: string): number {
  const match = label.match(/le="([^"]+)"/);
  if (!match) return 0;
  if (match[1] === "+Inf") return Infinity;
  return parseFloat(match[1]);
}

function buildTimeAxis(timestamps: number[], displayCols: number): string {
  if (timestamps.length === 0) return "";

  const first = formatTimestamp(timestamps[0]);
  const last = formatTimestamp(timestamps[timestamps.length - 1]);
  const mid = formatTimestamp(timestamps[Math.floor(timestamps.length / 2)]);

  const gap1 = Math.max(
    0,
    Math.floor(displayCols / 2) - first.length - Math.floor(mid.length / 2),
  );
  const gap2 = Math.max(
    0,
    displayCols - first.length - gap1 - mid.length - last.length,
  );

  return `${first}${" ".repeat(gap1)}${mid}${" ".repeat(gap2)}${last}`;
}
