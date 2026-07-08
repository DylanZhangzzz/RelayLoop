# RelayLoop Roadmap:竞争调研、优势分析与优化计划

> 更新时间:2026-07 · 状态:草案(待 User 审定)
>
> 本文档回答三个问题:目前的竞争格局是什么、RelayLoop 的真实优点在哪、
> 接下来按什么顺序优化才能拔高整个项目的意义。

---

## 一、竞争格局调研(2026 年中)

同类"指挥系统"分为五类,各自的强弱势直接决定 RelayLoop 该往哪里站:

| 类别 | 代表 | 他们强在哪 | 他们弱在哪(= 我们的空间) |
|---|---|---|---|
| **平台原生编排** | Codex App(多线程 + 内置 worktree + skills + subagents)、Claude Code Agent Teams(实验性)、VS Code 多 Agent | 原生体验、并行执行、官方维护 | 只管"跑起来",不管"怎么算做完"——没有验收契约、没有跨会话的项目状态、聊天记录即历史 |
| **任务指挥台** | GitHub Agent HQ / mission control(可指派 Anthropic/OpenAI/Google 等多家 Agent) | 一处指派、多 repo 并行、实时监控 | 状态锁在平台里;以 PR 为粒度,没有 PM 级的项目进度模型和证据门 |
| **通用框架** | LangGraph、CrewAI、AutoGen | 图编排、checkpoint、生态大 | 重:要写代码、要跑运行时;AutoGen 对话历史默认在内存;"群聊式"所有权模糊 |
| **群体编排 / 元框架** | claude-flow(已改名 Ruflo,约 5.9 万 star)、ccswarm、claude-swarm | 社区热度极高、swarm 拓扑、自学习路由 | 复杂度爆炸(Rust/WASM 内核、共识协议),与"轻量、可审计、人在环"相反;信任故事弱 |
| **方法论 / 契约层** | GitHub Spec Kit(Spec → Plan → Tasks → Implement,已接入 30+ Agent)、AGENTS.md 约定 | 把"规格"立为事实源,跨工具通用 | 只覆盖"开工前"(spec),不覆盖"过程中"(派发/状态)和"收工时"(证据/验收)——这正是 RelayLoop 的主场 |

**行业共识**:多篇 2026 年的对比文章指出,框架本身不是胜负手,胜负手是
**验证、可观测性和失败恢复**;同时只有约 6% 的公司敢完全信任 Agent 自主运行
核心流程。"信任缺口"是当前最大的空白市场。

## 二、RelayLoop 的真实优点(基于代码现状)

1. **Proof-Gated Loop 是稀缺品,且踩在行业最痛的点上。**
   平台都在解决"怎么并行跑更多 Agent",几乎没人解决"Agent 说做完了,凭什么信"。
   Acceptance-First Dispatch(Task + Acceptance 同时下发、Test/Review 凭证据裁决)
   直接回应了 2026 年"verification infrastructure"这个核心议题。
2. **Repo-local 持久状态是结构性差异。**
   `relay-loop/progress.md` + 三份 NDJSON 审计日志随 git 走:可版本化、可交接、
   可离线审计。对比:AutoGen 状态在内存、Agent HQ 状态在 GitHub 平台、
   聊天式系统状态在会话里。
3. **PM-led 明确所有权。**
   相比群聊式(AutoGen/CrewAI)和 swarm 式(claude-flow),"谁被派了什么、
   谁裁决、何时停下问人"在 RelayLoop 里是协议字段,不是涌现行为。
4. **轻量到极致。**
   无服务、无数据库、无运行时——一个 skill + 一个 Python 脚本 + 纯文本协议。
5. **安全边界是一等公民。**
   删/合分支、重写历史、正式发布、装第三方技能必须人批;specialist 导入默认
   dry-run、pin SHA、不执行外部脚本。在"6% 信任率"的环境里这是卖点不是限制。
6. **协议是纯文本的,天然可跨平台。**
   `RELAYLOOP_MESSAGE v1` 不依赖任何 API——这是被低估的资产。

## 三、必须正视的风险

- **平台正在吞掉"编排"层。** Codex 原生 subagents/worktrees、Claude Agent Teams、
  Agent HQ 都在做"多 Agent 并行"。如果 RelayLoop 的定位停留在"帮 Codex 管线程",
  会被平台迭代碾过。
- **单平台绑定与协议可移植性矛盾。** 最有价值的东西(协议 + 状态 + 证据)不依赖
  Codex,但目前只有 Codex 适配落地。
- **协议靠自觉,没有工具执行。** PM"应该"更新 progress.md、"应该"写 Acceptance——
  没有 validator/linter 兜底,协议会在实践中降解。
- **证据还是"文本承诺"。** Evidence 字段目前是自然语言,没有机器可校验的部分
  (命令退出码、文件哈希、截图存在性)。
- **没有度量故事。** ndjson 里躺着 loop 次数、pass/fail、返工率,但没有工具把它
  变成"这个团队跑得好不好"的答案。

## 四、定位策略:拔高项目意义

**从"Codex 的多 Agent 玩法"拔高为:"Agent 团队工作的交付契约层
(evidence-gated delivery protocol)"。**

一句话叙事:

> **平台负责把 Agent 跑起来,RelayLoop 负责让 Agent 的工作可证明。**

类比:Spec Kit 想成为"开工前"的标准,AGENTS.md 是"环境约定"的标准,而
"过程与验收"层还没有标准——`RELAYLOOP_MESSAGE v1` + `relay-loop/` 工作区就去占
这个位。这样平台的每一次进步(更强的线程、更多的 Agent)都变成 RelayLoop 的
顺风而不是威胁。

## 五、优化计划

### P0 · 立刻做(2–4 周):把协议从"约定"变成"工具"

| # | 事项 | 说明 | 验收标准 |
|---|---|---|---|
| P0-1 | `relayloop validate` | 校验 `messages.ndjson` / `progress.md` / `agents.json` 是否符合协议:信封字段齐全、每条 dispatch 有 Acceptance、每个 pass 有 Evidence;发布 `relayloop.message.v1` JSON Schema | 对示例工作区跑通;坏样例给出可读报错;schema 文件入库并有测试 |
| P0-2 | `relayloop status` | 从工作区渲染当前状态摘要(状态机、轮次、阻塞、待批事项),把 progress.md 从"PM 手写"变成"可再生成 + 可校验" | 在 demo 工作区输出正确摘要;有测试 |
| P0-3 | Demo 仓库 + 演示 | 一个可跑的示例项目 + README 内 60 秒流程演示(GIF/录屏) | 新用户 10 分钟内跑完首个 loop |

### P1 · 下一步(1–2 个月):把"证据"机器化,打开第二平台

| # | 事项 | 说明 | 验收标准 |
|---|---|---|---|
| P1-1 | Evidence Manifest | Test 返回时附结构化清单(命令 + 退出码、文件哈希、截图路径);`relayloop verify` 可重放验收命令 | pass 结果可被第三方重放核验 |
| P1-2 | Claude Code 适配器 | README 中已 reserved;skill 体系高度相似,Agent Teams 恰好缺这层契约,是投入产出比最高的扩张 | 同一工作区可被 Codex 与 Claude Code 双端驱动 |
| P1-3 | Spec Kit / AGENTS.md 互操作 | Project Harness(AGENTS.md + specs/)与两者同构;补互操作文档 + 字段映射,借生态的势 | 有映射文档;Spec Kit 项目可无损接入 RelayLoop 循环 |
| P1-4 | `relayloop report` | 从 ndjson 生成度量:平均 loop 轮次、一次通过率、返工原因分布 | 对历史工作区生成可读报告 |

### P2 · 季度级:站稳"契约层"生态位

| # | 事项 | 说明 |
|---|---|---|
| P2-1 | 多平台一致性测试(conformance suite) | 任何 harness(Codex / Claude Code / 未来 Agent HQ 自定义 Agent)只要能读写 `relay-loop/` 并遵守信封即算兼容 |
| P2-2 | 零服务 Dashboard | 从 ndjson 生成静态 HTML 看板,坚持"无运行时"承诺的同时补上可视化短板 |
| P2-3 | Specialist 生态 | 与多 harness 插件市场(如 wshobson/agents)对接,复用其角色库;RelayLoop 只做安全导入 + 契约包装(现有 CLI 已是雏形) |

### 北极星指标

不追 star 数,追两个数字——它们本身就是产品叙事:

- **证据完备率**:有多少比例的 done 任务带可重放证据;
- **一次验收通过率**:Dev 交付一次即通过 Test/Review 的比例。

## 附:调研来源

- [LangGraph vs CrewAI vs AutoGen 对比(2026)](https://dev.to/pockit_tools/langgraph-vs-crewai-vs-autogen-the-complete-multi-agent-ai-orchestration-guide-for-2026-2d63)
- [2026 Agent 框架综述](https://alicelabs.ai/en/insights/best-ai-agent-frameworks-2026)
- [Claude Code Agent Teams 文档](https://code.claude.com/docs/en/agent-teams)
- [Codex App 发布公告](https://openai.com/index/introducing-the-codex-app/)
- [Codex Subagents](https://developers.openai.com/codex/subagents)
- [GitHub Agent HQ 发布](https://github.blog/news-insights/company-news/welcome-home-agents/)
- [GitHub mission control 用法](https://github.blog/ai-and-ml/github-copilot/how-to-orchestrate-agents-using-mission-control/)
- [GitHub Spec Kit](https://github.com/github/spec-kit)
- [claude-flow / Ruflo](https://github.com/ruvnet/ruflo)
- [ccswarm](https://github.com/nwiizo/ccswarm)
- [Agent 自主性五级模型(Swarmia)](https://www.swarmia.com/blog/five-levels-ai-agent-autonomy/)
- [Agent 验证基础设施](https://www.curationai.ai/post/autonomous-ai-agents-cannot-scale-safely-without-verification-infrastructure)
- [MetaGPT](https://github.com/FoundationAgents/MetaGPT)
- [ChatDev 2.0](https://github.com/openbmb/ChatDev)
