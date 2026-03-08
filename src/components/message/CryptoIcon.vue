<template>
  <img
    v-if="iconUrl"
    :src="iconUrl"
    :alt="coin?.coinSymbol || ''"
    class="crypto-icon"
    :style="{ width: size + 'px', height: size + 'px' }"
  />
  <span 
    v-else class="crypto-icon-placeholder" 
    :style="{ height: size + 'px' }"
  >
    {{ coin?.coinSymbol || '?' }}
  </span>
</template>

<script setup lang="ts">
import { defineProps, withDefaults, watch, ref } from 'vue';
import { chainImgs } from '@/lib/imgs';

interface Props {
  coin?: {
    coinSymbol?: string;
    coinIcon?: string;
    icon?: string;
  };
  size?: number;
  className?: string;
}

const props = withDefaults(defineProps<Props>(), {
  size: 16,
});

const iconUrl = ref('');
watch(
  () => props.coin, 
  (newVal) => {
    const { coinSymbol, coinIcon, icon } = newVal || {};
    if (coinIcon || icon)  {
      iconUrl.value = coinIcon || icon || '';
    }
    else {
      const values = Object.values(chainImgs)
      const localIcon = values.find(value => value.toLocaleLowerCase().includes(coinSymbol?.toLocaleLowerCase() || '')) || ''
      console.log('localIcon', localIcon)
      iconUrl.value = localIcon || '';
    }
  }, 
  {
    immediate: true,
    deep: true,
  }
);
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
  border-radius: 6px;
  font-weight: 500;
  background-color: rgba(255, 255, 255, 0.1);
  font-size: 0.75rem;
  padding: 0 0.25rem;
}
</style>
