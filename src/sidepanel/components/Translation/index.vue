<template>
  <div class="page-container">
    <div class="header">
      <h1>Translation</h1>
    </div>
    <div class="translation-layout">
      <TranslationInput 
        v-model="inputText" 
        :is-streaming="isTranslating"
        @translate="handleTranslate"
      />
      <TranslationResult 
        :streaming-result="translatedText"
        :result="translatedText"
        :is-streaming="isTranslating"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import TranslationInput from './TranslationInput.vue';
import TranslationResult from './TranslationResult.vue';
import { useTranslation } from './useTranslation';
import { useLLMConfigStore } from '@/stores/llmConfig';

const inputText = ref('');
const { translatedText, isTranslating, error, translate } = useTranslation();
const llmConfigStore = useLLMConfigStore();

const handleTranslate = async (text) => {
  if (!llmConfigStore.selectedProvider) {
    error.value = 'No LLM provider selected';
    return;
  }
  await translate(text);
};
</script>

<style scoped>

.translation-layout {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  overflow: hidden;
}

</style>