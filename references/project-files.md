# Team Loop Project Files

## Directory

`scripts/init_team_loop.py` creates:

```text
team-loop/
  agent-profiles/
    pm.md
    dev.md
    test.md
    version.md
    review.md
    research.md
    ux.md
    fw.md
    ml.md
  knowledge/
    architecture.md
    build-and-test.md
    release.md
    design-system.md
    hardware.md
    ml.md
  agents.json
  messages.ndjson
  commits.ndjson
  decisions.ndjson
  progress.md
  protocol.md
```

## agents.json

Canonical registry for role threads:

```json
{
  "schema": "dylan-team-loop.agents.v1",
  "project": {
    "name": "ExampleProject",
    "projectPath": "/path/to/project",
    "projectId": "/path/to/project",
    "createdAt": "2026-06-27T00:00:00Z",
    "language": {
      "protocol": "en",
      "agentBody": "en",
      "pmUserSummary": "zh-CN",
      "commitMessage": "project"
    },
    "thirdPartySkillPolicy": "pm-may-recommend-dylan-must-approve",
    "autoLoop": {
      "enabledAfterPmApproval": true,
      "maxLoopIterations": 5,
      "stopOnRepeatedFailure": 2,
      "requireDylanForAdminActions": true
    }
  },
  "agents": [
    {
      "role": "dev",
      "name": "Dev Agent",
      "threadId": null,
      "hostId": null,
      "status": "planned",
      "workspaceMode": "worktree",
      "profilePath": "team-loop/agent-profiles/dev.md",
      "recommendedSkills": ["test-driven-development"],
      "knowledgeRefs": ["team-loop/knowledge/architecture.md"]
    }
  ]
}
```

When `codex_app.create_thread` returns a thread id, update the matching Agent entry.

## Worktree Preflight

Run this before creating any worktree-backed Agent:

```bash
python3 ~/.codex/skills/dylan-team-loop/scripts/check_worktree_ready.py --project-path /path/to/project
```

If `readyForWorktree` is false, do not call `codex_app.create_thread` with a worktree environment for Dev/Test. Common reasons:

- repository has no commits yet;
- `main` is an unborn branch and not a valid ref;
- the directory is not a git repository.

Fallbacks:

- ask Dylan to create an initial commit, then retry worktree creation;
- create the Agent in the local project environment until a valid HEAD exists.

## NDJSON Logs

Each line is one JSON object with at least:

```json
{
  "schema": "dylan-team-loop.event.v1",
  "eventType": "message",
  "timestamp": "2026-06-27T00:00:00Z",
  "actor": "pm",
  "summary": "Sent Dev a goal task"
}
```

Use:

- `messages.ndjson` for dispatches and response summaries.
- `commits.ndjson` for commit proposals, commits, branch actions, changelog edits, and version checks.
- `decisions.ndjson` for Dylan approvals, PM approvals, auto-loop decisions, scope changes, and blocked escalations.

## progress.md

Keep this human-readable and current:

- current state;
- loop iteration;
- active Agents;
- last messages;
- blockers;
- next action;
- approval requests waiting for Dylan.

## protocol.md

Copy the project-local protocol from `references/protocol.md` or the initializer's embedded template. Keep it in sync when the project customizes language or permissions.
