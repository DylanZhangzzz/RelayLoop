# Specialist Adapter Architecture

## Purpose

RelayLoop is the team operating system: PM-led dispatch, project state, audit logs, approval gates, and Codex execution. Optional specialist libraries such as `agency-agents` can act as a specialist talent pool, but RelayLoop keeps ownership of coordination and state.

This document describes the specialist adapter model. The current implementation is the RelayLoop CLI, with `bin/relayloop.js` as the source checkout entrypoint. It imports approved local Markdown only and does not fetch remote content or run upstream scripts.

At the reviewed upstream source, `agency-agents` describes itself as a collection of AI agent personalities and specialist agents. Its README reports 232 specialized agents across 16 divisions, with Markdown/profile-style agent definitions and Codex integration docs that generate standalone TOML custom-agent files for `~/.codex/agents/`. RelayLoop may adapt reviewed profile content, but should not run third-party conversion or install scripts by default.

## Adapter Model

External persona/profile -> RelayLoop `SpecialistProfile`.

A `SpecialistProfile` is a normalized wrapper around a third-party persona. It records source metadata, RelayLoop role identity, safety defaults, and the response contract required for PM dispatch.

Proposed project layout:

```text
team-loop/
  specialists.json
  agent-profiles/
    specialists/
      security-engineer.md
      technical-writer.md
  vendor/
    agency-agents.lock.json
```

The proposed `team-loop/vendor/` area stores lock/source metadata only. It does not mean vendoring executable scripts or third-party code by default.

## Sample SpecialistProfile

```json
{
  "schema": "dylan-team-loop.specialist-profile.v1",
  "id": "security-engineer",
  "displayName": "Security Engineer",
  "source": {
    "name": "agency-agents",
    "type": "github",
    "repository": "https://github.com/msitarzewski/agency-agents",
    "ref": "<pinned-commit-sha>",
    "path": "<source-profile-path>",
    "license": "MIT",
    "sourceFormat": "markdown",
    "scriptReview": "not-run",
    "contentHash": "<sha256>",
    "importedAt": "<timestamp>",
    "importedBy": "Dylan"
  },
  "workspaceMode": "readonly",
  "allowedModes": ["task", "goal", "review"],
  "profilePath": "team-loop/agent-profiles/specialists/security-engineer.md",
  "requiresRelayLoopEnvelope": true,
  "status": "available"
}
```

## Wrapped Profile Shape

```markdown
# Security Engineer Specialist

## RelayLoop Contract

You are an optional Specialist Agent inside RelayLoop. Respond only to `RELAYLOOP_MESSAGE v1` tasks from PM. Return Summary, Files changed, Commands run, Risks/blockers, and Next recommended action. Default to read-only unless PM explicitly grants edit scope.

## Source Metadata

- Source repository: https://github.com/msitarzewski/agency-agents
- Pinned ref: <pinned-commit-sha>
- Source path: <source-profile-path>
- License review: MIT license and no-warranty terms reviewed
- Script policy: external convert/install scripts not run by default

## Original Specialist Profile

<approved profile content or concise adapted excerpt>

## RelayLoop Footer

Do not install dependencies, run external scripts, change files, or contact external services unless PM explicitly assigns that scope and Dylan approval has covered the third-party boundary.
```

## PM Dispatch Flow

1. PM identifies a need for a specialist, such as security review, backend architecture, UX research, technical writing, or performance analysis.
2. PM checks `team-loop/specialists.json` for an approved SpecialistProfile.
3. If no approved specialist exists, PM asks Dylan before importing or adapting a third-party profile.
4. PM dispatches a `RELAYLOOP_MESSAGE v1` task or review to the Specialist Agent.
5. The Specialist replies with the standard RelayLoop return fields.
6. PM records the dispatch/result in `messages.ndjson`, updates `progress.md`, and routes any follow-up to Dev, Review, Test, UX, or Version.

## Local Import CLI

Use the installed CLI or the local checkout entrypoint:

```bash
relayloop specialists import \
  --team-loop-dir /path/to/project/team-loop \
  --profile-file /path/to/approved-profile.md \
  --id security-engineer \
  --display-name "Security Engineer" \
  --source-name agency-agents \
  --source-repo https://github.com/msitarzewski/agency-agents \
  --source-ref 0123456789abcdef0123456789abcdef01234567 \
  --source-path engineering/security-engineer.md \
  --license MIT
```

From a checkout, use `node bin/relayloop.js specialists import ...`.

Default mode is dry-run and writes no files. `--profile-file` must be a local `.md` or `.markdown` file. `--write` requires `--approved-by Dylan` exactly and a 40-character hexadecimal source ref. Duplicate specialist IDs and existing wrapped profile files fail unless `--force` is provided.

## Safety Gates

- Dylan approval is required before third-party specialist import or install.
- Every imported source must be pinned to a commit SHA or immutable release ref.
- Store repository, ref, path, and license/source metadata in a lock file.
- Treat Markdown agent profiles as non-executable prompt definitions.
- Treat shell scripts, converters, and installers as executable code requiring review before use.
- Do not execute external scripts by default.
- Specialists are read-only by default.
- Specialists must respond through `RELAYLOOP_MESSAGE v1`.
- Branch deletion, branch merge, public history rewrite, formal release, and third-party skill installation remain Dylan-confirmation actions.

## Proposed Future CLI

These commands are ideas, not implemented:

```bash
relayloop specialists search <query>
relayloop specialists import agency-agents/security-engineer --ref <commit-sha>
relayloop specialists list
```

Any future CLI must preserve the safety gates above and avoid external script execution during search or import unless Dylan explicitly approves it.
