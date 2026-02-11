<template>
  <img
    v-if="coin?.coinIcon"
    :src="coin.coinIcon"
    :alt="coin.coinSymbol"
    class="crypto-icon"
    :style="{ width: size + 'px', height: size + 'px' }"
  />
  <span v-else class="crypto-icon-placeholder">{{ coin?.coinSymbol || '?' }}</span>
</template>

<script setup lang="ts">
import { defineProps, withDefaults } from 'vue';
interface Props {
  coin?: {
    coinSymbol?: string;
    coinIcon?: string;
  };
  size?: number;
  className?: string;
}

withDefaults(defineProps<Props>(), {
  size: 16,
});
</script>

<style lang="scss" scoped>
.crypto-icon {
  border-radius: 50%;
  object-fit: cover;
}

.crypto-icon-placeholder {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.1);
  font-size: 0.75rem;
}
</style>
