# review-code — llm-model-selection

改动面:modelCatalog.js / modelSelection.js / modelConfigService.js(新增)、llmProviders.js(重写)、providerFactory.js / openaiProvider.js / geminiProvider.js(改造)、ModelSelect.vue(新增)、App.vue(配置弹窗)、vitest 基建。

## 【① 底层前提】发现

- **已实测坐实**:Gemini list API 形态与 generateContent 过滤(dev 实连返回 38 项真实模型)、DeepSeek /models 形态(实连返回 v4 系 3 项)、选择持久化跨整页刷新存活、dev 模式 CORS 可用、无 key 状态(OpenAI 无 env key 时正确显示提示)。
- **未实测(如实记录)**:OpenAI list API 实连(本机无 key;形态为 OpenAI 标准 list,DeepSeek 兼容端已实证同形态);Customized 端点实连(无真实端点);**扩展模式 chrome.storage.sync/local 的对象往返**(dev 模式已证,扩展模式待装载验证——交付说明中列为手测项)。
- 新写注释的因果均已坐实(sync 配额、悬浮层被裁、per-request 模型解析)。

## 【② 可运行性】发现

- **BUG(上层逃逸,已修)**:`loadModelConfig` 无防护——扩展模式下 `getLocalValue`/存储读取瞬时失败会中断加载,选择停留默认 null,此时用户 Save 会把 null 写回存储,**覆盖真实选择(数据丢失路径)**。修复:逐段 try/catch,失败时保留内存值。该路径位于 App.vue 编排层,当前无组件测试 seam,无法单测——按诚实缺口记录,由手测覆盖(见 review-tests)。
- **已修(原型保真)**:ModelSelect 缺外点关闭(原型有该行为)。补 document 监听 + 卸载清理;浏览器实测:开→外点关→可重开。
- **缓办(自伤/自愈)**:全局 modelFetchSeq 为所有 provider 共享,customized 拉取会作废在途的内置 provider 拉取,后者状态滞留 'loading';但该状态仅在重新选中该 provider 时可见,而选中即触发重拉,自动恢复。见重构清单。
- 竞态守卫(spec #13)实现于 UI 层 seq 比对;保存路径 Promise.all 汇入既有流程;reactive proxy 经 setSelections 解构为普通对象后入 chrome.storage,无克隆问题。

## 【③ 安全正确性】结论:无发现

- 模型 ID 一律 Vue 插值渲染(纯文本,spec #11);key 仅发往对应 provider 端点;Gemini key 走 URL query 为该 API 文档规定方式;缓存/选择存储不含机密。

## 【④ 一致性】发现

- 未破坏既有不变量:CUSTOMIZED_CONFIG 形态未动、STORAGE_KEYS 未动、llmConfig store 流程未动;「大数据入 local」不变量被遵守(列表缓存 → local,选择 → sync)。
- 坏味道命中与豁免:
  - provider 条件分支集中于 modelCatalog 单模块(dispatch 属该模块职责)——豁免。
  - `loadModelsFor` 与 `fetchCustomizedModels`、`modelNote` 与 `customizedNote` 各有一对近似重复——进重构清单。
- **改动面外发现(只记不改,待定归宿)**:`src/api/openai.js`(Azure 直连遗留)全库零 import,疑似死代码;同样 `chatService.js` 的消费面与 `testStorage.js`/`testSecureStorage.js` 未核。影响面:无运行时影响,仅误导读者。建议:另开清理任务,按「否定结论换手段」全历史核实后删。**归宿需用户定**(建票 / 不做)。

## 类级判定

「注入 seam 缺失导致不可测」为类级(App.vue 编排函数均如此:loadModelConfig / loadModelsFor / fetchCustomizedModels / saveConfig 增量)——已全数枚举,处理一致:归手测 + 重构清单中记「编排层抽出可注入模块」为可选项。

## 重构清单(待用户确认,均不阻塞交付)

1. per-provider fetchSeq(替代全局 seq)——理由:状态滞留自愈但语义混浊;影响面:自伤;建议:另开小任务或随下次触碰顺改。
2. 合并 loadModelsFor/fetchCustomizedModels 与两个 note computed 的重复——理由:Duplicated Code;影响面:无行为差异;建议:不做(重复仅两处,合并需引入参数化反而增复杂)。
3. App.vue 模型编排抽为可注入组合式(补测试 seam)——理由:缺 seam 致 ① 中缺口;影响面:自伤;建议:另开任务,仅当后续该区域再演化时做。
