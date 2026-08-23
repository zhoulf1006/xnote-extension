# Specs 索引

功能需求全景(用户故事、失败模式与边界穷举、测试决策、明确不做)。读者是要改这块代码的人。
一个功能模块一篇,slug 与 `docs/features/` 一一对应;现行描述、就地改写,变更史在 git;功能移除即删文件。

## 不变量

- spec 不引用票号、分支名、施工记录路径——它先于且长于这些临时物。
- 决策取舍归 ADR(如有),spec 只引用编号;当前项目行为归 features。
- 尚未落地的事实写 `> Pending: <可判真假的产品条件>`,收口时逐条重判。

## 索引

- [llm-model-selection](./llm-model-selection.md) — LLM Config 弹窗内按 provider 动态拉取并选择 Chat/Vision 模型
