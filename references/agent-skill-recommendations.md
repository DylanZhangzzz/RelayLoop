# Agent Skill Recommendations

Use these as recommended or candidate skills in Agent profiles. Do not install third-party skills without Dylan approval.

## PM Agent

- Installed/local: `dylan-team-loop`, `brainstorming`, `writing-plans`, `executing-plans`, `subagent-driven-development`, `dispatching-parallel-agents`, `verification-before-completion`, `using-git-worktrees`.
- Candidate: `issue-triage`, `linear`, `notion-spec-to-implementation`, GitHub issue-driven workflows.

## Dev Agent

- Installed/local: `test-driven-development`, `systematic-debugging`, `using-git-worktrees`, `executing-plans`, `verification-before-completion`.
- Candidate: GitHub issue-driven development skills, platform-specific Swift/iOS/React skills.

## Test Agent

- Installed/local: `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `browser:control-in-app-browser`.
- Candidate: `playwright-interactive`, `webapp-testing`, `gh-fix-ci`.

## Version Agent

- Installed/local: `finishing-a-development-branch`, `verification-before-completion`, `github:yeet`, `github:gh-fix-ci`, `github:gh-address-comments`.
- Candidate: app-store changelog skills, release-note skills, PR review/CI fix skills.

## Review Agent

- Installed/local: `requesting-code-review`, `receiving-code-review`, `verification-before-completion`, `systematic-debugging`.
- Candidate: `brooks-lint`, `codebase-recon`, `pr-review-ci-fix`, firmware review skills.

## Research Agent

- Installed/local: `openai-docs`, `market-research`, `github:github`, `google-drive:google-drive`.
- Candidate: academic research, literature review, patent research, market/product research skills.

## UX Agent

- Installed/local: `design-taste-frontend`, `browser:control-in-app-browser`, `imagegen`, `playwright-interactive`.
- Candidate: `ui-ux-pro-max`, `frontend-design`, `web-design-guidelines`, `react-best-practices`, `composition-patterns`, `AccessLint`, React Native skills.

## FW Agent

- Installed/local: `systematic-debugging`, `verification-before-completion`, `test-driven-development`, `using-git-worktrees`.
- Candidate: embedded systems skills, firmware review skills, RTOS/FreeRTOS/Zephyr/Yocto skills.

## ML Agent

- Installed/local: `systematic-debugging`, `verification-before-completion`, `test-driven-development`, `market-research`, `openai-docs`, `using-git-worktrees`.
- Candidate: data science workflow skills, dataset profiling, notebook review, model evaluation, experiment tracking, MLOps release, vector search/RAG evaluation, and model monitoring skills.
- Evidence focus: dataset version, train/validation/test split, random seed, baseline metric, target metric, evaluation command, artifact path, confusion matrix or error slices, inference latency, resource usage, and data leakage checks.

## Third-Party Install Review Template

```text
Third-party skill install request
repo: <owner/repo URL>
ref: <tag or commit SHA>
skill: <skill name>
license: <license if known>

SKILL.md summary:
<short summary>

Scripts:
- <script path or none>

Permissions / supply-chain risks:
- <network, filesystem, shell, credential, or update risk>

Recommendation:
<install / do not install / install only after pinning>
```
