#!/usr/bin/env python3
"""Check whether a project can create git worktrees for RelayLoop agents."""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path
from typing import Any


def git(project: Path, *args: str) -> tuple[int, str, str]:
    proc = subprocess.run(
        ["git", "-C", str(project), *args],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    return proc.returncode, proc.stdout.strip(), proc.stderr.strip()


def main() -> int:
    parser = argparse.ArgumentParser(description="Check RelayLoop worktree readiness.")
    parser.add_argument("--project-path", required=True)
    args = parser.parse_args()

    project = Path(args.project_path).expanduser().resolve()
    result: dict[str, Any] = {
        "projectPath": str(project),
        "exists": project.exists(),
        "isDirectory": project.is_dir(),
        "isGitRepository": False,
        "hasHead": False,
        "branch": None,
        "validBranchRef": False,
        "readyForWorktree": False,
        "recommendedCreateThreadEnvironment": "local",
        "reason": None,
        "nextAction": None,
    }

    if not project.exists() or not project.is_dir():
        result["reason"] = "project path is missing or not a directory"
        result["nextAction"] = "choose an existing project directory"
        print(json.dumps(result, indent=2))
        return 2

    code, stdout, stderr = git(project, "rev-parse", "--is-inside-work-tree")
    if code != 0 or stdout != "true":
        result["reason"] = stderr or "not a git repository"
        result["nextAction"] = "create local Agent threads or initialize git before requesting worktrees"
        print(json.dumps(result, indent=2))
        return 0

    result["isGitRepository"] = True

    code, stdout, _ = git(project, "branch", "--show-current")
    if code == 0 and stdout:
        result["branch"] = stdout

    code, stdout, stderr = git(project, "rev-parse", "--verify", "HEAD")
    if code != 0:
        result["reason"] = stderr or "HEAD is not a valid revision"
        result["nextAction"] = "create an initial commit before requesting worktree-backed Agents"
        print(json.dumps(result, indent=2))
        return 0

    result["hasHead"] = True
    head = stdout

    if result["branch"]:
        code, _, _ = git(project, "show-ref", "--verify", f"refs/heads/{result['branch']}")
        result["validBranchRef"] = code == 0
    else:
        result["reason"] = "detached HEAD or unnamed branch"
        result["nextAction"] = "use working-tree starting state or create local Agent threads"
        print(json.dumps(result, indent=2))
        return 0

    if not result["validBranchRef"]:
        result["reason"] = f"branch {result['branch']} is not a valid ref"
        result["nextAction"] = "create an initial commit before requesting worktree-backed Agents"
        print(json.dumps(result, indent=2))
        return 0

    result["head"] = head
    result["readyForWorktree"] = True
    result["recommendedCreateThreadEnvironment"] = "worktree"
    result["reason"] = "valid git HEAD and branch ref found"
    result["nextAction"] = "worktree-backed Dev/Test Agent threads may be created"
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

