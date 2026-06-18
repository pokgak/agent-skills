#!/usr/bin/env python3
"""Query Cloud SQL Query Insights per-query / per-tag metrics from Cloud Monitoring.

The Query Insights data shown in the GCP console is published to Cloud Monitoring
under cloudsql.googleapis.com/database/postgresql/insights/{perquery,pertag,aggregate}/*.
This script pulls it programmatically. No DB connection required — it reads the
already-collected metrics via the Monitoring v3 API.

Auth: uses `gcloud auth print-access-token` for the active gcloud identity.

GOTCHA this script handles for you: the instance is selected via the resource label
`resource_id` (value "<project>:<instance>"), NOT `database_id` as the public docs
imply. Filtering on database_id returns HTTP 400 "invalid combination".
"""
import argparse
import json
import subprocess
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

BASE = "https://monitoring.googleapis.com/v3/projects"
PREFIX = "cloudsql.googleapis.com/database/postgresql/insights"

# metric short-name -> (subpath suffix, valueType)
METRICS = {
    "execution_time": "INT64",
    "io_time": "INT64",
    "lock_time": "INT64",
    "row_count": "INT64",
    "shared_blk_access_count": "INT64",
    "latencies": "DISTRIBUTION",
}


def token() -> str:
    return subprocess.run(
        ["gcloud", "auth", "print-access-token"],
        capture_output=True, text=True, check=True,
    ).stdout.strip()


def default_project() -> str:
    return subprocess.run(
        ["gcloud", "config", "get-value", "project"],
        capture_output=True, text=True, check=True,
    ).stdout.strip()


def api_get(project: str, path: str, params: dict) -> dict:
    qs = urllib.parse.urlencode(params, quote_via=urllib.parse.quote)
    url = f"{BASE}/{project}/{path}?{qs}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token()}"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def list_instances(project: str, hours: int) -> None:
    """Discover which instances are emitting perquery data (and the resource_id to use)."""
    now = datetime.now(timezone.utc)
    data = api_get(project, "timeSeries", {
        "filter": f'metric.type="{PREFIX}/perquery/execution_time"',
        "interval.startTime": (now - timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "interval.endTime": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "aggregation.alignmentPeriod": "3600s",
        "aggregation.perSeriesAligner": "ALIGN_DELTA",
        "view": "HEADERS",
    })
    counts: dict[str, int] = {}
    for s in data.get("timeSeries", []):
        rid = s["resource"]["labels"].get("resource_id", "?")
        counts[rid] = counts.get(rid, 0) + 1
    if not counts:
        print("No perquery data found. Is query_insights_enabled set on any instance?")
        return
    print(f"Instances emitting Query Insights data (last {hours}h):  resource_id -> #series")
    for rid, n in sorted(counts.items(), key=lambda kv: -kv[1]):
        print(f"  {rid:<55} {n}")


def top_queries(project: str, instance: str, metric: str, hours: int, n: int, pertag: bool) -> None:
    group = "pertag" if pertag else "perquery"
    vtype = METRICS[metric]
    resource_id = instance if ":" in instance else f"{project}:{instance}"
    now = datetime.now(timezone.utc)
    aligner = "ALIGN_DELTA" if vtype == "INT64" else "ALIGN_SUM"
    data = api_get(project, "timeSeries", {
        "filter": (f'metric.type="{PREFIX}/{group}/{metric}" '
                   f'AND resource.labels.resource_id="{resource_id}"'),
        "interval.startTime": (now - timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "interval.endTime": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "aggregation.alignmentPeriod": f"{hours * 3600}s",
        "aggregation.perSeriesAligner": aligner,
        "view": "FULL",
    })
    ts = data.get("timeSeries", [])
    label_key = "tag_hash" if pertag else "querystring"
    rows = []
    for s in ts:
        m = s["metric"]["labels"]
        if vtype == "INT64":
            tot = sum(int(p["value"].get("int64Value", 0)) for p in s.get("points", []))
        else:  # DISTRIBUTION: use count*mean as a rough total weight
            tot = 0.0
            for p in s.get("points", []):
                d = p["value"].get("distributionValue", {})
                tot += float(d.get("count", 0)) * float(d.get("mean", 0))
        ident = m.get(label_key, "") or "|".join(f"{k}={v}" for k, v in m.items() if k not in ("query_hash", "tag_hash"))
        rows.append((tot, m.get("user", ""), ident.replace("\n", " ")[:100]))
    rows.sort(reverse=True)
    unit = "s (summed exec, μs→s)" if metric in ("execution_time", "io_time", "lock_time") else "(raw count)"
    print(f"{group}/{metric} :: {resource_id} :: last {hours}h :: {len(ts)} series   [{unit}]")
    for tot, user, ident in rows[:n]:
        val = f"{tot/1e6:12.2f}" if metric.endswith("_time") else f"{tot:12.0f}"
        print(f"  {val}  user={user:<16} {ident}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--project", default=None, help="GCP project ID (defaults to active gcloud project)")
    ap.add_argument("--instance", help="instance name (project prefix added automatically) or full 'project:instance'")
    ap.add_argument("--metric", default="execution_time", choices=list(METRICS))
    ap.add_argument("--hours", type=int, default=1)
    ap.add_argument("--top", type=int, default=10)
    ap.add_argument("--pertag", action="store_true", help="use pertag instead of perquery (needs record_application_tags=true)")
    ap.add_argument("--list-instances", action="store_true", help="discover instances emitting insights data + their resource_id")
    args = ap.parse_args()
    if not args.project:
        args.project = default_project()
        if not args.project:
            ap.error("no --project given and no active gcloud project set")

    if args.list_instances:
        list_instances(args.project, args.hours)
        return
    if not args.instance:
        ap.error("--instance is required (or use --list-instances)")
    top_queries(args.project, args.instance, args.metric, args.hours, args.top, args.pertag)


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()}", file=sys.stderr)
        sys.exit(1)
