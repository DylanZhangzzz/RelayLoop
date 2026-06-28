#!/usr/bin/env python3
"""Initialize a project-local RelayLoop workspace."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from textwrap import dedent


ROLES = ("pm", "dev", "test", "version", "review", "research", "ux", "fw", "ml")

DEFAULT_ROLES = ("pm", "dev", "test", "version", "review", "research", "ux")

FIRMWARE_TYPES = {"firmware", "embedded", "hardware", "fw"}

ML_TYPES = {"ml", "machine-learning", "machine_learning", "data-science", "datascience", "ai"}

APP_TYPES = {"app", "web", "mobile", "desktop", "saas"}

ROLE_NAMES = {
    "pm": "PM Agent",
    "dev": "Dev Agent",
    "test": "Test Agent",
    "version": "Version Agent",
    "review": "Review Agent",
    "research": "Research Agent",
    "ux": "UX Agent",
    "fw": "FW Agent",
    "ml": "ML Agent",
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
    "ml": "worktree",
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
    "ml": ["model-selection", "features", "training-strategy", "evaluation-interpretation"],
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
    "ml": [
        "systematic-debugging",
        "verification-before-completion",
        "test-driven-development",
        "market-research",
        "openai-docs",
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
    "ml": [
        "team-loop/knowledge/ml.md",
        "team-loop/knowledge/build-and-test.md",
        "team-loop/knowledge/architecture.md",
    ],
}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_roles(raw: str | None, project_type: str, include_fw: bool, include_ml: bool) -> list[str]:
    if raw:
        roles = [item.strip().lower() for item in raw.split(",") if item.strip()]
    else:
        roles = list(DEFAULT_ROLES)
        if include_fw or project_type.lower() in FIRMWARE_TYPES:
            roles.append("fw")
        if include_ml or project_type.lower() in ML_TYPES:
            roles.append("ml")

    unknown = sorted(set(roles) - set(ROLES))
    if unknown:
        raise SystemExit(f"Unknown roles: {', '.join(unknown)}")

    if "pm" not in roles:
        roles.insert(0, "pm")

    return list(dict.fromkeys(roles))


def record_action(actions: list[dict] | None, action: str, path: Path) -> None:
    if actions is not None:
        actions.append({"action": action, "path": str(path)})


def write_text(path: Path, content: str, force: bool, dry_run: bool = False, actions: list[dict] | None = None) -> None:
    existed = path.exists()
    if existed and not force:
        record_action(actions, "skip", path)
        return
    if dry_run:
        record_action(actions, "replace" if existed else "create", path)
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    record_action(actions, "replaced" if existed else "created", path)


def touch(path: Path, dry_run: bool = False, actions: list[dict] | None = None) -> None:
    if path.exists():
        record_action(actions, "skip", path)
        return
    if dry_run:
        record_action(actions, "create", path)
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.touch(exist_ok=True)
    record_action(actions, "created", path)


PROJECT_HARNESS_GUIDANCE = {
    "pm": (
        "- When Project Harness files exist, use `AGENTS.md`, `specs/project-spec.md`, "
        "and `specs/acceptance-criteria.md` in planning and dispatch.\n"
        "- Keep `team-loop/progress.md` updated after every loop iteration."
    ),
    "dev": (
        "- When Project Harness files exist, default to `AGENTS.md` and "
        "`specs/project-spec.md` before implementation."
    ),
    "test": (
        "- When Project Harness files exist, default to `specs/acceptance-criteria.md` "
        "as the acceptance/evidence contract."
    ),
    "review": (
        "- When Project Harness files exist, check diffs against `AGENTS.md`, "
        "`specs/project-spec.md`, and approval boundaries."
    ),
    "ux": (
        "- When Project Harness files exist, align with user scenarios and "
        "UX acceptance requirements in Project Harness files."
    ),
}


PROOF_GATED_GUIDANCE = {
    "pm": (
        "- Acceptance-First Dispatch is mandatory: every PM dispatch must include "
        "Task and Acceptance sections.\n"
        "- Acceptance must define the user-observable result, required commands or "
        "checks, required evidence files/pages/screenshots/logs, and how Test "
        "judges pass/fail.\n"
        "- Keep `team-loop/progress.md` updated after every loop iteration."
    ),
    "dev": (
        "- Implement against the PM's Acceptance section, not only the Task text.\n"
        "- Return the commands run and evidence produced so Test and Review can "
        "verify the same proof."
    ),
    "test": (
        "- Judge pass/fail against the PM's Acceptance section and report Result "
        "plus Evidence.\n"
        "- For UI tasks, start/open the app or route and use browser/Playwright/"
        "screenshot evidence. Include screenshot paths, viewport sizes, and "
        "operation steps.\n"
        "- Fail UI work for blank screens, overlapping text, broken controls, "
        "console errors, unusable flows, or visual regressions."
    ),
    "review": (
        "- Review code, architecture, regression risk, test quality, and any "
        "acceptance or proof gaps before approval."
    ),
    "ux": (
        "- For UI/product work, check the PM's Acceptance section against real "
        "user scenarios, visual quality, accessibility, and interaction evidence."
    ),
}


def profile_for(role: str, include_project_harness: bool = False) -> str:
    name = ROLE_NAMES[role]
    skills = "\n".join(f"- {skill}" for skill in RECOMMENDED_SKILLS[role])
    refs = "\n".join(f"- {ref}" for ref in KNOWLEDGE_REFS[role])
    responsibilities = "\n".join(f"- {item}" for item in RESPONSIBILITIES[role])
    project_harness_section = ""
    if include_project_harness and role in PROJECT_HARNESS_GUIDANCE:
        project_harness_section = (
            "\n## Project Harness Defaults\n\n"
            f"{PROJECT_HARNESS_GUIDANCE[role]}\n"
        )
    proof_gated_section = ""
    if role in PROOF_GATED_GUIDANCE:
        proof_gated_section = (
            "\n## Proof-Gated Loop\n\n"
            f"{PROOF_GATED_GUIDANCE[role]}\n"
        )

    return f"""# {name} Profile

## Role

{name} works inside RelayLoop. PM Agent is the only default Dylan-facing coordinator.

## Responsibilities

{responsibilities}

## Workspace Mode

`{WORKSPACE_MODES[role]}`

## Recommended Skills

{skills}

## Knowledge References

{refs}
{project_harness_section}{proof_gated_section}
## Message Contract

Read and respond to `RELAYLOOP_MESSAGE v1`. Respect `mode: task|goal|review`.

Return:

- Result: pass|fail|blocked when doing verification or review
- Summary
- Evidence
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
        # RelayLoop Protocol

        Use `RELAYLOOP_MESSAGE v1` for all cross-Agent messages.

        ## Proof-Gated Loop

        RelayLoop uses Acceptance-First Dispatch. PM must include `Task:` and
        `Acceptance:` in every task, goal, or review dispatch. Work is not done
        just because an Agent says it is done; Test and Review must verify the
        requested proof.

        Required fields:

        - `project`
        - `mode: task|goal|review`
        - `from_role`
        - `to_role`
        - `message_id`
        - `requires_response`
        - `response_to`
        - `priority`

        Required dispatch sections:

        - `Task:` the concrete implementation, research, review, or validation request.
        - `Acceptance:` the user-observable result, required commands/checks,
          required evidence files/pages/screenshots/logs, and how Test should
          judge pass/fail.
        - `Return Format:` result, evidence, files changed, commands run,
          risks/blockers, and next recommended action.

        UI task acceptance must require real app/browser verification when the
        app can run locally. Test must record the route, viewport, operations,
        screenshot paths, and console/runtime issues. Blank screens, overlapping
        text, broken controls, unusable flows, or visual regressions are failures.

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


def progress_file(project_name: str, roles: list[str], include_project_harness: bool = False) -> str:
    role_list = "\n".join(f"- {ROLE_NAMES[role]}: planned" for role in roles)
    next_action = "PM should create/register Agent threads after Dylan approval and update `agents.json`."
    if include_project_harness:
        next_action = (
            "PM should run grill-me discovery Q&A with Dylan, fill Project Harness files, "
            "then create/register Agent threads after Dylan approval."
        )
    return dedent(
        f"""\
        # {project_name} RelayLoop Progress

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

        {next_action}
        """
    )


def project_harness_agents_file(project_name: str) -> str:
    return dedent(
        f"""\
        # AGENTS.md

        harness status: needs_grill_me_confirmation

        ## Project Map

        AGENTS.md is a concise project map for coding agents, not a full manual. Keep detailed product requirements in `specs/project-spec.md` and acceptance proof in `specs/acceptance-criteria.md`.

        ## Grill-Me Discovery TODOs

        PM must grill Dylan before treating this Project Harness as complete:

        - Project goal: What does {project_name} do in one sentence?
        - Users and scenarios:
        - Tech stack and run commands:
        - Repo/module map:
        - Constraints and approval boundaries:
        - Acceptance evidence:

        ## Repository Outline

        - Product code:
        - Tests:
        - Documentation:
        - Scripts and tooling:
        - Generated/local-only output:

        ## Working Commands

        ```bash
        # Build:
        # Test:
        # Lint/format:
        # Full local verification:
        ```

        ## Development Constraints

        - Keep changes focused on the assigned task.
        - Preserve user edits and read existing files before patching.
        - Do not run destructive git commands unless explicitly requested.
        - Ask before changing credentials, signing, entitlements, infrastructure, or security settings.
        - Report verification commands and evidence before claiming completion.

        ## Detailed References

        - Product and delivery spec: `specs/project-spec.md`
        - Acceptance criteria and evidence contract: `specs/acceptance-criteria.md`
        """
    )


def project_harness_spec_file(project_name: str) -> str:
    return dedent(
        f"""\
        # Project Spec

        harness status: needs_grill_me_confirmation

        ## Source Of Truth

        This Project Harness spec is a pending placeholder until PM completes grill-me discovery Q&A with Dylan. PM must grill Dylan before treating these docs as complete.

        The grill-me pass must confirm: project goal, users/scenarios, tech stack/run commands, repo/module map, constraints/approval boundaries, and acceptance evidence.

        ## Project Goal

        - Product name: {project_name}
        - One-sentence purpose:
        - Success definition:

        ## Users And Scenarios

        - Primary users:
        - User problem:
        - Core scenarios:

        ## Version Scope

        | Version | Scope | Must ship | Deferred |
        | --- | --- | --- | --- |
        | v0.1 |  |  |  |

        ## Tech Stack And Run Commands

        - Frameworks/runtimes:
        - Package manager:
        - Build:
        - Test:
        - Lint/format:
        - Run locally:

        ## Repo And Module Map

        - Product code:
        - Tests:
        - Documentation:
        - Scripts and tooling:
        - Generated/local-only output:

        ## Architecture And Data Flow

        - Core mechanisms:
        - Inputs:
        - Processing:
        - State and storage:
        - Outputs:
        - Integrations:
        - Failure modes and recovery:

        ## UX And Visual Style

        - Product personality:
        - User journeys:
        - Navigation:
        - Component style:
        - Color, typography, imagery:
        - Accessibility:

        ## Constraints And Approval Boundaries

        - Constraints:
        - Security/privacy:
        - What agents must not edit without approval:
        - Human approval gates:
        - Out of scope:

        ## Acceptance Evidence

        - Commands:
        - Screenshots:
        - Logs:
        - Fixtures:
        - Manual checks:
        - Documented exceptions:

        ## Open Questions

        -
        """
    )


def project_harness_acceptance_file() -> str:
    return dedent(
        """\
        # Acceptance Criteria

        harness status: needs_grill_me_confirmation

        PM must grill Dylan before treating this acceptance contract as final. Align criteria with project goal, users/scenarios, tech stack/run commands, repo/module map, constraints/approval boundaries, and acceptance evidence.

        Every item must be concrete. Quantitative requirements need numbers. Qualitative requirements need a repeatable judgment method. Completion requires evidence.

        | ID | Requirement | Acceptance Method | Pass Threshold Or Judgment Method | Required Evidence | Status |
        | --- | --- | --- | --- | --- | --- |
        | AC-001 | PM completes discovery Q&A before implementation scope is treated as final | Review checklist | Dylan or PM confirms unanswered TODOs are resolved | Link to updated `specs/project-spec.md` and `AGENTS.md` diff | Pending |

        ## Evidence Rules

        - A command only counts if the agent reports exact command output.
        - A screenshot only counts if the path and target state are named.
        - A log only counts if the path and relevant event are named.
        - A fixture or manual check only counts if the scenario and result are documented.
        - A known limitation must be documented with impact and follow-up, not hidden.
        """
    )


def append_gitignore_entry(project_path: Path, entry: str, dry_run: bool, actions: list[dict]) -> None:
    path = project_path / ".gitignore"
    current = path.read_text(encoding="utf-8") if path.exists() else ""
    if entry in current.splitlines():
        record_action(actions, "skip", path)
        return
    if dry_run:
        record_action(actions, "append", path)
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        if current and not current.endswith("\n"):
            handle.write("\n")
        if current:
            handle.write("\n")
        handle.write(f"{entry}\n")
    record_action(actions, "appended", path)


def project_harness_files(project_name: str) -> dict[str, str]:
    return {
        "AGENTS.md": project_harness_agents_file(project_name),
        "specs/project-spec.md": project_harness_spec_file(project_name),
        "specs/acceptance-criteria.md": project_harness_acceptance_file(),
        "specs/modules/.gitkeep": "",
    }


def write_project_harness(project_path: Path, project_name: str, force: bool, dry_run: bool) -> list[dict]:
    actions: list[dict] = []
    for relative, content in project_harness_files(project_name).items():
        write_text(project_path / relative, content, force, dry_run, actions)
    append_gitignore_entry(project_path, ".agent-runs/", dry_run, actions)
    return actions


def project_harness_summary(enabled: bool, dry_run: bool, actions: list[dict], suggested: bool = False) -> dict:
    planned = sum(1 for item in actions if item["action"] in {"create", "replace", "append"})
    written = sum(1 for item in actions if item["action"] in {"created", "replaced", "appended"})
    skipped = sum(1 for item in actions if item["action"] == "skip")
    return {
        "enabled": enabled,
        "suggested": suggested,
        "mode": "dry-run" if dry_run else "write",
        "planned": planned,
        "written": written,
        "skipped": skipped,
        "actions": actions,
    }


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
    parser = argparse.ArgumentParser(description="Initialize a RelayLoop workspace inside a project.")
    parser.add_argument("--project-name", required=True)
    parser.add_argument("--project-path", required=True)
    parser.add_argument("--project-id")
    parser.add_argument("--project-type", default="software")
    parser.add_argument("--roles", help="Comma-separated roles. Defaults to PM,Dev,Test,Version,Review,Research,UX.")
    parser.add_argument("--include-fw", action="store_true", help="Include FW Agent.")
    parser.add_argument("--include-ml", action="store_true", help="Include ML Agent.")
    parser.add_argument("--include-project-harness", action="store_true", help="Create native Project Harness files: AGENTS.md and specs/.")
    parser.add_argument("--include-app-harness", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--create-project-dir", action="store_true", help="Create project path if it does not exist.")
    parser.add_argument("--dry-run", action="store_true", help="Show planned writes without creating files.")
    parser.add_argument("--force", action="store_true", help="Overwrite generated files.")
    args = parser.parse_args()

    project_path = Path(args.project_path).expanduser().resolve()
    if not project_path.exists():
        if args.create_project_dir and not args.dry_run:
            project_path.mkdir(parents=True)
        elif args.create_project_dir and args.dry_run:
            pass
        else:
            print(f"Project path does not exist: {project_path}", file=sys.stderr)
            return 2

    if project_path.exists() and not project_path.is_dir():
        print(f"Project path is not a directory: {project_path}", file=sys.stderr)
        return 2

    roles = parse_roles(args.roles, args.project_type, args.include_fw, args.include_ml)
    include_project_harness = args.include_project_harness or args.include_app_harness
    created_at = utc_now()
    team_dir = project_path / "team-loop"
    actions: list[dict] = []

    if not args.dry_run:
        for directory in (team_dir / "agent-profiles", team_dir / "knowledge"):
            directory.mkdir(parents=True, exist_ok=True)

    for role in ROLES:
        write_text(team_dir / "agent-profiles" / f"{role}.md", profile_for(role, include_project_harness), args.force, args.dry_run, actions)

    knowledge = {
        "architecture.md": "Architecture",
        "build-and-test.md": "Build And Test",
        "release.md": "Release",
        "design-system.md": "Design System",
        "hardware.md": "Hardware",
        "ml.md": "Machine Learning",
    }
    for filename, title in knowledge.items():
        write_text(team_dir / "knowledge" / filename, knowledge_file(title), args.force, args.dry_run, actions)

    for log_name in ("messages.ndjson", "commits.ndjson", "decisions.ndjson"):
        touch(team_dir / log_name, args.dry_run, actions)

    project_id = args.project_id or str(project_path)
    write_text(team_dir / "agents.json", json.dumps(agents_json(args.project_name, project_path, project_id, roles, created_at), indent=2) + "\n", args.force, args.dry_run, actions)
    write_text(team_dir / "progress.md", progress_file(args.project_name, roles, include_project_harness), args.force, args.dry_run, actions)
    write_text(team_dir / "protocol.md", protocol_file(), args.force, args.dry_run, actions)

    project_harness_actions = write_project_harness(project_path, args.project_name, args.force, args.dry_run) if include_project_harness else []
    project_harness_suggested = (not include_project_harness) and args.project_type.lower() in APP_TYPES
    next_action = "PM should create/register Agent threads after Dylan approval and update agents.json."
    if include_project_harness:
        next_action = "Run grill-me discovery Q&A with Dylan, then fill AGENTS.md and specs/ before implementation."
    elif project_harness_suggested:
        next_action = "This project type looks app-like; rerun with --include-project-harness to scaffold AGENTS.md and specs/."

    harness_summary = project_harness_summary(include_project_harness, args.dry_run, project_harness_actions, project_harness_suggested)

    print(
        json.dumps(
            {
                "teamLoopDir": str(team_dir),
                "roles": roles,
                "dryRun": args.dry_run,
                "actions": actions,
                "projectHarness": harness_summary,
                "nextAction": next_action,
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
