# 功能目录(Features)

本目录描述**当前版本已具备功能的现行行为**,面向人的产品全景。
- 不变量:出现在本目录 = 当前版本可用;行为变更就地改写;功能移除删除文件。
- 未来计划见 roadmap;历史见 git/Release Notes;实现与决策见 docs/adr。
- 内容规则:只写用户可见行为,零实现细节。
- 目录初建于 2026-08:存量功能(Chat/Capture/Translate/Summary/Quick Links/Transfer/Drive 同步)条目待逆向补齐;缺条目不代表功能不存在。

| 功能 | 一句话 |
|---|---|
| [LLM 模型选择](llm-model-selection.md) | 在 LLM Config 弹窗按 provider 从实时拉取的列表选择 Chat/Vision 模型,或手输任意模型 ID |
| [应用内提示与确认](notifications.md) | 操作结果以提示条显示,删除类操作有确认对话框,右键保存网页以列表选择分类 |
