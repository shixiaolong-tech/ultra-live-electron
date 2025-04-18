<template>
  <div class="tui-live-controller">
    <!-- <div class="tui-layout-toolbar">
      <div class="tui-layout-toolbar-left">
          <div v-for="(item, index) in screenStyleList" :key="index" class="tui-layout-toolbar-left-container">
            <span @click="handleChangeScreenStyle(item)" :class="[currentScreenStyle === item ? 'tui-layout-toolbar-left-isChoose': 'tui-layout-toolbar-left-isNormal']">
              <svg-icon :icon="item.icon"></svg-icon>
              <span class="tui-layout-toolbar-left-text">{{item.text}}</span>
            </span>
          </div>
      </div>
      <div class="tui-layout-toolbar-right">
        <span class="tui-layout-toolbar-right-custom">
          <svg-icon :icon="AddIcon"></svg-icon>
          <span class="tui-layout-toolbar-right-text">{{t('Customizable')}}</span>
        </span>
        <span class="tui-layout-toolbar-right-icon" v-for="(item, index) in dispositionList" :key="index" >
          <svg-icon :icon="item.icon"></svg-icon>
        </span>
      </div>
    </div> -->
    <div class="tui-streaming-toolbar">
      <div class="tui-streaming-toolbar-left" >
        <audio-control></audio-control>
        <speaker-control></speaker-control>
      </div>
      <div class="tui-streaming-toolbar-middle">
        <tui-badge :hidden="applyToAnchorListNumber === 0" :value="applyToAnchorListNumber" :max="10" type="danger">
          <div class="middle-container"  @click="handleVoiceChat">
            <svg-icon class="icon-container" :icon=VoiceChatIcon :size="1.5"></svg-icon>
          </div>
        </tui-badge>
        <div class="middle-container" v-for="(item, index) in streamingTooBarList" :key="index" @click="item.fun()">
          <svg-icon class="icon-container" :icon=item.icon :size="1.5"></svg-icon>
        </div>
      </div>
      <div class="tui-streaming-toolbar-right">
        <span @click="toggleVideoResolutionMode" class="tui-resolution-mode-switch">
          <svg-icon :icon="mixingVideoEncodeParam.resMode === TRTCVideoResolutionMode.TRTCVideoResolutionModeLandscape ? HorizontalScreenIcon : VerticalScreenIcon" :size="1.5" />
        </span>
        <tui-button @click="handleChangeLivingStatus" :class="['tui-btn-live-switch', isLiving ? 'is-living' :'']" :disabled="isLiveSwitchDisabled || !userId">
          <svg-icon :icon="liveStatusIcon" class="live-status"></svg-icon>
          <span :class="[isLiving ? 'text-living': ' text-living-start']">
            {{liveStatus}}
          </span>
        </tui-button>
      </div>

    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, Ref, computed, defineEmits, nextTick, shallowRef, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { TRTCVideoResolutionMode } from 'trtc-electron-sdk';
import BeautyIcon from '../../common/icons/BeautyIcon.vue';
import AudioControl from '../../common/AudioControl.vue';
import SpeakerControl from '../../common/SpeakerControl.vue';
import VoiceChatIcon from '../../common/icons/VoiceChatIcon.vue';
import PKIcon from '../../common/icons/PKIcon.vue';
import SetIcon from '../../common/icons/SetIcon.vue';
import StartLivingIcon from '../../common/icons/StartLivingIcon.vue';
import EndLivingIcon from '../../common/icons/EndLivingIcon.vue';
import VerticalScreenIcon from '../../common/icons/VerticalScreenIcon.vue';
import HorizontalScreenIcon from '../../common/icons/HorizontalScreenIcon.vue';
import NineSquareGridIcon from '../../common/icons/NineSquareGridIcon.vue';
import BottomBarIcon from '../../common/icons/BottomBarIcon.vue';
import SpeakerLayoutIcon from '../../common/icons/SpeakerLayoutIcon.vue';
import SidebarLayoutIcon from '../../common/icons/SidebarLayoutIcon.vue';
import ThreeColumnIcon from '../../common/icons/SidebarLayoutIcon.vue';
import AddIcon from '../../common/icons/AddIcon.vue'
import SvgIcon from '../../common/base/SvgIcon.vue';
import TuiButton from '../../common/base/Button.vue';
import { useI18n } from '../../locales';
import { useBasicStore } from '../../store/main/basic';
import { useMediaSourcesStore } from '../../store/main/mediaSources';
import { useRoomStore } from '../../store/main/room';
import { useAudioEffectStore } from '../../store/audioEffect';
import { messageChannels } from '../../communication';
import TuiBadge from '../../common/base/Badge.vue';

interface screenStyle {
  icon: object,
  text: string,
  value: TRTCVideoResolutionMode,
}
interface disposition {
  icon: object,
  value: string, // Preserved field
}
const { t } = useI18n();

const logger = console;
const logPrefix = '[LiveController]';

const emits = defineEmits(["onStartLiving", "onStopLiving"]);

const basicStore = useBasicStore();
const mediaSourcesStore = useMediaSourcesStore();
const audioEffectStore = useAudioEffectStore();
const { mixingVideoEncodeParam } = storeToRefs(mediaSourcesStore);
const roomStore = useRoomStore();
const { isLiving, userId } = storeToRefs(basicStore);

const { applyToAnchorList, anchorList } = storeToRefs(roomStore);

const applyToAnchorListNumber = computed(()=> applyToAnchorList.value.length );
const streamingTooBarList = shallowRef([
  // {
  //   icon: BeautyIcon,
  //   text: t('Beauty'),
  //   fun: handleBeauty
  // },
  // {
  //   icon: PKIcon,
  //   text: t('PK'),
  //   fun: handlePK
  // },
  {
    icon: SetIcon,
    text: t('Setting'),
    fun: handleSetting
  }
]);

const screenStyleList = shallowRef([
  {
    icon: VerticalScreenIcon,
    text: t('Vertical screen'),
    value: TRTCVideoResolutionMode.TRTCVideoResolutionModeLandscape,
  },
  {
    icon: HorizontalScreenIcon,
    text: t('Horizontal screen'),
    value: TRTCVideoResolutionMode.TRTCVideoResolutionModePortrait,
  }
]);

const dispositionList = ref([
  {
    icon: NineSquareGridIcon,
    value: '',
  },
  {
    icon: BottomBarIcon,
    value: '',
  },
  {
    icon: SpeakerLayoutIcon,
    value: '',
  },
  {
    icon: SidebarLayoutIcon,
    value: '',
  },
  {
    icon: ThreeColumnIcon,
    value: '',
  }
]);

const currentScreenStyle = ref(screenStyleList.value[0]);
const liveStatus = computed (()=>
  isLiving.value ? t('End Live'): t('Go Live')
);

const liveStatusIcon = computed (()=>
  isLiving.value ? EndLivingIcon: StartLivingIcon
);

const isLiveSwitchDisabled: Ref<boolean> = ref(false);

function handleBeauty() {
  console.log('Beauty');
}

function handleVoiceChat() {
  messageChannels.messagePortToChild?.postMessage({
    key: 'set-apply-list',
    data: JSON.stringify(applyToAnchorList.value)
  });
  messageChannels.messagePortToChild?.postMessage({
    key: 'set-anchor-list',
    data: JSON.stringify(anchorList.value)
  });
  window.ipcRenderer.send('open-child', {
    'command': 'voice-chat'
  });
}

function handlePK() {
  console.log('PK');
}

function handleSetting() {
  window.ipcRenderer.send('open-child', {
    'command': 'setting'
  })
}

function toggleVideoResolutionMode() {
  if (mixingVideoEncodeParam.value.resMode === TRTCVideoResolutionMode.TRTCVideoResolutionModeLandscape) {
    mediaSourcesStore.updateResolutionMode(TRTCVideoResolutionMode.TRTCVideoResolutionModePortrait);
  } else {
    mediaSourcesStore.updateResolutionMode(TRTCVideoResolutionMode.TRTCVideoResolutionModeLandscape);
  }
}

async function handleChangeLivingStatus() {
  if (isLiveSwitchDisabled.value) {
    return;
  }
  isLiveSwitchDisabled.value = true;
  await nextTick();
  if (!isLiving.value) {
    audioEffectStore.initVoiceEffect();
    emits("onStartLiving");
  } else {
    emits("onStopLiving");
  }
}

function handleChangeScreenStyle(item: screenStyle) {
  mediaSourcesStore.updateResolutionMode(item.value);
}

watch(
  () => isLiving.value,
  (newValue, oldValue) => {
    logger.log(`${logPrefix}watch isLiving:`, newValue, oldValue);
    if (newValue !== oldValue) {
      if (isLiveSwitchDisabled.value) {
        isLiveSwitchDisabled.value = false;
      }
    }
  }
);
</script>
<style scoped lang="scss">
@import "../../assets/variable.scss";
.tui-live-controller {
  height: 4rem;
  padding: 0 0.5rem;
  background-color: var(--bg-color-operate);

  .tui-layout-toolbar {
    height: 100%;
    border-bottom: 1px solid $color-divider-line;
    display: flex;
    justify-content: space-between;
    align-items: center;
    &-left{
      display: flex;
      &-container{
        display: flex;
        align-items: center;
      }
      &-isChoose{
        display: flex;
        align-items: center;
        justify-content: center;
        width: 4rem;
        height: 2.5rem;
        border-radius: 0.375rem;
        fill: $color-white;
        opacity: 0.5;
        background: $color-live-controller-is-choose-background;
      }
      &-isNormal{
        display: flex;
        align-items: center;
        justify-content: center;
        width: 4rem;
        height: 2.5rem;
        border-radius: 0.375rem;
        opacity: 0.5;
        background: $color-live-controller-is-normal-background;
      }
      &-text{
        color: $font-live-controller-text-color;
        font-size: $font-live-controller-text-size;
        font-style: $font-live-controller-text-style;
        font-weight: $font-live-controller-text-weight;
        line-height: 1.25rem;
      }
    }
    &-right{
      display: flex;
      align-items: center;
      &-custom{
        display: flex;
        align-items: center;
        justify-content: center;
        width: 4rem;
        height: 2.5rem;
        background-color: $color-live-controller-right-custom;
        border-radius: 0.375rem;
        margin-right: 0.75rem;
        cursor: pointer;
      }
      &-icon{
        margin-right: 0.75rem;
        cursor: pointer;
        width: 4rem;
        height: 2.5rem;
      }
      &-text{
        color: $font-live-controller-text-color;
        font-size: $font-live-controller-text-size;
        font-style: $font-live-controller-text-style;
        font-weight: $font-live-controller-text-weight;
        line-height: 1.25rem;
      }
    }
  }

  .tui-streaming-toolbar {
    height: 4rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
      &-left{
        display: flex;
      }
      &-middle{
        flex: 1 1 auto;
        display: flex;
        align-items: center;
        height: 2.5rem;
        padding-right: 0;
      }
      &-right{
        display: inline-flex;
        align-items: center;
        width: 9rem;
      }
  }

  .tui-resolution-mode-switch {
    cursor: pointer;
    margin-right: 1rem;
  }

  .tui-btn-live-switch {
    width: 6rem;
    height: 2.5rem;
    font-size: 0.75rem;
    line-height: 2.5rem;
    display: flex;
    border-radius: 3rem;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--button-color-primary-default);
    background-color: var(--bg-color-transparency);
    color: var(--button-color-primary-default);
    cursor: pointer;
    margin-left: 0.375rem;

    .live-status{
      color: var(--button-color-primary-default);
    }

    span{
      color: var(--button-color-primary-default);
    }

    .text-living{
      color: var(--text-color-error);
    }

    &.is-living{
      border: 1px solid var(--text-color-error);
      background-color: var(--bg-color-transparency);
    }


    &:disabled {
      cursor: not-allowed;
      opacity: 0.3;
    }
  }

  .text{
    font-size: $font-live-controller-text-size;
    font-style: $font-live-controller-text-style;
    font-weight: $font-live-controller-text-weight;
    line-height: 1.25rem;
    background: $color-live-controller-text-background;
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    &-living{
      padding: 0.125rem;
      color: var(--bg-color-transparency);
      &-start{
        padding: 0.125rem;
      }
    }
  }
  .middle-container{
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 4rem;
  }
  .icon-container{
    cursor: pointer;
  }
}
</style>
