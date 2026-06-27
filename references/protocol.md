# Team Loop Protocol

## Message Envelope

Every cross-Agent dispatch must use this searchable envelope:

```text
TEAMLOOP_MESSAGE v1
project: <project-name>
mode: <task|goal|review>
from_role: <pm|dev|test|version|review|research|ux|fw|ml>
to_role: <pm|dev|test|version|review|research|ux|fw|ml>
message_id: <timestamp-role-counter>
requires_response: <yes|no>
response_to: <message_id or none>
priority: <low|normal|high|urgent>

Context:
<short context>

Task:
<concrete request>

Acceptance:
- <observable result>
- <verification command or evidence required>

Return Format:
- Summary
- Files changed
- Commands run
- Risks/blockers
- Next recommended action
END_TEAMLOOP_MESSAGE
```

Append the same payload or a normalized JSON representation to `team-loop/messages.ndjson`.

## Task Modes

- `task`: a single clear request with direct verification. Examples: run one command, inspect one file, check `git status`.
- `goal`: an objective where the receiving Agent may decompose steps. Examples: fix a complex bug, implement a feature, investigate a firmware issue.
- `review`: audit, validation, or risk discovery. Examples: code review, acceptance verification, commit-range review.

Default route choices:

- Dev complex bug: `goal`
- Dev small explicit change: `task`
- Test one command or repro step: `task`
- Test full regression or test strategy: `goal`
- Review diff: `review`
- Version git/changelog/branch check: `review`
- Research open-ended investigation: `goal`
- UX product flow work: `goal`
- FW hardware/firmware diagnosis: `goal`
- ML model selection, feature work, training strategy, or evaluation interpretation: `goal`
- ML metric, leakage, or reproducibility review: `review`

## Auto-Loop

After Dylan approves a PM plan, PM may automatically run:

```text
PM -> Dev -> PM
PM -> Review + Test -> PM
PM -> Dev repair loop
PM -> Version -> PM
PM -> Dylan
```

State sequence:

```text
planned
-> assigned_dev
-> dev_done
-> review_testing
-> changes_requested
-> assigned_dev
-> review_testing
-> approved
-> versioning
-> committed_or_ready
-> reported
```

Default configuration:

```json
{
  "autoLoop": {
    "enabledAfterPmApproval": true,
    "maxLoopIterations": 5,
    "stopOnRepeatedFailure": 2,
    "requireDylanForAdminActions": true
  }
}
```

Stop and ask Dylan when:

- the same problem does not converge for two loops;
- loop count reaches `maxLoopIterations`;
- the Agent reports unclear requirements, missing credentials, missing hardware, or a product decision;
- the operation needs Dylan admin confirmation.

## Approval Boundaries

PM can automatically message Agents and read results. Dylan must confirm:

- initial Agent team creation;
- third-party skill installation;
- branch deletion or merge;
- public history rewrites;
- formal releases.

Version Agent may create branches, commit, and update changelog/version files after PM approval. It must not delete or merge branches without Dylan confirmation.
