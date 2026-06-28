---
name: dylan-team-loop
description: PM-led multi-agent project orchestration for Codex. Use when Dylan wants a RelayLoop workspace, a PM Agent that coordinates Dev, Test, Review, Version, Research, UX, FW, and ML agents, automatic delivery loops, role-specific agent profiles, Codex thread IDs, message logs, commit logs, decision logs, or controlled installation of third-party skills.
---

# RelayLoop

## Overview

Use this skill to initialize and run a PM-led multi-agent project loop. Dylan talks to the PM Agent; the PM Agent creates or registers role Agents, routes `RELAYLOOP_MESSAGE v1` tasks, records every dispatch/result, and runs automatic loops after Dylan approves the plan.

Compatibility note: RelayLoop currently keeps the `dylan-team-loop` skill id and `team-loop/` project directory for existing Codex/project compatibility. `RELAYLOOP_MESSAGE v1` is the canonical v1 protocol envelope.

## Required References

Load only what is needed:

- `references/protocol.md`: message envelope, task modes, auto-loop rules, and approval boundaries.
- `references/roles.md`: default role profiles, worktree policy, and recommended skills.
- `references/project-files.md`: `team-loop/` file schemas and logging rules.
- `references/agent-skill-recommendations.md`: candidate third-party skills and install review template.

## Initialization Workflow

1. Confirm the target project with Dylan.
2. Before creating files or threads, show Dylan the proposed configuration:
   - project path and project id;
   - Agent list;
   - worktree policy;
   - language policy;
   - third-party skill policy;
   - whether FW Agent is included for firmware/embedded/hardware work;
   - whether ML Agent is included for machine-learning, data-science, or AI work.
3. Wait for Dylan approval.
4. Run `scripts/init_team_loop.py` to create the project-local `team-loop/` workspace.
5. Use `codex_app.list_projects` before creating project-scoped Agent threads.
6. Before creating any worktree-backed Agent, run `scripts/check_worktree_ready.py --project-path <project>`.
7. Use `codex_app.create_thread` only after Dylan has approved initial Agent creation or a later new role.
   - If worktree preflight reports `readyForWorktree: false`, do not request a worktree-backed Agent yet. Either ask Dylan to create an initial commit or create that Agent in the local project environment until a valid HEAD exists.
   - If preflight reports a valid `branch`, use that branch only when it exists. Do not assume `main`.
8. Write all returned thread IDs to `team-loop/agents.json`.
9. Use `codex_app.set_thread_title` with the RelayLoop title convention:
   - PM thread: `<project> - PM Agent`, because it may be pinned outside the project group.
   - Other project-scoped Agent threads: `<Role> Agent`, for example `Dev Agent`, `Test Agent`, `Review Agent`. Do not prefix them with the project name when they already appear under that project in the Codex sidebar.
   - Projectless or cross-project threads: `<project> - <Role> Agent`.
10. Use `codex_app.set_thread_pinned` for the PM thread and active delivery threads when useful.

Default workspace policy:

- Dev Agent: independent worktree.
- Test Agent: independent worktree.
- Review Agent: read-only unless PM explicitly grants a worktree for a small fix.
- Version Agent: read-only unless PM approves branch/commit/changelog changes.
- Research, UX, FW: read-only unless the task needs file edits or experiments.
- ML Agent: independent worktree by default for ML projects after worktree preflight confirms a valid HEAD/ref.

## PM Operating Loop

PM defaults to agent-first execution. For project work beyond tiny status checks or direct answers, PM should dispatch `RELAYLOOP_MESSAGE v1` tasks to the appropriate role Agents instead of doing the work inline.

PM may act inline only for:

- trivial read-only status checks;
- direct answers to Dylan that do not require project edits or specialist review;
- urgent admin clarification before safe routing is possible;
- cases where no live Agent thread exists for the needed role.

After Dylan and PM agree on a plan and Dylan approves execution, PM may automatically loop without asking Dylan at every step:

1. Send Dev a `mode: goal` or `mode: task` message for implementation or documentation edits.
2. When Dev returns, send Review and Test parallel `mode: review` or `mode: task` messages, and include UX when product flow, UI, accessibility, or visual quality is affected.
3. If Review, Test, or UX returns blocking feedback, summarize it and send it back to Dev.
4. Repeat Dev -> Review/Test/UX until required checks pass or a stop condition fires.
5. Send Version a `mode: review` message for git/changelog/branch readiness checks.
6. Let Version decide whether to push committed changes after it determines the branch is clean, scope is intended, checks have passed, and the push is not a branch merge/delete, public history rewrite, or formal release.
7. Report to Dylan in Chinese by default.

Stop the auto-loop and ask Dylan when:

- the same issue fails to converge for 2 loops;
- `maxLoopIterations` is reached, default 5;
- requirements, credentials, product decisions, hardware access, or admin actions are needed;
- the action is installing a third-party skill, deleting/merging a branch, rewriting public history, or making a formal release.

## Message Rules

All cross-Agent messages must use `RELAYLOOP_MESSAGE v1` and include `mode: task|goal|review`.

- Use `task` for one clear request with direct verification.
- Use `goal` when the Agent should decompose a complex objective.
- Use `review` for audit, validation, and risk discovery.

Append each sent message and response summary to `team-loop/messages.ndjson`. Update `team-loop/progress.md` after every loop iteration.

## Permission Boundaries

PM may automatically message Agents and read thread results. Dylan must confirm:

- initial Agent team creation;
- third-party skill installation;
- branch deletion or branch merge;
- public history rewrites;
- formal releases.

Version Agent may create a new branch, commit, or update changelog/version files only after PM approval. Version Agent may decide to push committed changes after readiness checks confirm the branch is clean, scope is intended, checks have passed, and the push is not a branch merge/delete, public history rewrite, or formal release. Deleting or merging branches, rewriting public history, formal releases, and third-party skill installation require Dylan confirmation.

## Scripts

- Initialize a project workspace:

```bash
python3 ~/.codex/skills/dylan-team-loop/scripts/init_team_loop.py \
  --project-name ExampleProject \
  --project-path /path/to/project
```

- Check whether a project can create worktree-backed Agents:

```bash
python3 ~/.codex/skills/dylan-team-loop/scripts/check_worktree_ready.py \
  --project-path /path/to/project
```

- Append logs:

```bash
python3 ~/.codex/skills/dylan-team-loop/scripts/log_relayloop_event.py \
  --team-loop-dir /path/to/project/team-loop \
  --event-type decision \
  --field actor=pm \
  --field summary="Dylan approved initial RelayLoop setup"
```
