/**
 * Category picker, replacing the prompt()-based "type a number" flow.
 * window.prompt() is suppressed in Chrome extension side panels.
 */
import { ref } from 'vue';

const request = ref(null); // { pageTitle, categories, resolve }

/**
 * Ask the user which category to save a page into.
 * @param {string} pageTitle
 * @param {Array<{name: string, links?: Array}>} categories
 * @returns {Promise<string|null>} chosen category name, or null if cancelled
 */
export function pickCategory(pageTitle, categories) {
  return new Promise((resolve) => {
    if (request.value) request.value.resolve(null);
    request.value = { pageTitle, categories, resolve };
  });
}

/** For the single picker host (App.vue). */
export function useCategoryPickerHost() {
  const resolve = (categoryName) => {
    const current = request.value;
    request.value = null;
    current?.resolve(categoryName);
  };
  return { request, resolve };
}
