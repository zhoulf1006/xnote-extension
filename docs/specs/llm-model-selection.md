# LLM Model Selection

> 关联: [features](../features/llm-model-selection.md)

## Problem Statement

Each LLM provider's model is hardcoded in the provider registry. Users cannot pick a different model (e.g. DeepSeek's reasoner model, a newer Gemini) without a code change and rebuild. The only provider with configurable models is "Customized", and even there the user must know and type model IDs by hand — nothing tells them what the endpoint actually offers.

## Solution

The LLM Provider Configuration modal gains per-provider **Chat model** and **Vision model** selectors, populated live from each provider's list-models API, with a free-text escape hatch for any model ID the list misses. Selections persist across devices. Hardcoded model config shrinks to a single last-resort fallback default per provider, so existing setups keep working unchanged until the user picks something.

## User Stories

1. As a DeepSeek user, I want to pick `deepseek-reasoner` from a list of what DeepSeek actually offers, so that I can use reasoning models without editing code.
2. As a user opening the config modal, I want the model list fetched automatically when my API key is already configured, so that I see current options without extra clicks.
3. As a user, I want a refresh button on the model row, so that I can pull the latest list after a provider ships new models.
4. As a user, I want to type an arbitrary model ID manually, so that a brand-new or filter-missed model is never unselectable.
5. As a user, I want my model choices synced across my devices (like my keys), so that I configure once.
6. As a Capture user, I want vision to use my chat model unless I explicitly pick a separate vision model, so that one selection is enough for everything.
7. As a Customized-provider user, I want a "fetch models from endpoint" assist, so that I can see what my OpenAI-compatible endpoint offers instead of guessing IDs.
8. As an existing user upgrading, I want everything to behave exactly as before until I actively pick a model, so that the upgrade is invisible.
9. As a user with no API key configured, I want a clear hint that the list needs a key while manual entry still works, so that I'm never dead-ended.
10. As a user whose fetch fails (network, expired key), I want to see what went wrong and still be able to select from a cached list or type manually, so that a fetch failure never blocks configuration.

## 失败模式与边界

按用户操作序列穷举;每条含预期行为。

**打开配置弹窗:**

1. 未配 key 的 provider → 不发起拉取;信息提示「配置 key 才能加载列表,手输仍可用」;下拉仅含手输入口;当前已选值(如有)照常显示。
2. 已配 key → 自动拉取;拉取期间下拉与刷新钮禁用、显示加载态;已有缓存列表时先显示缓存(stale-while-revalidate)。
3. 拉取返回 401 → 红色错误提示指向 key 输入框;有缓存则列表退回缓存,无缓存则仅手输;不清除已存 key 与已选模型。
4. 网络失败/超时(拉取 15 秒无响应即中止)/非 JSON/结构不符 → 警告提示;有缓存则显示缓存并标注拉取时间(相对时间),无缓存则仅手输。
5. 拉取成功但过滤后为空(或 API 返回空列表)→ 复用「无 key」同款信息提示形态,文案改为「API 未返回可用模型,请手输」;仅手输。(该态与已确认原型中的 info 提示同构、仅文案不同,按纯文案豁免不另出原型。)
6. Gemini 列表分页(默认每页 50)→ 请求最大页尺寸并跟随翻页标记取全量;不得只取首页当全集。

**选择与手输:**

7. 已选模型不在本次拉取结果中(已下线/改名)→ 选中值仍显示在选择框;展开列表中无对应项、无勾选;不自动清除或替换用户的选择。
8. 手输空串或纯空白 → 不生效;输入值先 trim。
9. 手输的 ID 不做存在性校验(逃生口设计)——错误 ID 在真正调用时由既有 provider 错误路径报出。
10. Vision 选择「Same as chat model」(默认)→ 图像分析解析为:vision 选择 → chat 选择 → provider 兜底默认,三级回退。
11. 列表项与选中值均为不受信文本(尤其 Customized 任意端点返回的 ID):一律按纯文本渲染,不解释 HTML;超长 ID 在列表内换行、在选择框内截断省略;不引入链接/脚本等新交互面。
12. 超长列表(OpenAI 原始 ~70+,过滤后仍数十)→ 列表内部滚动,展开走文档流下推内容(弹窗是滚动容器,悬浮层会被裁——原型已验证该结论)。

**并发与竞态:**

13. 拉取未返回时切换 provider 单选 → 迟到的响应不得写入当前 provider 的列表(以请求发起时的 provider 为准丢弃过期响应)。
14. 加载中重复点刷新 → 刷新钮在加载期禁用,天然去重。
15. 两台设备同时改选择 → 后写胜出(Chrome sync 语义),不做合并;可接受。

**保存与取消:**

16. Save → 选择写入同步存储;Cancel → 丢弃本次改动(弹窗下次打开时从存储重载,与既有 key 行为一致)。
17. 列表缓存不随 Save/Cancel 变化——缓存归拉取动作管,选择归保存动作管。

**升级与既有数据回归:**

18. 老用户无任何已存选择 → 一切行为与现状逐字节一致(兜底默认=原硬编码值);不需要迁移。
19. Customized 的既有配置结构(含 speech 能力)不变;fetch 助手只是往其模型输入框旁提供候选,不改变存量语义。
20. 既有功能回归点:Chat、Summary、Translation、Capture(vision)全部经由同一模型解析链;Speech 仅 Customized 有,不受影响。

**存储与配额:**

21. 模型选择(小)入同步存储;拉取列表缓存(可能大)入本地存储——遵守「大数据不进 sync」的既有不变量。
22. 缓存按 provider 键存,不按 key 键存;换账号后缓存可能属于旧账号,刷新即覆盖;可接受,不做失效逻辑。

**开发模式:**

23. localhost 网页模式下拉取受 CORS 约束,被拦时走网络失败路径(第 4 条),手输兜底;不影响扩展模式。

**引入内容带来的能力(第二维):** 外部内容仅为 API 返回的模型 ID 字符串,渲染面已由第 11 条覆盖(纯文本、无链接/媒体/表单/脚本面);消毒与行为归宿在此重合,无额外交互面。

## Implementation Decisions

- **统一的请求时模型解析**:所有 provider 在每次请求时解析模型(vision→chat→兜底默认三级回退),不再在客户端创建时烘焙模型(Gemini 现状如此,需改为按当前选择取模型实例)。
- **模型目录服务**(新模块,纯逻辑为主):按 provider 类型封装 list-models 的请求构造、响应解析、过滤、缓存读写。过滤规则:Gemini 以 supportedGenerationMethods 含 generateContent 为准并剥离名称前缀;OpenAI 用排除式启发(命中 embedding/tts/whisper/transcribe/dall-e/image/moderation/realtime/audio 任一子串即排除);DeepSeek 不过滤;Customized 从 `{baseURL}/models` 取、不过滤,baseURL 尾斜杠须归一化。
- **注册表瘦身**:provider 注册表只保留每 provider 一个兜底默认模型;死配置(无消费者的 models 子对象、visionModel 引用及 supportsSpeech 标志)随本次重写删除(已核实全库无消费者)。
- **存储契约**:每 provider 的 {chat, vision} 选择走既有同步存储路径;列表缓存(含拉取时间戳)走本地存储。vision 为空表示「Same as chat model」。
- **UI 结论**(已经原型确认):既有弹窗内联扩展——provider 单选之下,key 行之后,依次 Chat model 行(带刷新图标钮)与 Vision model 行;**Vision 行仅对 supportsVision 的 provider 渲染**(如 DeepSeek 只有 Chat 行);选择框展开为文档流内列表(内部滚动,不悬浮),点击选择框外关闭;列表末尾固定「Enter custom model ID…」入口展开手输行;四种状态提示(加载/401/网络错误·缓存/未配 key)为行下条幅;Vision 首项为「Same as chat model」;行下有兜底默认提示行。图标沿用项目 Font Awesome 类。
- **Customized**:能力区各模型输入升级为同款选择框,候选来自 fetch 助手;助手按钮位于 Base URL 之下。

## Testing Decisions

- **Seam**:模型目录服务的公开接口(本项目首个单测 seam,引入 Vitest,零配置贴合 Vite)。测外部行为:各 provider 响应夹具(取自真实 API 形状)→ 解析与过滤输出;三级回退解析;缓存读写与时间戳;分页聚合;过期响应丢弃;URL 归一化。不发真网络请求。
- UI 与真实 API 联通性沿既有实践手测(开发模式 + 扩展模式),含配置弹窗各状态与 Save/Cancel 往返。
- 既有先例:项目此前无自动化测试,`tests/` 仅手测页面——本次为测试基建首例。

## Out of Scope

- 各功能(翻译/摘要/对话)分别指定模型——全局每 provider 一份选择。
- 模型能力探测或选后校验(不发验证请求;错误在使用时暴露)。
- 内置 provider 的 speech 能力(仅 Customized 保留)。
- 温度、max_tokens 等推理参数配置。
- provider 健康检查与自动降级。
- 列表缓存的主动失效/按 key 隔离(见边界第 22 条)。

## Further Notes

- OpenAI list-models 无能力元数据,排除式过滤必然有漏网——手输逃生口即为此而设,过滤宁松勿紧。
- DeepSeek 文档当前示例已出现 v4 系模型,列表动态化正当其时。
