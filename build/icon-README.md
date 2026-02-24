# 应用图标

将打包用的图标放在本目录下，命名如下：

| 平台   | 文件名      | 说明 |
|--------|-------------|------|
| macOS  | `icon.icns` | 建议 512×512 或 1024×1024 源图导出 |
| Windows | `icon.ico` | 建议包含 256×256、48×48、32×32、16×16 等多尺寸 |

electron-builder 会根据 `electron-builder.json5` 中的 `"icon": "build/icon"` 自动按平台选用对应文件。
