[English](README.md) | 简体中文

# ultra-live-electron

本工程是一个桌面端直播推流工具，基于[腾讯云实时音视频技术](https://cloud.tencent.com/document/product/647)，快速开启在线直播。

## 前置依赖

- 操作系统要求: Windows 10+。
- 设备要求：需要有摄像头、扬声器、麦克风设备。

## 跑通代码

### 第一步：创建应用

1. 一键进入腾讯云实时音视频控制台的[应用管理](https://console.trtc.io/app)界面，选择创建应用，输入应用名称，例如 `TUIKitDemo`，单击 **创建**；
2. 点击对应应用条目后**应用信息**，记录 SDKAppID 和密钥：
   - `SDKAppID`：`TUIKitDemo`后括号里的一串数字。
   - `SDKSecretKey`：点击**复制SDKSecretKey**即可。

### 第二步：克隆代码并以开发模式运行
1. 克隆代码
```
git clone https://github.com/Tencent-RTC/ultra-live-electron.git

cd ultra-live-electron
```
2. 打开 `src/debug/basic-info-config.js` 文件，输入 `SDKAppID` 和 `SDKSecretKey`。

3. 以开发模式运行
```
npm install

npm run start
```

### 第三步：构建安装包
构建好的安装包在 `release` 目录下，可以按照运行。
```
npm run pack:win64
```

## 更多资料
1. [直通官网](https://cloud.tencent.com/document/product/647/105438)
2. [在线体验](https://cloud.tencent.com/document/product/647/17021)
3. [手机端开源库](https://github.com/Tencent-RTC/TUILiveKit)