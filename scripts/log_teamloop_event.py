#!/usr/bin/env python3
"""Append Team Loop message, commit, and decision events as NDJSON."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


EVENT_FILES = {
    "message": "messages.ndjson",
    "commit": "commits.ndjson",
    "decision": "decisions.ndjson",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_field(raw: str) -> tuple[str, Any]:
    if "=" not in raw:
        raise argparse.ArgumentTypeError("--field must be key=value")
    key, value = raw.split("=", 1)
    key = key.strip()
    if not key:
        raise argparse.ArgumentTypeError("--field key cannot be empty")
    value = value.strip()
    if value.lower() == "true":
        return key, True
    if value.lower() == "false":
        return key, False
    if value.lower() == "null":
        return key, None
    return key, value


def load_payload(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Invalid --payload-json: {exc}") from exc
    if not isinstance(payload, dict):
        raise SystemExit("--payload-json must decode to a JSON object")
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description="Append a Team Loop event.")
    parser.add_argument("--team-loop-dir", required=True)
    parser.add_argument("--event-type", required=True, choices=sorted(EVENT_FILES))
    parser.add_argument("--payload-json")
    parser.add_argument("--field", action="append", default=[], type=parse_field)
    args = parser.parse_args()

    team_dir = Path(args.team_loop_dir).expanduser().resolve()
    if not team_dir.is_dir():
        print(f"Team Loop directory does not exist: {team_dir}", file=sys.stderr)
        return 2

    event = load_payload(args.payload_json)
    for key, value in args.field:
        event[key] = value

    event.setdefault("schema", "dylan-team-loop.event.v1")
    event.setdefault("eventType", args.event_type)
    event.setdefault("timestamp", utc_now())

    if event["eventType"] != args.event_type:
        print("eventType in payload does not match --event-type", file=sys.stderr)
        return 2

    missing = [key for key in ("actor", "summary") if not event.get(key)]
    if missing:
        print(f"Missing required event fields: {', '.join(missing)}", file=sys.stderr)
        return 2

    target = team_dir / EVENT_FILES[args.event_type]
    with target.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, ensure_ascii=False, sort_keys=True) + "\n")

    print(json.dumps({"appended": str(target), "eventType": args.event_type}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

