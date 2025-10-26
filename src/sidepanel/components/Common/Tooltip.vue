<template>
  <div class="tooltip-container" ref="tooltipRef">
    <i class="fas fa-info-circle tooltip-icon"></i>
    <div class="tooltip-content" ref="tooltipContent">
      {{ content }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

defineProps({
  content: {
    type: String,
    required: true
  }
});

const tooltipRef = ref(null);
const tooltipContent = ref(null);

onMounted(() => {
  // Add event listener for tooltip positioning
  tooltipRef.value?.addEventListener('mouseenter', adjustTooltipPosition);
});

const adjustTooltipPosition = () => {
  if (!tooltipContent.value) return;
  
  const tooltip = tooltipContent.value;
  const container = tooltipRef.value;
  const pageContainer = container.closest('.page-container');
  
  if (!pageContainer) return;
  
  // Reset position to calculate proper width
  tooltip.style.left = '0';
  tooltip.style.right = 'auto';
  
  const tooltipRect = tooltip.getBoundingClientRect();
  const containerRect = pageContainer.getBoundingClientRect();
  const iconRect = container.getBoundingClientRect();
  
  const leftSpace = iconRect.left - containerRect.left;
  const rightSpace = containerRect.right - iconRect.right;
  
  if (leftSpace < tooltipRect.width && rightSpace < tooltipRect.width) {
    // Center if can't fit on either side
    tooltip.style.left = `${-leftSpace}px`;
  } else if (leftSpace < tooltipRect.width) {
    // Align to left edge of page container if not enough space on left
    tooltip.style.left = `${-leftSpace}px`;
  } else if (rightSpace < tooltipRect.width) {
    // Align to right if not enough space on right
    tooltip.style.left = 'auto';
    tooltip.style.right = '0';
  }
};
</script>

<style scoped>
.tooltip-container {
  display: inline-block;
  position: relative;
  margin-left: 4px;
}

.tooltip-icon {
  color: #666;
  font-size: 12px;
  cursor: help;
}

.tooltip-content {
  display: none;
  position: absolute;
  bottom: 100%;
  left: 0;
  padding: 8px;
  background: #333;
  color: white;
  border-radius: 4px;
  font-size: 12px;
  white-space: normal;
  z-index: 1000;
  width: 200px;
  word-wrap: break-word;
  line-height: 1.4;
  margin-bottom: 8px;
}

.tooltip-container:hover .tooltip-content {
  display: block;
}

.tooltip-content::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 12px;
  border-width: 4px;
  border-style: solid;
  border-color: #333 transparent transparent transparent;
}

/* Adjust arrow when tooltip is right-aligned */
.tooltip-content[style*="right: 0"] {
  left: auto;
}

.tooltip-content[style*="right: 0"]::after {
  left: auto;
  right: 12px;
}

/* Remove mobile styles since we're using consistent left alignment */
</style> 