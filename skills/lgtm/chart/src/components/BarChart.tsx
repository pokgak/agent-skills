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

  // Simplify labels by stripping common parts
  const simplifiedLabels = simplifyLabels(bars.map((b) => b.label));

  const maxValue = Math.max(...bars.map((b) => b.value));
  const labelWidth = Math.min(
    Math.max(...simplifiedLabels.map((l) => l.length)),
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
          simplifiedLabels[i].length > labelWidth
            ? simplifiedLabels[i].slice(0, labelWidth - 3) + "..."
            : simplifiedLabels[i].padEnd(labelWidth);
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

function simplifyLabels(labels: string[]): string[] {
  if (labels.length <= 1) return labels;

  // Try to extract and simplify metric label values
  // e.g. {instance="primeintellect-freyr-gpu-015"} -> gpu-015
  const parsed = labels.map(parseLabel);

  // If all labels have the same label keys, show only the varying values
  if (parsed.every((p) => p !== null)) {
    const allKeys = parsed.map((p) => Object.keys(p!).sort().join(","));
    const sameKeys = allKeys.every((k) => k === allKeys[0]);

    if (sameKeys && parsed[0]) {
      const keys = Object.keys(parsed[0]);

      // Find which keys have varying values
      const varyingKeys = keys.filter((key) => {
        const vals = new Set(parsed.map((p) => p![key]));
        return vals.size > 1;
      });

      if (varyingKeys.length > 0) {
        // Show key=value for varying keys only
        const simplified = parsed.map((p) => {
          if (varyingKeys.length === 1) {
            return p![varyingKeys[0]];
          }
          return varyingKeys.map((key) => `${key}=${p![key]}`).join(", ");
        });

        // Only strip common affixes from single-key values
        if (varyingKeys.length === 1) {
          return stripCommonAffixes(simplified);
        }
        return simplified;
      }
    }
  }

  // Fallback: strip common prefix/suffix from raw labels
  return stripCommonAffixes(labels);
}

function parseLabel(label: string): Record<string, string> | null {
  // Parse {key="value", key2="value2"} or name{key="value"}
  const match = label.match(/\{(.+)\}/);
  if (!match) return null;

  const result: Record<string, string> = {};
  const pairs = match[1].matchAll(/(\w+)="([^"]*)"/g);
  for (const [, key, value] of pairs) {
    result[key] = value;
  }
  return Object.keys(result).length > 0 ? result : null;
}

function stripCommonAffixes(labels: string[]): string[] {
  if (labels.length <= 1) return labels;

  // Find common prefix
  let prefix = 0;
  const first = labels[0];
  outer: for (let i = 0; i < first.length; i++) {
    for (const label of labels) {
      if (i >= label.length || label[i] !== first[i]) break outer;
    }
    prefix = i + 1;
  }

  // Snap prefix back to include the last word segment before divergence
  // e.g. "primeintellect-freyr-gpu-015" vs "gpu-028" -> keep "gpu-"
  const separators = ["-", "_", "/", "."];
  if (prefix > 0 && prefix < first.length) {
    // Find the separator just before the divergence point
    let sep1 = -1;
    for (let i = prefix - 1; i >= 0; i--) {
      if (separators.includes(first[i])) { sep1 = i; break; }
    }
    // Then find the one before that to keep one word segment
    if (sep1 > 0) {
      let sep2 = -1;
      for (let i = sep1 - 1; i >= 0; i--) {
        if (separators.includes(first[i])) { sep2 = i; break; }
      }
      prefix = sep2 >= 0 ? sep2 + 1 : 0;
    } else {
      prefix = 0;
    }
  }

  // Find common suffix
  let suffix = 0;
  const last = labels[0];
  outer2: for (let i = 0; i < last.length; i++) {
    for (const label of labels) {
      if (i >= label.length || label[label.length - 1 - i] !== last[last.length - 1 - i])
        break outer2;
    }
    suffix = i + 1;
  }

  // Snap suffix to word boundary
  if (suffix > 0 && suffix < last.length) {
    let snapped = suffix;
    for (let i = suffix; i >= 0; i--) {
      if (separators.includes(last[last.length - 1 - i])) {
        snapped = i;
        break;
      }
    }
    suffix = snapped;
  }

  // Don't strip if it would leave nothing meaningful
  const stripped = labels.map((l) => {
    const end = suffix > 0 ? l.length - suffix : l.length;
    const result = l.slice(prefix, end);
    return result || l;
  });

  return stripped;
}
