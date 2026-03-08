<template>
  <span class="user-level" :class="{ 'dark-mode': isDarkMode }">
    Lv{{ level || 0 }}
  </span>
</template>

<script setup lang="ts">
import { defineProps } from 'vue';

interface Props {
  level?: number;
  isDarkMode?: boolean;
}

defineProps<Props>();
</script>

<style lang="scss" scoped>
.user-level {
  border-radius: 9999px;
  padding: 0.125rem 0.375rem;
  background-color: rgba(255, 255, 255, 0.1);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.5625rem;
  height: 1rem;
  color: #33ff00;
  &.dark-mode {
    color: rgba(255, 255, 255, 0.7);
  }
}
</style>
