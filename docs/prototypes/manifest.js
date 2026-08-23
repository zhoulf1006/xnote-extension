// 原型注册表 — 画廊壳 (index.html) 读取。每生成/删除一个原型,同步增删条目。
window.PROTOTYPES = [
  {
    module: 'llm-model-selection',
    type: 'ui',
    id: 'config-modal',
    name: 'LLM Config modal — dynamic model selection',
    path: 'llm-model-selection/prototype-config-modal.html'
  },
  {
    module: 'notifications',
    type: 'ui',
    id: 'feedback-layer',
    name: '侧边栏反馈层 — 提示条 + 分类选择',
    path: 'notifications/prototype-feedback-layer.html'
  }
];
