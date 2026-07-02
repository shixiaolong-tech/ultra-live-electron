<template>
  <TransitionGroup name="message-toast" tag="div" :class="$style.list">
    <MessageToast
      v-for="item in messages"
      :key="item.id"
      :type="item.type"
      :message="item.message"
      :duration="item.duration"
      @close="emit('remove', item.id)"
    />
  </TransitionGroup>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'
import MessageToast from './MessageToast.vue'
import type { MessageToastType } from './types'

interface MessageToastItem {
  id: number
  type: MessageToastType
  message: string
  duration: number
}

interface Props {
  messages: MessageToastItem[]
}

defineProps<Props>()
const emit = defineEmits<{ (e: 'remove', id: number): void }>()
</script>

<style module lang="scss">
.list {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
}

:global(.message-toast-enter-active),
:global(.message-toast-leave-active) {
  transition: all 0.3s ease;
}

:global(.message-toast-enter-from),
:global(.message-toast-leave-to) {
  transform: translateX(100%);
  opacity: 0;
}

:global(.message-toast-move) {
  transition: transform 0.3s ease;
}

/* Take the leaving item out of layout flow so the rest reposition smoothly. */
:global(.message-toast-leave-active) {
  position: absolute;
}
</style>
