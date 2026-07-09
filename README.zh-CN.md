<div align="center">

# RelayLoop

**面向 Codex Agent 团队的 PM 主导工程循环**

RelayLoop 把一个目标转成可派发任务、可追踪项目状态、可验证交付证据和可审计 git 流程。

<br>

<a href="https://github.com/DylanZhangzzz/RelayLoop"><img src="https://img.shields.io/badge/platform-Codex_·_Claude_Code-111827?style=for-the-badge" alt="Codex and Claude Code platforms"></a>
<img src="https://img.shields.io/badge/status-Codex_first-2563eb?style=for-the-badge" alt="Codex first">
<img src="https://img.shields.io/badge/protocol-RELAYLOOP__MESSAGE_v1-059669?style=for-the-badge" alt="RELAYLOOP_MESSAGE v1">
<img src="https://img.shields.io/badge/workflow-PM_orchestrated-7c3aed?style=for-the-badge" alt="PM orchestrated">

<br>

[English](./README.md) | 简体中文

<br>

<img src="./assets/relayloop-hero.svg" alt="RelayLoop PM-led proof-gated engineering loop" width="920">

</div>

---

## 🚀 RelayLoop 是什么？

RelayLoop 是一个 **Codex-first、PM-led 的多 Agent 工程协作层**。

它不是泛泛的 agent framework，也不是 agent 群聊。用户把目标交给 PM Agent；PM 拆任务并写验收标准；Dev、Test、Review、Version、Research、UX 等角色各自执行；RelayLoop 进度文件（`relay-loop/progress.md`）持续记录项目状态；所有消息、决策和提交记录都落在仓库本地。

## ✨ 核心优势

- 🎯 **PM-led，不是群聊**：PM 负责拆解、派发、验收和汇报，角色职责清楚。
- 🔒 **Proof-Gated Loop**：每个任务都必须有验收标准和证据，不能只靠 agent 自称完成。
- 📝 **Acceptance-First Dispatch**：PM 下发任务时必须同时写清 Task 和 Acceptance。
- 📋 **项目状态不漂移**：RelayLoop 进度文件（`relay-loop/progress.md`）是 PM 维护的项目进度文件和单一事实源。
- 🧾 **repo-local 审计记录**：`messages.ndjson`、`decisions.ndjson`、`commits.ndjson` 记录派发、审批和版本动作。
- 🙋 **User-in-the-loop**：RelayLoop 不是全自动黑盒；用户仍然负责范围、审批、安全边界和最终信任。
- 🛡 **真实工程安全边界**：安装第三方技能、删/合并分支、重写公开历史、正式发布都需要用户确认。

## 📦 快速安装

### Codex Skill + 项目初始化

```bash
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

git clone --depth 1 https://github.com/DylanZhangzzz/RelayLoop.git "$tmp"
mkdir -p ~/.codex/skills/relayloop
rsync -a "$tmp"/ ~/.codex/skills/relayloop/
```

重启 Codex 或开启新的 Codex thread，让 skill 被发现。

初始化项目：

```bash
python3 ~/.codex/skills/relayloop/scripts/init_relay_loop.py \
  --project-name "ExampleProject" \
  --project-path /path/to/project
```

这会创建项目本地的 RelayLoop 工作区（`relay-loop/`），用于 Agent roster、消息日志、决策日志、提交日志、角色 profile 和 `progress.md`。

### Claude Code

同一个 skill 也可以在 Claude Code 下运行——安装到 `~/.claude/skills/`,初始化时加 `--adapter claude-code`:

```bash
mkdir -p ~/.claude/skills/relayloop
rsync -a "$tmp"/ ~/.claude/skills/relayloop/

python3 ~/.claude/skills/relayloop/scripts/init_relay_loop.py \
  --project-name "ExampleProject" \
  --project-path /path/to/project \
  --adapter claude-code
```

`--adapter claude-code` 会额外生成 `.claude/agents/relayloop-<role>.md` 子代理定义:主会话充当 PM Agent,向角色子代理派发 `RELAYLOOP_MESSAGE v1` 任务。协议、工作区和审计日志在两个平台完全一致。详见 [references/adapters/claude-code.md](./references/adapters/claude-code.md)。

> [!NOTE]
> **从旧版 `team-loop/` 迁移？** 早期版本的工作区目录叫 `team-loop/`。初始化脚本会自动检测并复用已有的 `team-loop/` 工作区，不会重复创建；CLI 也保留 `--team-loop-dir` 作为 `--relay-loop-dir` 的兼容别名。新项目一律创建 `relay-loop/`。

### 可选：安装 RelayLoop CLI

当前 npm GitHub 安装主要用于本地 specialist profile 导入辅助，不会自动安装 Codex skill，也不会创建完整 PM-led workflow。

```bash
npm install -g github:DylanZhangzzz/RelayLoop
relayloop --help
relayloop specialists import --help
```

## 🔒 Proof-Gated Loop

RelayLoop 的核心规则是：**没有证据，就不能算完成**。

PM 每次下发任务都必须包含：

- `Task:` 要做什么；
- `Acceptance:` 用户可观察结果是什么；
- 必须通过哪些命令或检查；
- 需要哪些文件、页面、截图或日志作为证据；
- Test Agent 如何判断 pass/fail。

默认流程：

```text
User objective
-> PM task breakdown + acceptance criteria
-> Dev / UX / Research / Specialist execution
-> Test actual acceptance with evidence
-> Review code / architecture / risk / proof gaps
-> PM routes failures back to Dev
-> repeat until accepted or stopped
-> Version git scope / checks / push judgment
-> PM reports User
```

UI 任务尤其不能只读代码。只要 app 可以本地运行，Test 就应该实际打开页面或 route，记录浏览器地址、viewport、操作步骤、截图路径和 console/runtime 问题。空白页面、文字重叠、控件不可用、console error、流程不可用或视觉回归都必须 fail。

## 🙋 User-in-the-loop

RelayLoop 默认保留用户在环。Agent 可以拆任务、实现、测试、审查和准备版本动作，但用户始终是决策负责人：决定范围、批准关键动作、确认安全边界，并对最终交付建立信任。PM 会把这些审批和决策记录到项目本地的进度文件和决策日志里，让自动化有证据、有边界、可追溯。

## 📋 RelayLoop 进度文件（`relay-loop/progress.md`）

RelayLoop 进度文件（`relay-loop/progress.md`）是 PM Agent 维护的 Project Progress File，也是多 Agent 协作的单一事实源。

它记录：

- 当前状态：`planned`、`assigned_dev`、`review_testing`、`changes_requested`、`approved`、`versioning`、`reported`；
- 当前 loop 轮次和上限；
- 每个 Agent 的状态；
- 最近派发的任务和返回结果；
- 阻塞项、风险、需要用户决策的事项；
- 下一步动作。

这让 RelayLoop 不依赖松散聊天记录，而是有状态、有证据、有审计记录的工程循环。

## ✉️ 协议

所有跨 Agent 消息使用：

```text
RELAYLOOP_MESSAGE v1
```

每条任务都应该包含 `Task:`、`Acceptance:` 和返回格式要求。完整协议、角色说明和 specialist adapter 设计请见英文 README 与 `references/` 目录。

## 🧩 当前支持

- Codex skill：✅ 当前支持（主要目标平台;threads 作为角色 Agent,worktrees 隔离 Dev/Test）
- Claude Code：✅ 当前支持（主会话为 PM,`relayloop-*` 子代理为角色;详见 [适配文档](./references/adapters/claude-code.md)）
- Hermes：🔜 预留未来适配

## 🗂 统一命名

RelayLoop 全面使用 RelayLoop 命名，`RELAYLOOP_MESSAGE v1` 是 canonical v1 协议名：

- `~/.codex/skills/relayloop`
- `relay-loop/`（项目本地工作区；兼容复用旧版 `team-loop/`）
- `relayloop.*` schema
- GitHub 仓库路径 `DylanZhangzzz/RelayLoop`

## 📄 许可证

RelayLoop 使用 Apache License 2.0。详见 [LICENSE](./LICENSE)。

---

<div align="center">
<sub>为想要多 Agent 速度、又不想丢掉工程主线的开发者而建。</sub>
</div>
