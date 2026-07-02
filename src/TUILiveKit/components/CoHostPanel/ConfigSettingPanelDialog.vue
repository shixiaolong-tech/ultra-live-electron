<template>
  <TUIDialog
    v-model:visible="dialogVisible"
    :title="t('Anchor battle settings')"
    :custom-classes="['co-host-config-dialog']"
    @cancel="handleCancel"
    @confirm="handleConfirm"
  >
    <div class="setting-panel">
      <div class="setting-item">
        <div class="setting-item-label">
          {{ t('Connection Layout') }}
        </div>
        <div class="template-options">
          <div class="options-grid">
            <template
              v-for="template in layoutOptions"
              :key="template.id"
            >
              <div
                class="option-card"
                :class="{ active: form.coHostLayoutTemplate === template.templateId }"
                @click="selectTemplate(template.templateId)"
              >
                <div class="option-info">
                  <component
                    :is="template.icon"
                    v-if="template.icon"
                    class="option-icon"
                  />
                  <h4>{{ template.label }}</h4>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
      <div class="setting-item">
        <div class="setting-item-label">
          {{ t('Battle duration') }}
        </div>
        <div class="setting-item-value">
          <div class="layout-template-options">
            <template v-for="item in minutes" :key="item.value">
              <label class="layout-template-option">
                <input
                  :value="item.value"
                  type="radio"
                  name="coHostBattleDuration"
                  class="layout-template-radio"
                  :checked="item.value === form.battleDuration"
                  @input="handleDurationChange"
                >
                <span class="layout-template-label">{{ item.label }}</span>
              </label>
            </template>
          </div>
        </div>
      </div>
    </div>
  </TUIDialog>
</template>

<script setup lang="ts">
/**
 * Read-only counterpart of kit `ConfigSettingPanel.vue` for child-window mode.
 *
 * Form ownership: the canonical config form lives on the main window so it
 * survives child re-opens. On `confirm`, this component emits a
 * `setConfigForm` action which the parent dialog forwards via IPC.
 */
import { computed, ref, watch } from 'vue';
import {
  useUIKit,
  TUIDialog,
  IconDynamic1v6Layout,
  IconDynamicGridLayout,
} from '@tencentcloud/uikit-base-component-vue3';
import { CoHostLayoutTemplate, LiveOrientation } from 'tuikit-atomicx-vue3-electron';
import type { CoHostActionPayload } from '../../ipc';

const { t } = useUIKit();

const props = defineProps<{
  visible: boolean;
  form: {
    coHostLayoutTemplate: CoHostLayoutTemplate;
    battleDuration: number;
  };
  /**
   * Current live orientation derived from the snapshot's
   * `currentLive.layoutTemplate`. Owned by the parent dialog so all sub-panels
   * read the same value. Mirrors the kit `ConfigSettingPanel.vue` prop added
   * by the upstream "optimize co-host layout selection" commit: in landscape
   * mode the only valid layout is `HostVideoLandscapeFixed2Seats`, while in
   * portrait mode both `HostDynamicGrid` and `HostDynamic1v6` are offered.
   */
  currentLiveOrientation: LiveOrientation;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  cancel: [];
  action: [payload: CoHostActionPayload];
}>();

const dialogVisible = ref(props.visible);
// Local mutable copy. Reset to props.form whenever the dialog opens, so the
// previous unsaved edits don't leak across opens.
const form = ref({
  coHostLayoutTemplate: props.form.coHostLayoutTemplate,
  battleDuration: props.form.battleDuration,
});

watch(() => props.visible, (newVal) => {
  dialogVisible.value = newVal;
  if (newVal) {
    // Re-sync local form from props when dialog opens.
    form.value = {
      coHostLayoutTemplate: props.form.coHostLayoutTemplate,
      battleDuration: props.form.battleDuration,
    };
  }
});

watch(dialogVisible, (newVal) => {
  emit('update:visible', newVal);
});

const minutes = [
  { label: t('Number minutes', { number: 1 }), value: 1 * 60 },
  { label: t('Number minutes', { number: 2 }), value: 2 * 60 },
  { label: t('Number minutes', { number: 3 }), value: 3 * 60 },
  { label: t('Number minutes', { number: 5 }), value: 5 * 60 },
];

// Layout option list shown in the "Connection Layout" picker.
// In landscape lives only the fixed 2-seat landscape template makes sense;
// in portrait lives we offer the 9-grid and 1v6 dynamic templates. Mirrors
// kit `ConfigSettingPanel.vue` after the upstream PK layout-selection
// optimization commit.
const layoutOptions = computed(() => {
  if (props.currentLiveOrientation === LiveOrientation.Landscape) {
    return [{
      id: 'HostVideoLandscapeFixed2Seats',
      icon: IconDynamicGridLayout,
      templateId: CoHostLayoutTemplate.HostVideoLandscapeFixed2Seats,
      label: t('Landscape Fixed 2 Seats Layout'),
    }];
  }
  return [
    {
      id: 'PortraitDynamic_Grid9',
      icon: IconDynamicGridLayout,
      templateId: CoHostLayoutTemplate.HostDynamicGrid,
      label: t('Dynamic Grid9 Layout'),
    },
    // {
    //   id: 'PortraitDynamic_1v6',
    //   icon: IconDynamic1v6Layout,
    //   templateId: CoHostLayoutTemplate.HostDynamic1v6,
    //   label: t('Dynamic 1v6 Layout'),
    // },
  ];
});

function selectTemplate(template: CoHostLayoutTemplate) {
  form.value.coHostLayoutTemplate = template;
}

function handleDurationChange(event: Event) {
  const target = event.target as HTMLInputElement;
  form.value.battleDuration = Number(target.value);
}

function handleCancel() {
  emit('update:visible', false);
  emit('cancel');
}

function handleConfirm() {
  emit('update:visible', false);
  emit('action', {
    action: 'setConfigForm',
    battleDuration: form.value.battleDuration,
    coHostLayoutTemplate: form.value.coHostLayoutTemplate,
  });
}
</script>

<style lang="scss" scoped>
.setting-panel {
  .setting-item {
    display: flex;
    align-items: center;
    flex-direction: column;
    justify-content: flex-start;
    gap: 6px;
    margin-bottom: 20px;

    .setting-item-label {
      width: 100%;
      color: var(--text-color-secondary);
      font-size: 14px;
      font-weight: 400;
      line-height: 24px;
    }

    .setting-item-value {
      display: flex;
      width: 100%;
    }
  }
}

.template-options {
  width: 100%;
  height: 100%;
  overflow: auto;

  .options-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    justify-content: flex-start;

    .option-card {
      box-sizing: border-box;
      padding: 12px 13px;
      width: 208px;
      background: #3a3a3a;
      border: 2px solid transparent;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: center;

      &:hover {
        background: #4a4a4a;
        border-color: #5a5a5a;
      }

      &.active {
        border: 2px solid var(--text-color-link-hover, #2B6AD6);
        background: var(--list-color-focused, #243047);

        .option-info h4 {
          color: #ffffff;
        }
      }

      .option-info {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 8px;

        .option-icon {
          width: 24px;
          height: 24px;
        }

        h4 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #ffffff;
          transition: color 0.2s ease;
        }
      }
    }
  }
}

.layout-template-options {
  display: flex;
  flex-direction: row;
  gap: 24px;
}

.layout-template-option {
  display: flex;
  align-items: center;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--background-color-primary);
  gap: 8px;
}

.layout-template-radio {
  width: 18px;
  height: 18px;
  margin: 0;
  accent-color: var(--primary-color);
  cursor: pointer;
}

.layout-template-label {
  flex: 1;
  font-size: 14px;
  color: var(--text-color-primary);
  font-weight: 500;
  cursor: pointer;
}
</style>
