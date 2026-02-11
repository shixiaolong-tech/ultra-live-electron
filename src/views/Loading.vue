<template>
  <UIKitProvider language="zh-CN" theme="dark">
    <div class="tui-livekit-mac-v2">
      <LiveHeader @logout="handleLogout" />
      <div class="live-pusher-main">
        <div class="live-room-info">
          <div class="form-container">
            <!-- 直播标题 -->
            <div class="form-item">
              <label class="form-label">
                直播标题
                <span class="required">*</span>
              </label>
              <input type="text" class="form-input" v-model="formData.title" placeholder="请输入直播标题" />
            </div>

            <!-- 主题分类 -->
            <div class="form-item">
              <label class="form-label">
                主题分类
                <span class="required">*</span>
              </label>
              <select 
                class="form-select" 
                v-model="formData.category" 
                :disabled="isLive || !liveCategory.length"
              >
                <option value="">请选择主题分类</option>
                <option 
                  v-for="category in liveCategory" 
                  :key="category.id" 
                  :value="String(category.id)"
                >
                  {{ category.name }}
                </option>
              </select>
            </div>

            <!-- 内容标签 -->
            <div class="form-item">
              <label class="form-label">
                内容标签
                <span class="required">*</span>
              </label>
              <input type="text" class="form-input" v-model="formData.tags" placeholder="请输入内容标签" />
            </div>
            <!-- 直播封面 -->
            <div class="form-item">
              <label class="form-label">直播封面</label>
              <div class="cover-upload-container">
                <ImageUpload :value="coverImage" :disabled="isLive" :max-size="1" :aspect-ratio="16 / 9"
                  placeholder="点击上传封面" class="cover-upload" @change="handleCoverChange" />
              </div>
            </div>
            <button class="tui-login-button tui-button-ripple" @click="handleStartLive">
              <span class="button">开始直播</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </UIKitProvider>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  IconArrowStrokeBack,
  IconArrowStrokeSelectDown,
  IconCopy,
  IconEndLive,
  IconLiveLoading,
  IconLiveStart,
  TUIButton,
  TUIDialog,
  TUIMessageBox,
  TUIToast,
  UIKitProvider,
  useUIKit
} from '@tencentcloud/uikit-base-component-vue3';
import { vTuiLoading } from '@tencentcloud/uikit-base-component-vue3';
import router from '../router';
import { isMainWindow } from '../TUILiveKit/utils/envUtils';
import LiveHeader from '../TUILiveKit/components/v2/LiveHeader/index.vue';
import { LoginType } from './Login/types';
import logger from '../TUILiveKit/utils/logger';
import { useElectronLogin } from '../TUILiveKit/hooks/useElectronLogin';
import ImageUpload from '../components/ImageUpload.vue';
import { api } from '../lib/api';

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

    const status = liveInfo.data?.status;
    const isLiveStatus = liveInfo.data?.isLive;

    // 0: 未开播 1: 推流中 -1：待推流
    if (!isLiveStatus) {
      window.localStorage.removeItem('billion-liveResult');
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
      window.localStorage.setItem('billion-liveResult', JSON.stringify({
        userId: 'live_' + userInfo.value?.userId,
        roomName: liveInfo.data?.roomName,
        roomId: liveInfo.data?.roomId || 0,
        userSig: liveInfo.data?.userSig || '',
        sdkAppId: liveInfo.data?.sdkAppId || '',
      }));
      goToMain(userInfo.value || {});
    }

    // 设置分类数据
    liveCategory.value = categoriesResponse?.data || [];
    isInit.value = false;
  } catch (error) {
    console.error('fetchData error:', error);
    isInit.value = false;
    TUIToast.error({
      message: '获取数据失败，请重试',
    });
  }
};

// Setup useElectronLogin Hook
const {
  handleLogout: handleElectronLogout,
} = useElectronLogin({
  onLogout: () => {
    router.replace({ name: 'login' });
  },
  onLoginFailed: () => {
    console.log('onLoginFailed')
    // router.replace({ name: 'login' });
  },
});

const handleLogout = () => {
  handleElectronLogout();
};

const logPrefix = '[Loading.vue]';

const gotoLogin = () => {
  window.localStorage.removeItem('billion-live-userInfo');
  router.push('/login');
}

const handleStartLive = async () => {
  const data = {
    streamingMode: 'RTC',
    roomName: formData.value.title,
    roomType: Number(formData.value.category),
    playingMethod: formData.value.tags,
    roomImg: coverImage.value || ''
  }
  console.log('data', data)
  const response = await api.room.createLiveRoom(data)
  if (response.code === 200 && response.data) {
    localStorage.setItem('billion-liveResult', JSON.stringify({
      userId: 'live_' + userInfo.value?.userId,
      roomName: data.roomName,
      roomId: response.data?.roomId || 0,
      userSig: response.data?.userSig || '',
      sdkAppId: response.data?.sdkAppId,
      avatarUrl: userInfo.value?.avatarUrl,
    }))
    goToMain(userInfo.value || {})
  }
  else {
    TUIToast.error({
      message: response.msg,
    });
  }
}
async function goToMain(userInfo: Record<string, any>) {
  logger.log(`${logPrefix}init:`, userInfo);
  const isMain = await isMainWindow();
  if (isMain) {
    // window.ipcRenderer.send('openTUILiveKit', {
    //   userInfo
    // });
    router.push('/tui-live-kit-main');
  }
}

onMounted(async () => {
  const storedUserInfo = window.localStorage.getItem('billion-live-userInfo');
  if (!storedUserInfo) {
    gotoLogin();
    return;
  }

  userInfo.value = JSON.parse(storedUserInfo);
  
  // 调用 fetchData 获取直播状态和分类
  await fetchData();
  
  // 如果已经有直播结果，直接跳转
  const liveResult = window.localStorage.getItem('billion-liveResult');
  if (liveResult && userInfo.value) {
    const liveResultData = JSON.parse(liveResult);
    if (liveResultData.roomId) {
      goToMain(userInfo.value);
    }
  }
});
</script>

<style lang="scss" scoped>
@import '../TUILiveKit/assets/variable.scss';

.tui-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  width: 100vw;
}

.live-pusher-main {
  flex: 1;
  padding: 2rem;
  overflow-y: auto;
  background-color: #0f1014;
  color: #e7ecf6;
}

.live-room-info {
  max-width: 800px;
  margin: 0 auto;
}

.info-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #e7ecf6;
}

.info-tips {
  margin-bottom: 2rem;
  font-size: 0.875rem;
  color: #adb6cc;

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
  color: #e7ecf6;
  display: flex;
  align-items: center;

  .required {
    color: #f23c5b;
    margin-left: 0.25rem;
  }
}

.form-input,
.form-select {
  width: 100%;
  padding: 0.75rem 1rem;
  background-color: #1a1c24;
  border: 1px solid #383f4d;
  border-radius: 0.5rem;
  color: #e7ecf6;
  font-size: 0.875rem;
  font-family: inherit;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: #1c66e5;
    box-shadow: 0 0 0 2px rgba(28, 102, 229, 0.1);
  }

  &::placeholder {
    color: #6b7280;
  }
}

.form-select {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23adb6cc' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 1rem center;
  padding-right: 2.5rem;
}

.stream-type-group {
  display: flex;
  gap: 1rem;
}

.stream-type-btn {
  flex: 1;
  padding: 0.75rem 1rem;
  background-color: #1a1c24;
  border: 1px solid #383f4d;
  border-radius: 0.5rem;
  color: #adb6cc;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: #4b5563;
    background-color: #252730;
  }

  &.active {
    background-color: #10b981;
    border-color: #10b981;
    color: #ffffff;
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
  border: 1px solid $color-primary;
  border-radius: 0.5rem;
  background-color: $color-primary;
  cursor: pointer;
  color: #D5E0F2;
}

.tui-button-ripple {
  background-position: center;
  transition: background 500ms ease-in-out;

  &:hover {
    background-position: center;
    background-color: $color-anchor-hover;
    background-image: radial-gradient(circle, transparent 1%, $color-anchor-hover 1%);
    background-size: 15000%;
  }

  &:active {
    background-color: $color-anchor-active;
    background-size: 100%;
    transition: background 0s;
  }
}
</style>
