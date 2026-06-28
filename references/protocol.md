# RelayLoop Protocol

## Message Envelope

Every cross-Agent dispatch must use this searchable envelope:

```text
RELAYLOOP_MESSAGE v1
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
END_RELAYLOOP_MESSAGE
```

Append the same payload or a normalized JSON representation to `team-loop/messages.ndjson`.

Compatibility note: `RELAYLOOP_MESSAGE v1` is the canonical v1 protocol token. `team-loop/` is retained as the project-local storage directory for compatibility.

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

PM uses agent-first execution by default. For project work beyond tiny status checks or direct answers, PM dispatches `RELAYLOOP_MESSAGE v1` tasks to role Agents instead of performing the work inline.

PM may act inline only for:

- trivial read-only status checks;
- direct answers to Dylan that do not require project edits or specialist review;
- urgent admin clarification before safe routing is possible;
- cases where no live Agent thread exists for the needed role.

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

For implementation and documentation tasks, the expected default path is:

```text
PM -> Dev
PM -> Review + Test (+ UX when product flow, UI, accessibility, or visual quality is affected)
PM -> Dev repair loop if needed
PM -> Version for git/changelog/branch readiness checks and safe push decision
PM -> Dylan
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

Version Agent may create branches, commit, and update changelog/version files after PM approval. Version Agent may decide to push committed changes after it determines the branch is clean, scope is intended, checks have passed, and the push is not a branch merge/delete, public history rewrite, or formal release. It must not delete or merge branches, rewrite public history, or perform a formal release without Dylan confirmation.
