# LLM 模型选择

## 概述

使用不同 AI 服务商的用户此前无法选择用哪个模型——每个 provider 固定一个内置模型。现在 LLM Config 弹窗按 provider 提供模型选择:列表从服务商官方接口实时拉取,也可手输任意模型 ID。

## 能力

- LLM Config 弹窗中,OpenAI/DeepSeek/Gemini 各有 Chat model 选择框;支持图像分析的 provider(OpenAI、Gemini)另有 Vision model 选择框。
- 打开弹窗时,若该 provider 已配置 API key,模型列表自动从官方接口拉取;Chat model 行右侧的刷新按钮可手动重拉。
- 拉取进行中选择框与刷新按钮暂不可用,并显示加载提示。
- 每个列表末尾的「Enter custom model ID…」可手输任意模型 ID(留空或纯空白无效)。
- Vision 默认「Same as chat model」;未单独选择时,图像分析使用 Chat 所选模型。
- 未做任何选择时行为与升级前一致(使用内置默认模型);选择框下方的提示行标明该默认值。
- key 被拒、网络失败、未配 key、接口返回空列表各有相应提示;网络失败时显示最近一次成功拉取的缓存列表并标注拉取时间,手输始终可用。
- 模型选择随 Chrome 账号跨设备同步(与 API key 相同的同步行为)。
- Customized provider:Base URL 下方的「Fetch models from endpoint」按钮从该端点拉取模型,作为 Chat/Vision/Speech 各能力输入框的候选;手输不受影响。
- 点 Save 后立即生效于随后的对话、摘要、翻译与截图分析;点 Cancel 放弃本次更改。

## 边界与不做

- 不支持按功能(对话/摘要/翻译)分别指定模型——每个 provider 一份全局选择。
- 手输的模型 ID 不做有效性校验;错误 ID 在实际请求时由服务商报错。
- OpenAI 的列表按名称启发式过滤非对话模型,可能有漏网——手输入口即为兜底。
- 更换 API key 不清空已缓存的模型列表;刷新一次即覆盖。
- 列表拉取 15 秒无响应即按网络失败处理。
