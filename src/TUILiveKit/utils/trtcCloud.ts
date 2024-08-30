import TRTCCloud from 'trtc-electron-sdk';
import { TUIVideoResolution } from '@tencentcloud/tuiroom-engine-electron';

const trtcCloud  = TRTCCloud.getTRTCShareInstance();

export default trtcCloud;

type TUIVideoResolutionType = Record<string|number, {
  width: number;
  height: number;
}>;

const initResolutionMap = (): TUIVideoResolutionType => {
  const map: TUIVideoResolutionType = {};
  for (const key in TUIVideoResolution) {
    const isValueProperty = parseInt(key, 10) >= 0;
    if (!isValueProperty) {
      const value = TUIVideoResolution[key];
      const tmp = key.split('_');
      map[value] = {
        width: parseInt(tmp[1]),
        height: parseInt(tmp[2]),
      }
    }
  }
  return map;
}

export const resolutionMap:TUIVideoResolutionType  = initResolutionMap();
