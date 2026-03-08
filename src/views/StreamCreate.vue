<template>
  <UIKitProvider :language="currentLanguage" theme="dark">
    <div class="tui-livekit-mac-v2">
      <LiveHeader
        :language="currentLanguage"
        @update:language="onLanguageChange"
        @logout="reset"
      />
      <div class="live-pusher-main">
        <div class="live-room-info">
          <div class="form-title">
            <h1>{{ t('streamCreate.createLive') }}</h1>
          </div>
          <div class="form-container">
            <div class="form-item">
              <label class="form-label">
                {{ t('streamCreate.liveTitle') }}
                <span class="required">*</span>
              </label>
              <input type="text" class="form-input" v-model="formData.title" :placeholder="t('streamCreate.enterTitle')" />
            </div>

            <div class="form-item">
              <label class="form-label">
                {{ t('streamCreate.category') }}
                <span class="required">*</span>
              </label>
              <TUISelect
                class="form-select"
                :modelValue="formData.category.toString()"
                :teleported="false"
                :popper-append-to-body="false"
                :disabled="isLive || !liveCategory.length"
                :placeholder="t('streamCreate.selectCategory')"
                @change="handleCategoryChange"
              >
                <TUIOption
                  v-for="item in liveCategory"
                  :key="item.id"
                  :value="item.id.toString()"
                  :label="getLangName(item.name, item.nameEn)"
                  class="category-option"
                >
                  <img :src="item.imageUrl" :alt="item.name" class="category-image"/>
                  {{ getLangName(item.name, item.nameEn) }}
                </TUIOption>
              </TUISelect>
            </div>

            <div class="form-item">
              <label class="form-label">
                {{ t('streamCreate.contentTags') }}
                <span class="required">*</span>
              </label>
              <input type="text" class="form-input" v-model="formData.tags" :placeholder="t('streamCreate.enterTags')" />
            </div>
            <div class="form-item">
              <label class="form-label">
                {{ t('streamCreate.cover') }}
                <span class="required">*</span>
              </label>
              <p class="form-hint">{{ t('streamCreate.coverHint') }}</p>
              <div class="cover-upload-container">
                <ImageUpload 
                  :value="coverImage" 
                  :disabled="isLive" 
                  :max-size="10" 
                  :aspect-ratio="16 / 9"
                  :placeholder="t('streamCreate.uploadCover')" 
                  class="cover-upload" 
                  @change="handleCoverChange"
                />
              </div>
            </div>
          </div>
        </div>
        <div class="form-button">
          <div class="form-title">
            <h1>{{ t('streamCreate.liveControl') }}</h1>
          </div>
          <button 
            class="tui-login-button tui-button-ripple"
            :disabled="disabledButton"
            :class="{ 'tui-button-disabled': disabledButton }"
            @click="handleStartLive"
          >
            <IconLiveLoading v-if="startLiveLoading" class="button-loading-icon" />
            <span class="button">{{ startLiveLoading ? t('streamCreate.creating') : t('streamCreate.startLive') }}</span>
          </button>
        </div>
      </div>
    </div>
  </UIKitProvider>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import trtcCloud from '../TUILiveKit/utils/trtcCloud';
import {
  IconLiveLoading,
  TUIToast,
  UIKitProvider,
  useUIKit,
  TUISelect,
  TUIOption
} from '@tencentcloud/uikit-base-component-vue3';
import router from '../router';
import { isMainWindow } from '../TUILiveKit/utils/envUtils';
import logger from '../TUILiveKit/utils/logger';
import ImageUpload from '../components/ImageUpload.vue';
import LiveHeader from '../TUILiveKit/components/v2/LiveHeader/index.vue';
import { getUserInfo } from '@/utils/base';
import { getLangName } from '@/utils/local';
import { api } from '../lib/api';
import { LOCAL_STORAGE_KEY_USER_INFO, LOCAL_STORAGE_KEY_TOKEN, LOCAL_STORAGE_KEY_LIVE_RESULT } from '@/const/local';

console.log('TRTC SDK version1:', trtcCloud.getSDKVersion());

const { t } = useUIKit();
const currentLanguage = ref(window.localStorage.getItem('app-language') || 'zh-CN');
const userInfo = ref<Record<string, any> | null>(null);

// 表单数据
const formData = ref({
  title: '',
  category: '',
  tags: '',
});

// 封面相关
const coverImage = ref<string | null>(null);
const isLive = ref(false); // 是否正在直播
const isInit = ref(true); // 是否初始化完成
const liveCategory = ref<Array<{ id: number; name: string; nameEn: string; imageUrl: string }>>([]); // 直播分类
const logPrefix = '[Loading.vue]';

const onLanguageChange = (lang: string) => {
  currentLanguage.value = lang;
  window.localStorage.setItem('app-language', lang);
};

const handleCategoryChange = (value: string) => {
  formData.value.category = value;
};
const handleCoverChange = (url: string | null) => {
  if (url) {
    coverImage.value = url;
  } else {
    coverImage.value = null;
  }
};

// 初始化接口 - 获取直播状态和分类
const fetchData = async () => {
  try {
    // 并行获取所有数据
    const [liveInfo, categoriesResponse] = await Promise.all([
      api.room.getCurrentLiveStatus(),
      api.category.getHotLiveCategory({ page: 1, limit: 100 }),
    ]);

    const isLiveStatus = liveInfo.data?.isLive;

    // 0: 未开播 1: 推流中 -1：待推流
    if (!isLiveStatus) {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY_LIVE_RESULT);
      isLive.value = false;
    } else {
      isLive.value = true;
      // 更新表单数据
      formData.value = {
        title: liveInfo.data?.roomName || '',
        category: String(liveInfo.data?.roomType || ''),
        tags: liveInfo.data?.playingMethod || '',
      };
      coverImage.value = liveInfo.data?.roomImg || null;

      // 缓存到本地
      window.localStorage.setItem(LOCAL_STORAGE_KEY_LIVE_RESULT, JSON.stringify({
        userId: 'live_' + userInfo.value?.userId,
        roomName: liveInfo.data?.roomName,
        roomId: liveInfo.data?.roomId || 0,
        userSig: liveInfo.data?.userSig || '',
        sdkAppId: liveInfo.data?.sdkAppId || '',
      }));
      goToMain();
    }

    // 设置分类数据
    liveCategory.value = categoriesResponse?.data || [];
    isInit.value = false;
  } catch (error) {
    console.error('fetchData error:', error);
    isInit.value = false;
    TUIToast.error({
      message: t('streamCreate.fetchDataFailed'),
    });
  }
};

// 跳转到登录页面
const goToLogin = () => {
  router.push('/login');
}

const startLiveLoading = ref(false);

const handleStartLive = async () => {
  if (disabledButton.value || startLiveLoading.value) {
    return;
  }
  startLiveLoading.value = true;
  try {
    const data = {
      streamingMode: 'RTC',
      roomName: formData.value.title,
      roomType: Number(formData.value.category),
      playingMethod: formData.value.tags,
      roomImg: coverImage.value || ''
    };
    const response = await api.room.createLiveRoom(data);
    if (response.code === 200 && response.data) {
      localStorage.setItem(LOCAL_STORAGE_KEY_LIVE_RESULT, JSON.stringify({
        userId: 'live_' + userInfo.value?.userId,
        roomName: data.roomName,
        roomId: response.data?.roomId || 0,
        userSig: response.data?.userSig || '',
        sdkAppId: response.data?.sdkAppId,
        avatarUrl: userInfo.value?.avatarUrl || '',
        userName: userInfo.value?.userName || '',
      }));
      goToMain();
    }
    else {
      TUIToast.error({
        message: response.msg,
      });
    }
  } catch (error) {
    console.error('handleStartLive error:', error);
    TUIToast.error({
      message: t('streamCreate.startLiveFailed'),
    });
  }
  finally {
    startLiveLoading.value = false;
  }
}
async function goToMain() {
  logger.log(`${logPrefix}init:`, userInfo);
  const isMain = await isMainWindow();
  if (isMain) {
    window.ipcRenderer.send('openTUILiveKit', {
      userInfo: JSON.stringify(userInfo.value),
    });
    router.push('/tui-live-kit-main');
  }
}

// 重置
const reset = () => {
  goToLogin();
}
// 表单是否填写完整（必填：标题、主题分类、内容标签、直播封面）
const isFormValid = computed(() => {
  const { title, category, tags } = formData.value;
  return Boolean(title?.trim() && category && tags?.trim() && coverImage.value);
});

const disabledButton = computed(() => {
  return isInit.value || !isFormValid.value || startLiveLoading.value;
});

onMounted(async () => {
  // 获取用户信息
  let storedUserInfo = window.localStorage.getItem(LOCAL_STORAGE_KEY_USER_INFO);
  // 如果用户信息不存在，则跳转到登录页面，则重新获取一下用户信息
  if (!storedUserInfo) {
    const token = window.localStorage.getItem(LOCAL_STORAGE_KEY_TOKEN);
    if (!token) {
      reset();
      return;
    }
    const userInfoResponse = await getUserInfo();
    if (!userInfoResponse) {
      reset();
      return;
    }
    storedUserInfo = JSON.stringify(userInfoResponse);
  }
  userInfo.value = JSON.parse(storedUserInfo);
  // 调用 fetchData 获取直播状态和分类
  await fetchData();
});
</script>

<style lang="scss" scoped>
@import '../TUILiveKit/assets/variable.scss';

.tui-livekit-mac-v2 {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background-color: var(--bg-color-topbar);
}

.live-pusher-main {
  flex: 1;
  padding: 2rem;
  color: var(--text-color-primary);
  display: flex;
  height: calc(100% - 2.75rem);
  width: calc(100% - 2rem);
  max-width: 1200px;
  margin: 0 auto;
  gap: 1.5rem;
}

.live-room-info,
.form-button {
  padding: 1rem 1.5rem;
  background-color: var(--bg-color-operate);
  border-radius: 0.5rem;
  h1 {
    padding: 0;
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-color-primary);
    margin-bottom: 1rem;
  }
}
.live-room-info {
  flex: 1;
  margin: 0 auto;
  overflow-y: auto;
}
.form-button {
  width: 300px;
  flex: none;
  height: auto;;
}

.info-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--text-color-primary);
}

.info-tips {
  margin-bottom: 2rem;
  font-size: 0.875rem;
  color: var(--text-color-secondary);

  .tip-item {
    display: flex;
    align-items: center;
    margin-bottom: 0.5rem;

    .tip-icon {
      margin-right: 0.5rem;
      font-size: 1rem;
    }
  }
}

.form-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-size: 0.875rem;
  color: var(--text-color-primary);
  display: flex;
  align-items: center;

  .required {
    color: var(--text-color-error);
    margin-left: 0.25rem;
  }
}

.form-hint {
  font-size: 0.75rem;
  color: var(--text-color-placeholder, #8b92a8);
  margin: 0 0 0.25rem 0;
}

.form-input {
  width: 100%;
  padding: 0.75rem 1rem;
  background-color: var(--bg-color-operate);
  border: 1px solid var(--stroke-color-primary);
  border-radius: 0.5rem;
  color: var(--text-color-primary);
  font-size: 0.875rem;
  font-family: inherit;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px rgba(28, 102, 229, 0.1);
  }

  &::placeholder {
    color: var(--text-color-placeholder);
  }
}

.form-select {
  cursor: pointer;
  appearance: none;
  .category-image {
    width: 1rem;
    height: 1rem;
    margin-right: 0.5rem;
  }
  .category-option {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.875rem;
  }
}
.cover-upload-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 600px;
}

.tui-login-button {
  width: 100%;
  height: 3rem;
  margin-top: 1rem;
  border: 1px solid #33ff00;
  border-radius: 0.5rem;
  background-color: #33ff00;
  cursor: pointer;
  color: #000;
  font-size: 1rem;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  .button-loading-icon {
    width: 1.25rem;
    height: 1.25rem;
    flex-shrink: 0;
    animation: spin 1s linear infinite;
  }
  &.tui-button-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.tui-button-ripple:not(.tui-button-disabled) {
  background-position: center;
  transition: all 0.2s ease-in-out;

  &:hover {
    background-position: center;
    background-color: #34e907;
    transform: translateY(-1px);
  }

  &:active {
    background-color: #34e907;
    background-size: 100%;
    transition: all 0s;
  }
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
