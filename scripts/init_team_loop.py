#!/usr/bin/env python3
"""Initialize a project-local Dylan Team Loop workspace."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from textwrap import dedent


ROLES = ("pm", "dev", "test", "version", "review", "research", "ux", "fw")

DEFAULT_ROLES = ("pm", "dev", "test", "version", "review", "research", "ux")

FIRMWARE_TYPES = {"firmware", "embedded", "hardware", "fw"}

ROLE_NAMES = {
    "pm": "PM Agent",
    "dev": "Dev Agent",
    "test": "Test Agent",
    "version": "Version Agent",
    "review": "Review Agent",
    "research": "Research Agent",
    "ux": "UX Agent",
    "fw": "FW Agent",
}

WORKSPACE_MODES = {
    "pm": "coordinator",
    "dev": "worktree",
    "test": "worktree",
    "review": "readonly",
    "version": "readonly",
    "research": "readonly",
    "ux": "readonly",
    "fw": "readonly",
}

RESPONSIBILITIES = {
    "pm": ["plan", "route", "status", "acceptance", "auto-loop"],
    "dev": ["implementation", "bugfix", "code-change"],
    "test": ["test-design", "verification", "reproduction"],
    "version": ["git-status", "commit-scope", "changelog", "release-check"],
    "review": ["code-review", "architecture-risk", "regression-risk"],
    "research": ["technical-research", "dependency-research", "docs-lookup"],
    "ux": ["product-flow", "ui-behavior", "accessibility", "visual-quality"],
    "fw": ["firmware", "hardware-interface", "rtos", "device-logs"],
}

RECOMMENDED_SKILLS = {
    "pm": [
        "dylan-team-loop",
        "brainstorming",
        "writing-plans",
        "executing-plans",
        "subagent-driven-development",
        "dispatching-parallel-agents",
        "verification-before-completion",
        "using-git-worktrees",
    ],
    "dev": [
        "test-driven-development",
        "systematic-debugging",
        "using-git-worktrees",
        "executing-plans",
        "verification-before-completion",
    ],
    "test": [
        "test-driven-development",
        "systematic-debugging",
        "verification-before-completion",
        "browser:control-in-app-browser",
        "playwright-interactive",
    ],
    "version": [
        "finishing-a-development-branch",
        "verification-before-completion",
        "github:yeet",
        "github:gh-fix-ci",
        "github:gh-address-comments",
    ],
    "review": [
        "requesting-code-review",
        "receiving-code-review",
        "verification-before-completion",
        "systematic-debugging",
    ],
    "research": [
        "openai-docs",
        "market-research",
        "github:github",
        "google-drive:google-drive",
    ],
    "ux": [
        "design-taste-frontend",
        "browser:control-in-app-browser",
        "imagegen",
        "playwright-interactive",
    ],
    "fw": [
        "systematic-debugging",
        "verification-before-completion",
        "test-driven-development",
        "using-git-worktrees",
    ],
}

KNOWLEDGE_REFS = {
    "pm": [
        "team-loop/knowledge/architecture.md",
        "team-loop/knowledge/build-and-test.md",
        "team-loop/knowledge/release.md",
    ],
    "dev": [
        "team-loop/knowledge/architecture.md",
        "team-loop/knowledge/build-and-test.md",
    ],
    "test": [
        "team-loop/knowledge/build-and-test.md",
        "team-loop/knowledge/architecture.md",
    ],
    "version": [
        "team-loop/knowledge/release.md",
        "team-loop/knowledge/build-and-test.md",
    ],
    "review": [
        "team-loop/knowledge/architecture.md",
        "team-loop/knowledge/build-and-test.md",
    ],
    "research": [
        "team-loop/knowledge/architecture.md",
    ],
    "ux": [
        "team-loop/knowledge/design-system.md",
        "team-loop/knowledge/architecture.md",
    ],
    "fw": [
        "team-loop/knowledge/hardware.md",
        "team-loop/knowledge/build-and-test.md",
    ],
}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_roles(raw: str | None, project_type: str, include_fw: bool) -> list[str]:
    if raw:
        roles = [item.strip().lower() for item in raw.split(",") if item.strip()]
    else:
        roles = list(DEFAULT_ROLES)
        if include_fw or project_type.lower() in FIRMWARE_TYPES:
            roles.append("fw")

    unknown = sorted(set(roles) - set(ROLES))
    if unknown:
        raise SystemExit(f"Unknown roles: {', '.join(unknown)}")

    if "pm" not in roles:
        roles.insert(0, "pm")

    return list(dict.fromkeys(roles))


def write_text(path: Path, content: str, force: bool) -> None:
    if path.exists() and not force:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def touch(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.touch(exist_ok=True)


def profile_for(role: str) -> str:
    name = ROLE_NAMES[role]
    skills = "\n".join(f"- {skill}" for skill in RECOMMENDED_SKILLS[role])
    refs = "\n".join(f"- {ref}" for ref in KNOWLEDGE_REFS[role])
    responsibilities = "\n".join(f"- {item}" for item in RESPONSIBILITIES[role])

    return dedent(
        f"""\
        # {name} Profile

        ## Role

        {name} works inside Dylan Team Loop. PM Agent is the only default Dylan-facing coordinator.

        ## Responsibilities

        {responsibilities}

        ## Workspace Mode

        `{WORKSPACE_MODES[role]}`

        ## Recommended Skills

        {skills}

        ## Knowledge References

        {refs}

        ## Message Contract

        Read and respond to `TEAMLOOP_MESSAGE v1`. Respect `mode: task|goal|review`.

        Return:

        - Summary
        - Files changed
        - Commands run
        - Risks/blockers
        - Next recommended action

        ## Guardrails

        - Do not install third-party skills without Dylan confirmation.
        - Do not perform admin git actions without Dylan confirmation.
        - Report uncertainty and blockers to PM instead of guessing.
        - Use English for Agent-to-Agent body text unless project config says otherwise.
        """
    )


def knowledge_file(title: str) -> str:
    return dedent(
        f"""\
        # {title}

        Add project-specific knowledge here. Keep this file concise and factual.
        """
    )


def protocol_file() -> str:
    return dedent(
        """\
        # Team Loop Protocol

        Use `TEAMLOOP_MESSAGE v1` for all cross-Agent messages.

        Required fields:

        - `project`
        - `mode: task|goal|review`
        - `from_role`
        - `to_role`
        - `message_id`
        - `requires_response`
        - `response_to`
        - `priority`

        Default loop:

        ```text
        PM -> Dev -> PM
        PM -> Review + Test -> PM
        PM -> Dev repair loop
        PM -> Version -> PM
        PM -> Dylan
        ```

        Stop for Dylan confirmation before installing third-party skills, deleting or merging branches, rewriting public history, or formal releases.
        """
    )


def progress_file(project_name: str, roles: list[str]) -> str:
    role_list = "\n".join(f"- {ROLE_NAMES[role]}: planned" for role in roles)
    return dedent(
        f"""\
        # {project_name} Team Loop Progress

        ## State

        planned

        ## Loop

        - iteration: 0
        - maxLoopIterations: 5
        - stopOnRepeatedFailure: 2

        ## Agents

        {role_list}

        ## Blockers

        None recorded.

        ## Next Action

        PM should create/register Agent threads after Dylan approval and update `agents.json`.
        """
    )


def agents_json(project_name: str, project_path: Path, project_id: str, roles: list[str], created_at: str) -> dict:
    return {
        "schema": "dylan-team-loop.agents.v1",
        "project": {
            "name": project_name,
            "projectPath": str(project_path),
            "projectId": project_id,
            "createdAt": created_at,
            "language": {
                "protocol": "en",
                "agentBody": "en",
                "pmUserSummary": "zh-CN",
                "commitMessage": "project",
            },
            "thirdPartySkillPolicy": "pm-may-recommend-dylan-must-approve",
            "autoLoop": {
                "enabledAfterPmApproval": True,
                "maxLoopIterations": 5,
                "stopOnRepeatedFailure": 2,
                "requireDylanForAdminActions": True,
            },
        },
        "agents": [
            {
                "role": role,
                "name": ROLE_NAMES[role],
                "threadId": None,
                "hostId": None,
                "status": "planned",
                "workspaceMode": WORKSPACE_MODES[role],
                "profilePath": f"team-loop/agent-profiles/{role}.md",
                "recommendedSkills": RECOMMENDED_SKILLS[role],
                "knowledgeRefs": KNOWLEDGE_REFS[role],
                "responsibilities": RESPONSIBILITIES[role],
                "skillReviewRequired": True,
                "lastContactAt": None,
            }
            for role in roles
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Initialize a Team Loop workspace inside a project.")
    parser.add_argument("--project-name", required=True)
    parser.add_argument("--project-path", required=True)
    parser.add_argument("--project-id")
    parser.add_argument("--project-type", default="software")
    parser.add_argument("--roles", help="Comma-separated roles. Defaults to PM,Dev,Test,Version,Review,Research,UX.")
    parser.add_argument("--include-fw", action="store_true", help="Include FW Agent.")
    parser.add_argument("--create-project-dir", action="store_true", help="Create project path if it does not exist.")
    parser.add_argument("--force", action="store_true", help="Overwrite generated files.")
    args = parser.parse_args()

    project_path = Path(args.project_path).expanduser().resolve()
    if not project_path.exists():
        if args.create_project_dir:
            project_path.mkdir(parents=True)
        else:
            print(f"Project path does not exist: {project_path}", file=sys.stderr)
            return 2

    if not project_path.is_dir():
        print(f"Project path is not a directory: {project_path}", file=sys.stderr)
        return 2

    roles = parse_roles(args.roles, args.project_type, args.include_fw)
    created_at = utc_now()
    team_dir = project_path / "team-loop"

    for directory in (team_dir / "agent-profiles", team_dir / "knowledge"):
        directory.mkdir(parents=True, exist_ok=True)

    for role in ROLES:
        write_text(team_dir / "agent-profiles" / f"{role}.md", profile_for(role), args.force)

    knowledge = {
        "architecture.md": "Architecture",
        "build-and-test.md": "Build And Test",
        "release.md": "Release",
        "design-system.md": "Design System",
        "hardware.md": "Hardware",
    }
    for filename, title in knowledge.items():
        write_text(team_dir / "knowledge" / filename, knowledge_file(title), args.force)

    for log_name in ("messages.ndjson", "commits.ndjson", "decisions.ndjson"):
        touch(team_dir / log_name)

    project_id = args.project_id or str(project_path)
    write_text(team_dir / "agents.json", json.dumps(agents_json(args.project_name, project_path, project_id, roles, created_at), indent=2) + "\n", args.force)
    write_text(team_dir / "progress.md", progress_file(args.project_name, roles), args.force)
    write_text(team_dir / "protocol.md", protocol_file(), args.force)

    print(json.dumps({"teamLoopDir": str(team_dir), "roles": roles}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

