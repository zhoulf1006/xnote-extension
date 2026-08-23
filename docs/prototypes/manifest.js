// Prototype registry, read by the gallery shell (index.html). Add or remove an
// entry whenever a prototype is created or deleted.
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
    name: 'Side panel feedback layer — toasts + category picker',
    path: 'notifications/prototype-feedback-layer.html'
  }
];
