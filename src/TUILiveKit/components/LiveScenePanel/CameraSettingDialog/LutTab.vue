<template>
  <!--
    Filter / 滤镜. Single-pick grid plus a strength slider for the picked filter.
    All lut tiles share one effKey (the store handles that quirk); selection
    drives activation. Independent tab sharing the PickGrid / IntensityRow atoms.
  -->
  <div class="lut-tab">
    <PickGrid :items="items" @pick="onPick" />
    <div v-if="pickedItem && hasIntensity(pickedItem)" class="picked-intensity">
      <div class="picked-intensity-divider" />
      <IntensityRow
        :detail="pickedItem"
        :value="pickedValue"
        @change="onIntensityChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import PickGrid from './PickGrid.vue';
import IntensityRow from './IntensityRow.vue';

/* eslint-disable @typescript-eslint/no-explicit-any */

const props = defineProps<{
  /** details[] from effectConstant.lut. */
  items: Array<Record<string, any>>;
}>();

const emit = defineEmits<{
  (e: 'pick', detail: Record<string, any> | null): void;
  (e: 'intensity-change', detail: Record<string, any>, value: number): void;
}>();

const pickedItem = computed<Record<string, any> | null>(() => props.items.find((it) => it.isSelected) ?? null);

const pickedValue = computed<number>(() => {
  const item = pickedItem.value;
  if (!item) return 0;
  const min = typeof item.minValue === 'number' ? item.minValue : 0;
  const v = item.effValue;
  return typeof v === 'number' ? v : min;
});

function hasIntensity(item: Record<string, any>): boolean {
  return typeof item.minValue === 'number' && typeof item.maxValue === 'number';
}

const onPick = (detail: Record<string, any> | null) => emit('pick', detail);

const onIntensityChange = (v: number) => {
  if (!pickedItem.value) return;
  emit('intensity-change', pickedItem.value, v);
};
</script>

<style lang="scss" scoped>
.lut-tab {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.picked-intensity {
  flex-shrink: 0;
  padding: 8px 12px 12px;
}

.picked-intensity-divider {
  height: 1px;
  background-color: var(--stroke-color-module);
  margin-bottom: 8px;
}
</style>
