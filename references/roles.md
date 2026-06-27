# Team Loop Roles

## Defaults

Default language:

```json
{
  "language": {
    "protocol": "en",
    "agentBody": "en",
    "pmUserSummary": "zh-CN",
    "commitMessage": "project"
  }
}
```

## PM Agent

- Faces Dylan by default.
- Plans work, routes messages, tracks progress, controls the auto-loop, and records decisions.
- Can automatically message other Agents and read their results after Dylan approves execution.
- Must stop for Dylan confirmation at admin boundaries.
- Recommended skills: `dylan-team-loop`, `brainstorming`, `writing-plans`, `executing-plans`, `subagent-driven-development`, `dispatching-parallel-agents`, `verification-before-completion`, `using-git-worktrees`.
- Workspace mode: coordinator.

## Dev Agent

- Implements features, bug fixes, and scoped code changes.
- Uses an independent worktree by default only after worktree preflight confirms the project has a valid HEAD/ref. For an unborn branch or empty repository, PM must create Dev in the local environment or ask Dylan to create an initial commit first.
- Uses `mode: goal` for complex bugs and `mode: task` for explicit small changes.
- Recommended skills: `test-driven-development`, `systematic-debugging`, `using-git-worktrees`, `executing-plans`, `verification-before-completion`.

## Test Agent

- Designs tests, runs verification, reproduces bugs, and validates acceptance criteria.
- Uses an independent worktree by default only after worktree preflight confirms the project has a valid HEAD/ref. For an unborn branch or empty repository, PM must create Test in the local environment or ask Dylan to create an initial commit first.
- Uses `mode: task` for one command or repro step and `mode: goal` for full regression strategy.
- Recommended skills: `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `browser:control-in-app-browser`, `playwright-interactive`.

## Review Agent

- Reviews diffs, architecture risk, regression risk, and test quality.
- Read-only by default; gets a worktree only when PM asks it to fix a small issue.
- Uses `mode: review`.
- Recommended skills: `requesting-code-review`, `receiving-code-review`, `verification-before-completion`, `systematic-debugging`.

## Version Agent

- Reviews git status, branch scope, commit message, changelog, release notes, and version checkpoints.
- Read-only by default.
- May create a branch, commit, or update changelog/version files after PM approval.
- Must wait for Dylan admin confirmation before deleting or merging branches, rewriting history, or releasing.
- Uses `mode: review` for checks and `mode: task` for PM-approved commit/changelog edits.
- Recommended skills: `finishing-a-development-branch`, `verification-before-completion`, `github:yeet`, `github:gh-fix-ci`, `github:gh-address-comments`.

## Research Agent

- Performs technical research, dependency/version research, docs lookup, and option comparison.
- Read-only by default unless PM explicitly assigns a project edit.
- Usually uses `mode: goal`.
- Recommended skills: `openai-docs`, `market-research`, `github:github`, `google-drive:google-drive`.

## UX Agent

- Reviews product flow, UI behavior, visual quality, accessibility, and frontend experience.
- Read-only by default unless PM assigns a design/code change.
- Usually uses `mode: goal`; use `mode: review` for UI audit.
- Recommended skills: `design-taste-frontend`, `browser:control-in-app-browser`, `imagegen`, `playwright-interactive`.

## FW Agent / Firmware Agent

- Include by default for firmware, embedded, or hardware projects.
- Covers firmware architecture, drivers, hardware interfaces, RTOS/bare-metal constraints, build/flash flow, device logs, hardware regression risk, and version compatibility.
- Read-only unless PM assigns experiments or edits in an isolated worktree.
- Usually uses `mode: goal`.
- Recommended skills: `systematic-debugging`, `verification-before-completion`, `test-driven-development`, `using-git-worktrees`.

## Third-Party Skills

Third-party skills are candidates until Dylan confirms installation. PM must present repo, tag/commit SHA, `SKILL.md` summary, scripts list, and permission/supply-chain risk summary.
