import { defineStore } from 'pinia';
import { TRTCScreenCaptureSourceInfo, TRTCDeviceInfo, TRTCDeviceType } from 'trtc-electron-sdk';
import { TUILiveUserInfo } from '../../types';
import { TRTCXmagicEffectProperty, TRTCXmagicEffectCategory } from '../../utils/beauty';

const logger = console;
const logPrefix = '[currentSources]';

const defaultCameraResolution = { width: 640, height: 360 };

type CurrentViewType = 'camera' | 'screen' | 'file' | 'image' | 'voice-chat' | 'setting' | 'add-bgm' | 'reverb-voice' | 'change-voice' | '';

interface TUICurrentMediaSourceState {
    currentCameraResolution: {width: number; height: number;};
    isCurrentCameraMirrored: boolean;
    currentCameraId: string;
    currentMicrophoneId: string;
    currentSpeakerId: string;
    cameraList: TRTCDeviceInfo[];
    microphoneList: TRTCDeviceInfo[];
    speakerList: TRTCDeviceInfo[];
    pictureList: Array<Record<string, any>>;
    currentViewName: CurrentViewType;
    screenList: Array<TRTCScreenCaptureSourceInfo>;
    windowList: Array<TRTCScreenCaptureSourceInfo>;
    applyToAnchorList: Array<TUILiveUserInfo>;
    currentAnchorList: Array<TUILiveUserInfo>;
    micVolume: number;
    speakerVolume: number;
    beautyProperties: Array<TRTCXmagicEffectProperty>;
}

export const useCurrentSourceStore = defineStore('currentSource', {
  state: (): TUICurrentMediaSourceState => ({
    currentCameraResolution: defaultCameraResolution,
    currentCameraId: '',
    currentMicrophoneId: '',
    currentSpeakerId: '',
    cameraList: [],
    microphoneList: [],
    speakerList: [],
    isCurrentCameraMirrored: false,
    screenList: [],
    windowList: [],
    pictureList: [],
    currentViewName: '',
    applyToAnchorList: [],
    currentAnchorList: [],
    micVolume: 0,
    speakerVolume: 0,
    beautyProperties: [],
  }),
  getters:{
    getBeautyPropertyByEffKey(state): Record<string, any> | null {
      return (effKey: string) => state.beautyProperties.find(item => item.effKey === effKey) || null;
    }
  },
  actions:{
    setCurrentCameraId(deviceId: string) {
      this.currentCameraId = deviceId;
      const currentCamera = this.cameraList.find((item: TRTCDeviceInfo) => item.deviceId === deviceId);
      if (currentCamera && currentCamera.deviceProperties?.SupportedResolution?.length) {
        this.currentCameraResolution =  currentCamera.deviceProperties?.SupportedResolution[0] || defaultCameraResolution;
      } else {
        this.currentCameraResolution =  defaultCameraResolution;
      }
      logger.log(`${logPrefix}setCurrentCameraId`, this.currentCameraId, this.currentCameraResolution, this.cameraList);
      window.mainWindowPort?.postMessage({
        key: "setCurrentDevice",
        data: {
          deviceType: TRTCDeviceType.TRTCDeviceTypeCamera,
          deviceId,
        }
      });
      window.mainWindowPort?.postMessage({
        key: "setCameraTestDeviceId",
        data: { 
          cameraId: deviceId 
        }
      });
    },
    setCurrentMicrophoneId(deviceId: string) {
      this.currentMicrophoneId = deviceId;
      logger.log(`${logPrefix}setCurrentMicrophoneId`, this.currentMicrophoneId, this.microphoneList);
      window.mainWindowPort?.postMessage({
        key: "setCurrentDevice",
        data: {
          deviceType: TRTCDeviceType.TRTCDeviceTypeMic,
          deviceId,
        }
      });
    },
    setCurrentSpeakerId(deviceId: string) {
      this.currentSpeakerId = deviceId;
      logger.log(`${logPrefix}setCurrentSpeakerId`, this.currentSpeakerId);
      window.mainWindowPort?.postMessage({
        key: "setCurrentDevice",
        data: {
          deviceType: TRTCDeviceType.TRTCDeviceTypeSpeaker,
          deviceId,
        }
      });
    },
    setCurrentCameraResolution(resolution: {width: number; height: number;}) {
      this.currentCameraResolution = resolution;
    },
    setCameraList(deviceList: TRTCDeviceInfo[]) {
      this.cameraList = deviceList;
      if (!this.currentCameraId && deviceList.length > 0 && deviceList[0].deviceProperties?.SupportedResolution?.length) {
        this.setCurrentCameraId(deviceList[0].deviceId);
        this.setCurrentCameraResolution(deviceList[0].deviceProperties.SupportedResolution[0]);
      } else {
        this.setCurrentCameraId('');
        this.setCurrentCameraResolution(defaultCameraResolution);
      }
    },
    setMicrophoneList(deviceList: TRTCDeviceInfo[]) {
      this.microphoneList = deviceList;
      if (!this.currentMicrophoneId && deviceList.length > 0) {
        this.setCurrentMicrophoneId(deviceList[0].deviceId);
      }
    },
    setSpeakerList(deviceList: TRTCDeviceInfo[]) {
      this.speakerList = deviceList;
      if (!this.currentSpeakerId && deviceList.length > 0) {
        this.setCurrentSpeakerId(deviceList[0].deviceId);
      }
    },
    setIsCurrentCameraMirrored(mirror: boolean) {
      this.isCurrentCameraMirrored = mirror;
      // To do: send change state to main window
    },
    setCurrentViewName(name: CurrentViewType) {
      this.currentViewName = name;
    },
    setScreenList(screenList: any) {
      this.screenList = screenList;
    },
    setWindowList(windowList: any){
      this.windowList = windowList;
    },
    setApplyToAnchorList(applyToAnchorList: any) {
      this.applyToAnchorList = applyToAnchorList;
    },
    setAnchorList(anchorList: any){
      this.currentAnchorList = anchorList;
    },
    updateAudioVolume(volume: number) {
      this.micVolume = volume;
    },
    updateSpeakerVolume(volume: number) {
      this.speakerVolume = volume;
    },
    setBeautyProperty(property: TRTCXmagicEffectProperty){
      const currentProperty = Object.assign({}, property);
      const excludedCategory = [TRTCXmagicEffectCategory.Segmentation, TRTCXmagicEffectCategory.Makeup, TRTCXmagicEffectCategory.Motion];
      let indexToUpdate = -1;
      switch (currentProperty.category) {
      case TRTCXmagicEffectCategory.Beauty:
      case TRTCXmagicEffectCategory.BodyBeauty:
      case TRTCXmagicEffectCategory.Lut:
        indexToUpdate = this.beautyProperties.findIndex(item => item.effKey === currentProperty.effKey);
        if (indexToUpdate !== -1) {
          Object.assign(this.beautyProperties[indexToUpdate], currentProperty);
        } else{
          this.beautyProperties.push(currentProperty);
        }
        break;
      case TRTCXmagicEffectCategory.Motion:
      case TRTCXmagicEffectCategory.Segmentation:
      case TRTCXmagicEffectCategory.Makeup:
        indexToUpdate = this.beautyProperties.findIndex(item => excludedCategory.indexOf(item.category) !== -1);
        if (indexToUpdate !== -1) {
          Object.assign(this.beautyProperties[indexToUpdate], currentProperty);
          indexToUpdate = this.beautyProperties.findIndex(item => item.category === TRTCXmagicEffectCategory.AssetData);
          if (indexToUpdate !== -1) {
            this.beautyProperties.splice(indexToUpdate, 1);
          }
        } else{
          this.beautyProperties.push(currentProperty);
        }
        break;
      case TRTCXmagicEffectCategory.AssetData:
        indexToUpdate = this.beautyProperties.findIndex(item => item.category === TRTCXmagicEffectCategory.AssetData);
        if (indexToUpdate !== -1) {
          this.beautyProperties.splice(indexToUpdate, 1);
        }
        this.beautyProperties.push(currentProperty);
        break;
      default:
        logger.warn(`${logPrefix}setBeautyProperty unsupported beauty effect category.`, property);
        break;
      }
    },
    setBeautyProperty_1(setting: TRTCXmagicEffectProperty){
      const currentSetting = Object.assign({},setting);
      const index = this.beautyProperties.findIndex(obj => {
        return obj.effKey === currentSetting.effKey 
          || (currentSetting.category === TRTCXmagicEffectCategory.Segmentation && obj.category === TRTCXmagicEffectCategory.Segmentation);
      });
      if (index !== -1) {
        Object.assign(this.beautyProperties[index], currentSetting);
      } else{
        this.beautyProperties.push(currentSetting);
      }
    },
    setBeautyProperties(properties: TRTCXmagicEffectProperty[]) {
      // this.beautyProperties = properties;
      properties.forEach(item => this.setBeautyProperty(item));
    },
    reset() {
      this.currentCameraResolution = defaultCameraResolution;
      this.currentCameraId = '';
      this.currentMicrophoneId = '';
      this.currentSpeakerId = '';
      this.cameraList = [];
      this.microphoneList = [];
      this.speakerList = [];
      this.isCurrentCameraMirrored = false;
      this.screenList = [];
      this.windowList = [];
      this.pictureList = [];
      this.currentViewName = ''; 
      this.applyToAnchorList = [];
      this.currentAnchorList = [];
      this.micVolume = 0;
      this.speakerVolume = 0;
      this.beautyProperties = [];
    },
  },
});