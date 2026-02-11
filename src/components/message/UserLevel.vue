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
  display: inline-block;
  padding: 0.125rem 0.25rem;
  border-radius: 0.125rem;
  font-size: 0.625rem;
  font-weight: bold;
  background-color: rgba(24, 144, 255, 0.2);
  color: #1890FF;

  &.dark-mode {
    background-color: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
  }
}
</style>
