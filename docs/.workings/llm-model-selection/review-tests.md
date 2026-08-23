# review-tests — llm-model-selection

审查对象:tests/modelCatalog.test.js(16 用例)、tests/modelSelection.test.js(5 用例)。

## 维度 1:覆盖是否完整 —— 有发现,已补

对照 spec「失败模式与边界」逐条核销:

- **逻辑侧全覆盖**:#3(401)、#4(网络失败/HTTP 500/结构不符/**非 JSON——本次审查补入**)、#5(空列表)、#6(分页聚合)、#8(手输净化)、#10(三级回退)、#17(缓存独立于保存)、#18(无选择=旧行为)、#21-22(缓存键按 provider)。
- **UI 侧缺口如实声明**(测试文件头已列明缺口与补测条件):#1-5 状态条渲染、#2 stale-while-revalidate、#7 选中不在列表、#13 竞态守卫、modelConfigService 生产绑定。均已在 dev 模式浏览器实测(见 review-code ①);扩展模式待装载手测。
- 覆盖记账核对:各用例驱动的输入与声称边界一致(如 401 用例的 fixture 确实返回 status 401、分页用例确实带 nextPageToken 两页)。

## 维度 2:case 设计 —— 无发现

- 零 `vi.mock`/`vi.spyOn` 指向自有代码;网络与存储为系统边界,经构造参数注入假件(routedFetch 按 URL 路由——URL 正确性由行为体现,非断言调用参数)。
- 全部断言经公开接口(返回值 / readCache / getSelections);无私有状态直写;所有 setup 状态均经公开路径可达(缓存经真实 fetchModels 播种)。
- 无调用次数/顺序断言。

## 维度 3:假通过 —— 有发现,已处理

- **开发期捕获一例**:`toThrow(ModelListParseError)` 在类未导出时等价于 `toThrow(undefined)`(任何异常都过)——预期红却绿,当场改为 `thrownBy(...)?.name` 字面量断言并重新验红。此模式(name 字面量)用于全部错误类型断言,不受 import 缺失影响。
- **从未红过的用例做变异检验**(到达/归因/还原三条齐):
  - 空列表用例:变异 parse 对空数组抛错 → 该用例红、报错即变异消息;还原后绿。
  - 非 JSON 用例(本次新增,首跑即绿):变异去掉 json() 的 try/catch → 红为 `'SyntaxError' ≠ 'ModelListFetchError'`,归因落在变异处;还原后绿。
  - 还原均用精确逆向编辑,未动版本库还原命令。
- 其余用例均在各自红绿循环中红过,且红因即所防行为缺失(逐循环记录于会话)。
- 无恒真断言(期望全为独立字面量)、无未 await 的异步断言、无条件跳过。

## fixture 同源核查

- Gemini:结构取自当日官方文档,且 dev 实连返回 38 项真实模型佐证(supportedGenerationMethods/models 前缀特征一致)。
- DeepSeek:结构取自当日官方文档;实连返回真实 v4 模型佐证同形态。
- OpenAI:文档页不可达;以本地 openai SDK 类型定义(models.d.ts 的 Model 接口:id/created/object/owned_by)独立核对,与 fixture 一致。
- 三者均非"凭想象造"——与 spec 不同源。
