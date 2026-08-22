# final-regression — llm-model-selection

## 2026-08-23

### 阶段一 · 逐句核真(本轮触碰的声明面)

| 核对 | 对照 | 结论 |
|---|---|---|
| spec ↔ 实现 | 失败模式 23 条逐条走查 | 一致;实现期偏离(Vision 行按 supportsVision 渲染、15s 超时、OpenAI 过滤词表、supportsSpeech 删除)已回写 spec |
| spec 失败模式 ↔ 测试/缺口 | tests/*.test.js + 文件头缺口声明 | 逻辑侧 22 用例覆盖;UI 侧缺口逐条声明于测试文件头(见 review-tests) |
| spec ↔ features | 同 slug 两篇 | features 为 spec 用户可见层蒸馏,无互相矛盾、无 features 独有行为 |
| ADR ↔ spec/features | — | 按项目能力声明,ADR 未启用,该项跳过 |
| CONTEXT ↔ 全体 | — | 按项目能力声明,CONTEXT.md 未启用,该项跳过 |
| 原型 ↔ 实现 | docs/prototypes/llm-model-selection | Vision 行条件渲染已同步进原型(sync 而非标失效);其余界面点一致(外点关闭已补实现) |
| CLAUDE.md(同轮改写)| 当前代码 | 「无自动化测试」已成谎 → 已改写为 Vitest + 手测双轨;LLM 小节补模型选择一行 |

### 阶段二 · 关系对读(对照端在 diff、陈述端不在)

| 关系 | 核对 | 结论 |
|---|---|---|
| 文件 ↔ 索引行 | docs/specs/README.md、docs/features/README.md | 两个索引均含本功能行,一句话与正文一致 |
| 事实 ↔ 别处陈述 | 「模型固定/可选」相关措辞全库检索(docs/、README.md、src 文案) | root README 无模型枚举句;docs/intro.md 未陈述模型固定性,无需改 |
| 规则 ↔ 门禁 | .github 不存在 | 本仓库无 CI 门禁;测试仅本地跑——「该不该建门禁」作为发现提出(见下) |
| 规则 ↔ 模板复述 | — | 本轮未改带模板复述的规则 |

### 阶段三 · 事件核销(两端都不在 diff)

| 事件 | 波及 | 结论 |
|---|---|---|
| 引入自动化测试基建(成员数 0→1 的"验证手段"维度) | 陈述测试方式的文档 | CLAUDE.md 命中并已改(见阶段一);root README 无相关句 |
| 每 provider 模型从 1 个变为动态列表 | 枚举模型名的措辞 | 全库检索 gpt-4o/deepseek-chat/gemini-2.0-flash 于声明面:仅 spec/features 以「兜底默认」身份提及,定性正确 |
| `Pending:` 注记 | spec | 无 Pending 注记 |
| 本轮新拍通则 | — | 「滚动容器内下拉走文档流」已落 spec UI 结论(本项目声明面内的正本);无其他通则 |

### 发现(修不了当场修的,定归宿)

1. **docs/intro.md 陈述「Azure OpenAI」「Azure Speech Service」**——本轮之前已是过期陈述(非本轮造成),影响面:对外发布的介绍页误导用户。建议:另开文档清理任务(与 `src/api/openai.js` 死代码清理同批)。归宿待用户定。
2. **仓库无 CI 门禁**——现有 22 个单测仅本地跑,PR 无检查。建议:建 GitHub Actions 跑 `pnpm test` + `pnpm run build` 并设为必需检查(见 github-ops §8)。归宿待用户定。
