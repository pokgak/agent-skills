export interface PromRangeResult {
  metric: Record<string, string>;
  values: [number, string][]; // [timestamp, value]
}

export interface PromRangeResponse {
  status: string;
  data: {
    resultType: string;
    result: PromRangeResult[];
  };
}

export interface ParsedSeries {
  label: string;
  timestamps: number[];
  values: number[];
}

export function parsePromRangeResponse(raw: PromRangeResponse): ParsedSeries[] {
  if (raw.data.resultType !== "matrix") {
    throw new Error(`Expected matrix result type, got: ${raw.data.resultType}`);
  }

  return raw.data.result.map((result) => {
    const label = formatMetricLabel(result.metric);
    const timestamps = result.values.map(([ts]) => ts);
    const values = result.values.map(([, v]) => parseFloat(v));
    return { label, timestamps, values };
  });
}

function formatMetricLabel(metric: Record<string, string>): string {
  const entries = Object.entries(metric);
  if (entries.length === 0) return "{}";

  const name = metric.__name__;
  const rest = entries.filter(([k]) => k !== "__name__");

  if (rest.length === 0 && name) return name;

  const labels = rest.map(([k, v]) => `${k}="${v}"`).join(", ");
  if (name) return `${name}{${labels}}`;
  return `{${labels}}`;
}

export function formatTimestamp(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatValue(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  if (v < 0.01 && v > 0) return v.toExponential(1);
  if (Number.isInteger(v)) return v.toString();
  return v.toFixed(2);
}

export function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk: string) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}
