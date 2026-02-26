<template>
  <UIKitProvider :language="currentLanguage" theme="dark">  
    <div class="tui-login-page" :data-locale="i18n.global.locale.value">
      <div class="tui-login-header">
        <div class="window-tool tui-window-header">
          <div class="language-right">
            <select
              :value="currentLanguage"
              class="language-select"
              @change="onLanguageChange($event)"
            >
              <option value="zh-CN">中文</option>
              <option value="en-US">English</option>
              <option value="ja">日本語</option>
              <option value="ko">한국어</option>
              <option value="zh-HK">粤语</option>
            </select>
          </div>
          <button class="tui-live-icon" @click="onMinimize">
            <svg-icon :icon=MinimizeIcon></svg-icon>
          </button>
          <button class="tui-live-icon" @click="onToggleMaximize">
            <svg-icon v-if="!isMaximized" :icon=MaximizeIcon></svg-icon>
            <svg-icon v-else :icon=MiniIcon></svg-icon>
          </button>
          <button class="tui-live-icon" @click="onClose">
            <svg-icon :icon=CloseIcon ></svg-icon>
          </button>
        </div>
      </div>
      <div class="tui-login-body">
        <div class="tui-login-logo">
        </div>
        <div class="tui-login-form">
          <div class="tui-login-form-title">
            <span>{{t('Live Streaming Assistant')}}</span>
          </div>
          <div class="tui-login-type-container">
            <span :class="{active:loginType===LoginType.UserAccount}" @click="onChangeLoginType(LoginType.UserAccount)">{{ t('Account Login')}}</span>
          </div>
          <div class="tui-login-options">
            <secret-key-form
              :login-state="loginState"
              :verify-states="verifyStates"
              @update:user-id="value => loginState.userId = value"
              />
            <button 
              class="tui-login-button" 
              :class="{
                'tui-login-button-disabled': !loginState.userId,
                'tui-button-ripple': loginState.userId
              }"
              :disabled="!loginState.userId" 
              @click="handleLogin">
              <span class="button">{{ !isLoggingIn ? t('Log In') : t('Logging In')}}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </UIKitProvider>
</template>

<script setup lang="ts">
import { ref, Ref, reactive, onMounted } from 'vue';
import { UIKitProvider } from '@tencentcloud/uikit-base-component-vue3';
import router from '../../router';
import { getWindowType } from '../../TUILiveKit/utils/envUtils';
import i18n, { useI18n } from '../../TUILiveKit/locales';
import SvgIcon from '../../TUILiveKit/common/base/SvgIcon.vue';
import MaximizeIcon from '../../TUILiveKit/common/icons/MaximizeIcon.vue';
import MinimizeIcon from '../../TUILiveKit/common/icons/MinimizeIcon.vue';
import MiniIcon from '../../TUILiveKit/common/icons/MiniIcon.vue';
import CloseIcon from '../../TUILiveKit/common/icons/CloseIcon.vue';
import TUIMessageBox from '../../TUILiveKit/common/base/MessageBox';
import SecretKeyForm from './SecretKeyForm.vue';
import logger from '../../TUILiveKit/utils/logger';
import { LoginType, LoginState, VerifyStates } from './types';
import { api } from '../../lib/api';
import { LOCAL_STORAGE_KEY_TOKEN, LOCAL_STORAGE_KEY_USER_INFO } from '@/const/local';

const loginState:LoginState = reactive({
  privacyGuide: '',
  userAgreement: '',
  mode: '',
  isAgreed: false,
  phoneNumber: '',
  mailAddress: '',
  verifyCode: '',
  sessionId: '',
  sdkAppId: '',
  userId: '',
  userSig: '',
  sdkSecretKey: '',
  password: '',
});

const verifyStates:VerifyStates = reactive({
  countdown: 0,
  timer: 0,
});

const { t } = useI18n();

const currentLanguage = ref(window.localStorage.getItem('app-language') || 'zh-CN');
const loginType: Ref<LoginType> = ref(LoginType.SDKSecretKey);
const isLoggingIn = ref(false);

const onChangeLoginType = (type: LoginType) => {
  loginType.value = type;
}

const onLanguageChange = (e: Event) => {
  const lang = (e.target as HTMLSelectElement).value;
  currentLanguage.value = lang;
  window.localStorage.setItem('app-language', lang);
  i18n.global.locale.value = lang;
  if (window.ipcRenderer) {
    window.ipcRenderer.send('set-language', lang);
  }
};

async function handleLogin() {
  isLoggingIn.value = true;
  console.log('开始')
  if (!loginState.userId.trim()) {
    return;
  }
  const response = await api.assistant.loginByCode(loginState.userId.trim());
  if (response.code === 200 && response.data) {
    window.localStorage.setItem(LOCAL_STORAGE_KEY_TOKEN, response.data.token);
    // 获取个人信息
    await getUserInfo();
  } else {
    TUIMessageBox({
      title: t('Note'),
      message: response.msg,
      confirmButtonText: t('Sure'),
    });
  }
}

async function getUserInfo() {
  const userInfoResponse = await api.user.getUserInfo();
  window.localStorage.setItem(LOCAL_STORAGE_KEY_USER_INFO, JSON.stringify({
    userId: userInfoResponse.data?.userId,
    userName: userInfoResponse.data?.name,
    userSig: userInfoResponse.data?.userSig,
    avatarUrl: userInfoResponse.data?.avatar,
    loginType: LoginType.SDKSecretKey
  }));
  await gotoNextPage();
}


async function gotoNextPage() {
  const winType = await getWindowType();
  logger.log(`Login success, go to ${winType} window page`);
  switch (winType) {
  case 'main':
    router.push({ name: 'stream' });
    break;
  case 'child':
    router.push({ name: 'tui-live-kit-child' });
    break;
  case 'cover':
    router.push({ name: 'tui-live-kit-cover' });
    break;
  default:
    logger.warn('login success, unkonwn window source:', winType);
    break;
  }
  window.ipcRenderer.send('user-login');
}

onMounted(() => {
  const scripts = document.getElementsByTagName('script');
  const existed = Array.from(scripts).some(script => script.src.indexOf('TCaptcha.js') !== -1);

  if (!existed) {
    logger.log('[Login] add script TCaptcha');
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://turing.captcha.qcloud.com/TCaptcha.js';
    document.getElementsByTagName('head')[0].appendChild(script);
  }
  const userStore = window.localStorage.getItem('billion-live-token') as any;
  if (userStore) {
    getUserInfo();
  }
});

const isMaximized: Ref<boolean> = ref(false);
function onMinimize() {
  logger.log('[LiveHeader]onMinimize');
  window.ipcRenderer.send('on-minimize-window', null);
}

function onToggleMaximize() {
  logger.log('[LiveHeader]onToggleMaximize');
  isMaximized.value = !isMaximized.value;
  window.ipcRenderer.send('on-maximize-window', isMaximized.value);
}

function onClose() {
  logger.log('[LiveHeader]onClose');
  window.ipcRenderer.send('on-close-window', null);
}
</script>

<style lang="scss">
@import '../../TUILiveKit/assets/variable.scss';

.tui-login-page {
  --font-size-primary: 1rem;
  --font-size-secondary: 0.75rem;
  height: 100%;
  background-color: var(--bg-color-topbar);
  .tui-input-icon {
    flex: 0 0 1.25rem;
    width: 1.25rem;
    height: 1.25rem;
  }
  .language-right {
    display: flex;
    align-items: center;
    .language-select {
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
      color: var(--text-color-primary);
      background-color: var(--bg-color-operate, #252830);
      border: 1px solid var(--stroke-color-primary, #3a3d45);
      border-radius: 0.25rem;
      cursor: pointer;
      outline: none;
      min-width: 5rem;
      &:focus {
        border-color: var(--color-primary, #1c66e5);
      }
    }
  }
  .tui-login-header {
    height: 2.75rem;
    .window-tool{
      display: flex;
      align-items: center;
      justify-content: flex-end;
      align-self: flex-end;
      width:100%;
      padding: 0.5rem;
    }
  }

  .tui-login-body {
    display: flex;
    justify-content: center;
    align-items: center;
    height: calc(100% - 2.75rem);
  }

  .tui-login-logo {
    flex: 1 1 auto;
    height: 100%;
    background-image: url(../../assets/login-back.png);
    background-position: center;
    background-size: cover;
    background-repeat: no-repeat;
  }

  .tui-login-form {
    flex: 0 0 28rem;
    width: 28rem;
    border-radius: 1.25rem;
    margin: 0 3rem;
    padding: 2.5rem 2rem;
    background-image: linear-gradient(230deg, rgba(61, 119, 255, 0.53), rgba(61, 143, 255, 0) 50%);
  }

  .tui-login-form-title {
    font-size: 1.5rem;
    font-weight: bold;
  }

  .tui-login-type-container {
    display: inline-flex;
    margin-top: 1rem;
    font-size: var(--font-size-primary);

    span {
      margin-right: 1rem;
      cursor: pointer;

      &:last-child {
        margin-right: 0;
      }
    }
    .active:after{
      content: '';
      width: 100%;
      height: 0.125rem;
      background:#006EFF;
      border-radius: 0.0625rem;
      display: block;
      margin-top: 0.3125rem;
    }
  }

  .tui-login-option-input {
    position: relative;
    display: flex;
    align-items: center;

    margin-top: 2rem;
    padding: 0 1rem;

    border-radius: 0.5rem;
    background-color: #292d38;
    font-size: var(--font-size-primary);

    input {
      -webkit-appearance: none;
      flex: 1 1 auto;
      width: auto;
      line-height: 3.125rem;
      border: 1px solid #292D38;
      background-color: #292d38;
      color: #b3b8c8;
      font-size: var(--font-size-primary);
      outline: none;
    }

    .tui-msg-control,
    .tui-generate-usersig {
      flex: 0 0 6rem;
      width: 6rem;
      text-align: right;
    }

    .tui-msg-send {
      cursor: pointer;
      color: #1c66e5;
    }
    .tui-msg-sent {
      color: #cccccc;
    }
  }

  .tui-login-option-license {
    display: flex;
    align-items: center;
    margin: 1rem 0;
    font-size: var(--font-size-secondary);

    .tui-license-checkbox,
    .tui-login-license {
      height: 1rem;
      line-height: 1rem;
    }
  }

  .tui-warning-notice {
    margin-top: 1rem;
    color: $color-error;
    font-size: 0.75rem;
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
}
</style>
