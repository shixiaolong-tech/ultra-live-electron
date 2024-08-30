import TUIRoomEngine, { TUIMediaMixingManager } from '@tencentcloud/tuiroom-engine-electron';
import { isMainWindow, getAppPath } from './envUtils';

export { TUIMediaSourceType, TUIMediaRotation, TUIResolutionMode }  from '@tencentcloud/tuiroom-engine-electron';

const logger = console;
const mediaMixingManager: TUIMediaMixingManager = TUIRoomEngine.getMediaMixingManager();

async function initMediaServer() {
  if (mediaMixingManager) {
    const isPackaged = location.href.startsWith("file");
    const resourcesPath = (globalThis as any).process.resourcesPath;
    let mediaServerPath = '';
    if (isPackaged) {
      mediaServerPath = `${resourcesPath}\\liteav_media_server.exe`;
    } else {
      const appPath = await getAppPath(); // app.getAppPath()
      mediaServerPath = `${appPath}\\node_modules\\trtc-electron-sdk\\build\\Release\\liteav_media_server.exe`; 
    }
    mediaMixingManager.setMediaServerPath(mediaServerPath);
  } else {
    logger.error(`Media Mixing Manager init failed.`);
  }
}

(async function(){
  const isMain = await isMainWindow();
  logger.log('Main window:', isMain);
  if (isMain) {
    await initMediaServer();
  }
})();

export default function useMediaMixingManager() {
  return mediaMixingManager;
}
