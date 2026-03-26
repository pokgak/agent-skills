// Terminal colors for chart series (ANSI 256 colors that are visually distinct)
const SERIES_COLORS = [
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "red",
  "greenBright",
  "yellowBright",
  "blueBright",
  "magentaBright",
] as const;

export type SeriesColor = (typeof SERIES_COLORS)[number];

export function getSeriesColor(index: number): SeriesColor {
  return SERIES_COLORS[index % SERIES_COLORS.length];
}

// ANSI escape codes for asciichart (which doesn't use Ink's color system)
const ANSI_CODES: Record<string, string> = {
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  greenBright: "\x1b[92m",
  yellowBright: "\x1b[93m",
  blueBright: "\x1b[94m",
  magentaBright: "\x1b[95m",
};

export function getAnsiColor(index: number): string {
  const color = getSeriesColor(index);
  return ANSI_CODES[color] ?? "\x1b[37m";
}

export const ANSI_RESET = "\x1b[0m";
