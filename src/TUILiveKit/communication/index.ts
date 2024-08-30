import { TUIMediaSourceType, TUIMediaRotation } from '@tencentcloud/tuiroom-engine-electron';
import { TUIMediaSourceViewModel } from '../store/mediaSources';
import { useMusicDataStore , PlayModeType} from '../store/musicData';
import TUIMessageBox from '../common/base/MessageBox';
import useAudioEffectManager, { TUIAudioMusicParam } from '../utils/useAudioEffectManager';
import useDeviceManager from "../utils/useDeviceManager";
import trtcCloud from '../utils/trtcCloud';
import { TRTCXmagicFactory, XmagicLicense, } from "../utils/beauty";
import {useI18n} from '../locales/index';

const musicDataStore = useMusicDataStore();
const deviceManager = useDeviceManager();
const audioEffectManager = useAudioEffectManager();
const {t} = useI18n();
const logger = console;
const logPrefix = '[MainWindow Message Handler]';
let mediaSourcesStore: any = null;
let roomStore: any = null;


export const messageChannels: {
  childWindowPort: MessagePort|null; 
  contextWindowPort: MessagePort | null;
} = {
  childWindowPort: null,
  contextWindowPort: null,
};

(window as any)._messageChannels = messageChannels;

export async function addMediaSource(data: Record<string, any>) {
  const mediaSource: TUIMediaSourceViewModel = {
    sourceName: data.name,
    aliasName: data.name,
    left: 0,
    top: 0,
    muted: false,
    mediaSourceInfo: {
      sourceType: data.type,
      sourceId: data.id,
      zOrder: 1,
      rect: {
        left: 0,
        top: 0,
        right: data.width ||
            640,  
        bottom: data.height ||
            320,  
      }
    },
  };
  if (data.type === TUIMediaSourceType.kCamera) {
    mediaSource.resolution = {width: data.width, height: data.height};
    mediaSource.mediaSourceInfo.mirrorType = data.mirrorType;
    if (data.beautyConfig) {
      mediaSource.beautyConfig = data.beautyConfig;
    }
  } else if (data.type === TUIMediaSourceType.kScreen) {
    mediaSource.screenType = data.screenType;
  }

  if (mediaSource) {
    logger.log(`${logPrefix}addMediaSource:`, mediaSource);
    try {
      await mediaSourcesStore.addMediaSource(mediaSource);
      await mediaSourcesStore.selectMediaSource(mediaSource);
    } catch (error) {
      TUIMessageBox({
        title: t('Note'),
        message: (error as any).message,
        confirmButtonText: t('Sure'),
      });
    }
  }
}


function checkRectAndResolution(
  newSize: {width: number, height: number},
  rect: {left: number, top: number, right: number, bottom: number},
  rotation: TUIMediaRotation) {
  let width = rect.right - rect.left;
  let height = rect.bottom - rect.top;
  if (rotation === TUIMediaRotation.kMediaRotation90 ||
      rotation === TUIMediaRotation.kMediaRotation270) {
    const temp = width;
    width = height;
    height = temp;
  }
  const shrinkRate = width / newSize.width > height / newSize.height ?
    height / newSize.height :
    width / newSize.width;

  if (rotation === TUIMediaRotation.kMediaRotation90 ||
      rotation === TUIMediaRotation.kMediaRotation270) {
    rect.right = rect.left + Math.round(newSize.height * shrinkRate);
    rect.bottom = rect.top + Math.round(newSize.width * shrinkRate);
  } else {
    rect.right = rect.left + Math.round(newSize.width * shrinkRate);
    rect.bottom = rect.top + Math.round(newSize.height * shrinkRate);
  }
  return rect;
}


async function _updateScreenImageMediaSource(data: Record<string, any>) {
  logger.log(
    `${logPrefix}updateMediaSource predata:`, JSON.stringify(data.predata));
  if (data.id !== data.predata?.mediaSourceInfo.sourceId) {
    const newMediaSource: TUIMediaSourceViewModel = {
      sourceName: data.name,
      aliasName: data.predata.aliasName,
      left: data.predata?.left,
      top: data.predata?.top,
      muted: false,
      mediaSourceInfo: {
        sourceType: data.type,
        sourceId: data.id,
        zOrder: data.predata?.mediaSourceInfo.zOrder,
        rect: checkRectAndResolution({ width: data.width, height: data.height }, data.predata?.mediaSourceInfo.rect, data.predata?.mediaSourceInfo.rotation),
        rotation: data.predata?.mediaSourceInfo.rotation,
      }
    };

    if (data.type === TUIMediaSourceType.kScreen) {
      newMediaSource.screenType = data.screenType;
    }

    if (data.predata && newMediaSource) {
      logger.log(
        `${logPrefix}updateMediaSource newdata:`,
        JSON.stringify(newMediaSource));
      try {
        await mediaSourcesStore.replaceMediaSource(
          data.predata, newMediaSource);
        await mediaSourcesStore.selectMediaSource(newMediaSource);
      } catch (error) {
        TUIMessageBox({
          title: t('Note'),
          message: (error as any).message,
          confirmButtonText: t('Sure'),
        });
      }
    } else {
      logger.error(
        `${logPrefix}updateMediaSource invalid data:`, data.predata,
        newMediaSource);
    }
  } else {
    logger.warn(`${logPrefix}updateMediaSource with data not changed:`, data);
  }
}

async function _updateCameraMediaSource(data: Record<string, any>) {
  logger.log(
    `${logPrefix}updateMediaSource predata:`, JSON.stringify(data.predata));
  const newMediaSource: TUIMediaSourceViewModel = {
    sourceName: data.name,
    aliasName: data.predata.aliasName,
    left: data.predata?.left,
    top: data.predata?.top,
    muted: false,
    resolution: {
      width: data.width,
      height: data.height
    },
    mediaSourceInfo: {
      sourceType: data.type,
      sourceId: data.id,
      zOrder: data.predata?.mediaSourceInfo.zOrder,
      rect: checkRectAndResolution({ width: data.width, height: data.height }, data.predata?.mediaSourceInfo.rect, data.predata?.mediaSourceInfo.rotation),
      mirrorType: data.mirrorType,
      rotation: data.predata?.mediaSourceInfo.rotation,
    },
    beautyConfig: data.beautyConfig
  };
  logger.log(
    `${logPrefix}updateMediaSource newdata:`, JSON.stringify(newMediaSource));


  try {
    if (data.id === data.predata?.mediaSourceInfo.sourceId) {
      await mediaSourcesStore.updateMediaSource(newMediaSource);
    } else {
      await mediaSourcesStore.replaceMediaSource(data.predata, newMediaSource);
    }
    await mediaSourcesStore.selectMediaSource(newMediaSource);
  } catch (error) {
    TUIMessageBox({
      title: t('Note'),
      message: (error as any).message,
      confirmButtonText: t('Sure'),
    });
  }
}

export async function updateMediaSource(data: Record<string, any>) {
  switch (data.type) {
  case TUIMediaSourceType.kScreen:
  case TUIMediaSourceType.kImage:
    await _updateScreenImageMediaSource(data);
    break;
  case TUIMediaSourceType.kCamera:
    await _updateCameraMediaSource(data);
    break;
  default:
    logger.warn(
      `${logPrefix}updateMediaSource un-supported media type:`, data);
    break;
  }
}

async function handleUserApply(data: Record<string, any>) {
  const {agree} = data;
  const user = JSON.parse(data.user);
  if (user.userId) {
    roomStore.handleApplyToAnchorUser(user.userId, agree);
  }
}

async function handleKickSeat(data: Record<string, any>) {
  const {userId} = data;
  roomStore.kickUserOffSeat(userId);
}

async function handleKickOut(data: Record<string, any>) {
  const {userId} = data;
  roomStore.kickUserOutOfRoom(userId);
}

let childChannelServer: MessagePort;
async function handleChildWindowMessage(event: MessageEvent<any>) {
  console.log(`${logPrefix}handleChildWindowMessage:`, event.data);
  const {key, data} = event.data;

  switch (key) {
  case 'setCurrentDevice':
    deviceManager.setCurrentDevice(data.deviceType, data.deviceId);
    break;
  case 'startCameraDeviceTest':
    deviceManager.startCameraDeviceTest(data.windowID, data.rect);
    if (data.log) {
      trtcCloud?.log(data.log);
    }
    break;
  case 'setCameraTestRenderMirror':
    deviceManager.setCameraTestRenderMirror(data.mirror);
    break;
  case 'setCameraTestResolution':
    deviceManager.setCameraTestResolution(data.width, data.height);
    break;
  case 'setCameraTestDeviceId':
    deviceManager.setCameraTestDeviceId(data.cameraId);
    break;
  case 'stopCameraDeviceTest':
    deviceManager.stopCameraDeviceTest();
    break;
  case 'setCameraTestVideoPluginPath':
    if (data) {
      const beautyLibPath = await TRTCXmagicFactory.getEffectPluginLibPath();
      const beautyInitParam = await TRTCXmagicFactory.buildEffectInitParam(XmagicLicense);
      deviceManager.setCameraTestVideoPluginPath(beautyLibPath);
      deviceManager.setCameraTestVideoPluginParameter(JSON.stringify(beautyInitParam));
    }else{
      deviceManager.setCameraTestVideoPluginPath('');
    }
    break;
  case "setCameraTestVideoPluginParameter":
    deviceManager.setCameraTestVideoPluginParameter(JSON.stringify({
      beautySetting: Array.isArray(data) ? data : [data],
    }));
    break;
  case 'addMediaSource':
    addMediaSource(data);
    break;
  case 'updateMediaSource':
    updateMediaSource(data);
    break;
  case 'handleUserApply':
    handleUserApply(data);
    break;
  case 'cancelWheatPosition':
    handleKickSeat(data);
    break;
  case 'kickOut':
    handleKickOut(data);
    break;
  case 'startTestSpeaker':
    deviceManager.startSpeakerDeviceTest(data);
    break;
  case 'stopTestSpeaker':
    deviceManager.stopSpeakerDeviceTest();
    break;
  case 'startTestMic':
    deviceManager.startMicDeviceTest(data.interval, data.playback);
    break;
  case 'stopTestMic':
    deviceManager.stopMicDeviceTest();
    break;
  case 'resumePlayMusic': 
    if (data !== -1) {
      audioEffectManager.resumePlayMusic(data);
    }
    break;
  case 'pausePlayMusic': 
    if (data !== -1) {
      audioEffectManager.pausePlayMusic(data);
    }
    break;
  case 'stopPlayMusic': 
    if (data !== -1) {
      audioEffectManager.stopPlayMusic(data);
    }
    break;
  case 'setAllMusicVolume': 
    if (data >= 0) {
      audioEffectManager.setAllMusicVolume(data);
    }
    break;
  case 'setCurrentDeviceVolume': 
    if (data) {
      deviceManager.setCurrentDeviceVolume(data.type, data.volume);
    }
    break;
  case 'setMusicPublishVolume': 
    if (data) {
      data.id ? audioEffectManager.setMusicPublishVolume(data.id, data.volume) : null;
    }
    break;
  case 'seekMusicToPosInTime':
    if (data) {
      const {id, startTimeMS} = data;
      id && audioEffectManager.seekMusicToPosInTime(id, startTimeMS);
    }
    break;
  case 'singleLoopPlay':
    singleLoopPlay(data);
    break;
  case 'sequentialPlay':
    sequentialPlay(data);
    break;
  case 'updateMusicData':
    if (data) {
      musicDataStore.updateMusicData(data);
    }
    break;
  case 'updatePlayingMusicId':
    if (data) {
      musicDataStore.updatePlayingMusicId(data);
      childChannelServer.postMessage({
        key:"update-playing-music-id",
        data
      });
    }
    break;
  case 'setVoiceReverbType':
    if (data>=0) {
      audioEffectManager.setVoiceReverbType(data);
    }
    break;
  case 'setVoiceChangerType':
    if (data>=0) {
      audioEffectManager.setVoiceChangerType(data);
    }
    break;
  default:
    console.warn(
      `${logPrefix}handleChildWindowMessage: unsupported key: ${key}`);
    break;
  }
}
audioEffectManager.setMusicObserver({
  onStart: () => {
    return;
  },
  onPlayProgress: () => {
    return;
  },
  onComplete: (id: number) => {
    if (musicDataStore.musicData.currentPlayMode === PlayModeType.SingleLoopPlay) {
      childChannelServer.postMessage({key: 'update-playing-music-id', data:id});
    } else if (musicDataStore.musicData.currentPlayMode === PlayModeType.SequentialPlay) {
      let nextPlayingIndex = musicDataStore.getMusicIndex(id) + 1;
      if (nextPlayingIndex === musicDataStore.getMusicDataLength()) {
        nextPlayingIndex = 0;
      }
      const nextPlayingId = musicDataStore.musicData.musicDataList[nextPlayingIndex].id;
      childChannelServer.postMessage({key: 'update-playing-music-id', data:nextPlayingId});
    }
  }
});

async function singleLoopPlay(id:number) {
  if(id === -1) return;
  const startTimeMS = await audioEffectManager.getMusicCurrentPosInMS(id);
  const path = musicDataStore.getMusicPath(id);
  const playParams: TUIAudioMusicParam = {
    id,
    path,
    publish: true,
    loopCount: 0,
    isShortFile: false,
    startTimeMS: startTimeMS,
    endTimeMS: 0,
  };
  audioEffectManager.startPlayMusic(playParams);
}

async function sequentialPlay(playingMusicIndex: number) {
  const id = musicDataStore.musicData.musicDataList[playingMusicIndex].id;
  const path = musicDataStore.musicData.musicDataList[playingMusicIndex].path;
  const startTimeMS = await audioEffectManager.getMusicCurrentPosInMS(id);
  const playParams: TUIAudioMusicParam = {
    id,
    path,
    publish: true,
    loopCount: 0,
    isShortFile: false,
    startTimeMS: startTimeMS === -1 ? 0 : startTimeMS,
    endTimeMS: 0,
  };
  audioEffectManager.startPlayMusic(playParams);
}



export function initCommunicationChannels(data: Record<string, any>) {
  mediaSourcesStore = data.mediaSourcesStore;
  roomStore = data.roomStore;
  const childChannel = new MessageChannel();

  childChannelServer = childChannel.port1;
  const childChannelClient = childChannel.port2;
  childChannelServer.onmessage = handleChildWindowMessage;
  childChannelServer.onmessageerror = (event) => {
    console.log('onMessageFromChildWindowError', event.data);
  };
  childChannelServer.start();

  window.ipcRenderer.postMessage('port-to-child', null, [childChannelClient]);

  messageChannels.childWindowPort = childChannelServer;


  const contextChannel = new MessageChannel();

  const contextChannelServer = contextChannel.port1;
  const contextChannelClient = contextChannel.port2;

  contextChannelServer.onmessage = (event) => {
    console.log('onMessageFromContextWindow', event.data);
  };
  contextChannelServer.onmessageerror = (event) => {
    console.log('onMessageFromContextWindowError', event.data);
  };
  contextChannelServer.start();

  console.log('port-to-context');
  window.ipcRenderer.postMessage(
    'port-to-context', null, [contextChannelClient]);

  messageChannels.contextWindowPort = contextChannelServer;
}
