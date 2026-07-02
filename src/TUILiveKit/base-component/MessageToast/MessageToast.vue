<template>
  <div :class="$style.messageToast">
    <span :class="[$style.dot, $style[type]]"></span>
    <span :class="$style.text">{{ message }}</span>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, defineProps, defineEmits } from 'vue'
import type { MessageToastType } from './types'

interface Props {
  type: MessageToastType
  message: string
  duration: number
}

const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'close'): void }>()

let timer: number | null = null

onMounted(() => {
  timer = window.setTimeout(() => {
    emit('close')
  }, props.duration)
})

onBeforeUnmount(() => {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
})
</script>

<style module lang="scss">
.messageToast {
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: auto;
  border-radius: 12px;
  border: 1px solid var(--stroke-color-module, #48494f);
  background: var(--bg-color-operate, #1f2024);
  padding: 12px 16px;
  box-shadow: 0 8px 18px 0 rgba(0, 0, 0, 0.06), 0 2px 6px 0 rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(20px);
  max-width: 320px;
  min-width: 200px;
}

.dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-color-link, #1c66e5);
}

.info {
  background: var(--text-color-link, #1c66e5);
}

.success {
  background: var(--uikit-color-green-6, #0abf76);
}

.warning {
  background: var(--uikit-color-orange-6, #ff8c00);
}

.error {
  background: var(--uikit-color-red-6, #e54545);
}

.text {
  color: var(--text-color-primary, rgba(255, 255, 255, 0.9));
  font-size: 14px;
  font-style: normal;
  font-weight: 500;
  line-height: 22px;
  word-break: break-word;
  overflow-wrap: anywhere;
}
</style>
