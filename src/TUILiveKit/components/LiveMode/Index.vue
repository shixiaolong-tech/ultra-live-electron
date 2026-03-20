
<template>
  <div class="live-mode-container">
    <Select
      :model-value="currentMode"
      class="live-mode-select"
      @change="handleModeChange"
    >
      <Option
        v-for="item in modeOptions"
        :key="item.value"
        :label="t(item.label)"
        :value="item.value"
      />
    </Select>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, withDefaults, defineProps, defineEmits } from 'vue';
import Select from '../../common/base/Select.vue';
import Option from '../../common/base/Option.vue';
import { useI18n } from '../../locales';
import { TUILiveModeType } from '../../types';

const { t } = useI18n();

interface Props {
  modelValue?: TUILiveModeType;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: TUILiveModeType.Normal,
});

const emits = defineEmits(['update:modelValue', 'change']);

const modeOptions = [
  { label: 'Normal Mode', value: TUILiveModeType.Normal },
  { label: 'Robot Streaming Mode', value: TUILiveModeType.Robot },
];

const currentMode = ref<TUILiveModeType>(props.modelValue);

watch(() => props.modelValue, (val) => {
  currentMode.value = val;
}, { immediate: true });

function handleModeChange(value: TUILiveModeType) {
  currentMode.value = value;
  // emits('update:modelValue', value);
  emits('change', value);
}
</script>

<style lang="scss" scoped>
.live-mode-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;

  .live-mode-label {
    font-size: 0.875rem;
    color: var(--text-color-primary);
    white-space: nowrap;
  }

  .live-mode-select {
    width: 10rem;

    :deep(.select-content) {
      height: 2rem;
    }
  }
}
</style>
