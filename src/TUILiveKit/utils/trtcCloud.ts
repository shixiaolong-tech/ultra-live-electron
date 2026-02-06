import TRTCCloud, { TRTCLogLevel } from 'trtc-electron-sdk';

const trtcCloud  = TRTCCloud.getTRTCShareInstance({
  isIPCMode: true
});
trtcCloud.setLogLevel(TRTCLogLevel.TRTCLogLevelDebug);

(window as any)._trtcCloud = trtcCloud

export default trtcCloud;
