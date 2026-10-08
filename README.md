# 小小冒险岛

[![CI](https://github.com/xurunxin/little-adventure-island/actions/workflows/ci.yml/badge.svg)](https://github.com/xurunxin/little-adventure-island/actions/workflows/ci.yml)

给 4–5 岁儿童使用的安卓横屏任务与奖励 App。React + TypeScript + PixiJS + Capacitor；默认内容、插画和普通话语音随 APK 安装，任务与积分保存在本机 SQLite。

## 使用

首次启动时和家长一起选择狐狸、兔子或小熊，为伙伴起名，设置六位密码并保存恢复码。推荐启用五项任务；家长确认奖励价格后上架。

孩子领取任务，现实中完成后点击“我完成啦”。只有家长确认才获得积分和 10 点经验。兑换先预留积分，家长批准后扣分并生成奖励券，实际兑现再标记完成。奖励价格和任务积分按申请时保存的快照结算；重复操作不会重复记账。

家长设置中可以编辑任务、录音、审核、查询记录、调整声音和特效、导出/恢复备份。备份包含自定义图片和语音；恢复前自动保存当前数据副本。

## 伙伴对话与 AI 内容

家长可选择开启联网语音对话。按住话筒说话，松开后使用 MiniMax ASR → LLM → TTS 回答，每次最长 15 秒。积分、任务和兑换回答由本地状态生成，聊天不能发奖或改动数据。录音和对话只短暂保留在内存中，退出或切到后台停止录音、请求和播放。

任务编辑支持 LLM 优化配图提示词、MiniMax 生图、放大/调整位置裁剪为 640×640 WebP，以及生成任务朗读。内容经家长保存后才发布给孩子。

音色设计直接调用 `POST /v1/voice_design`，使用返回的 `voice_id` 调用 TTS 后保存。支持读取账号已有设计音色及手动填写已有 ID。能否新建音色取决于账号套餐；返回 2061 时可使用内置音色、已有设计音色或更换支持该能力的 Key。

## 密钥

开发预览的本机代理从进程环境变量 `MINIMAX_CN_API_KEY` 读取凭据，仅允许本机访问。安卓 App 的密钥使用 Android Keystore AES-GCM 加密保存在设备上，不进入网页、安装包或数据备份。

安装并首次打开 App 后，可在家长设置选择“从电脑导入”，在两分钟内运行：

```powershell
npm run ai:import -- <device-serial>
```

脚本读取环境变量，使用平板公开的 RSA 公钥封装 AES 会话密钥，将加密信封发送到平板。没有明文密钥文件或明文 adb 参数。首次尚未完成设置时也可导入；已配置的 App 需要家长打开导入窗口才能替换。

先通过 `adb devices` 获取设备序列号，并替换命令中的 `<device-serial>`。`.env.example` 仅说明变量名称，开发服务器不会自动读取 `.env`；请在当前终端或操作系统中配置环境变量。不要把真实密钥写入源码、issue 或提交记录。

## 开发与构建

当前脚本面向 Windows，需 Node.js 24、PowerShell 7（`pwsh.exe`）。Android 构建另需 JDK 21、Android SDK 36 与 Platform Tools；在 Android Studio 中设置 SDK 路径，或配置本机 `android/local.properties`。首次克隆无需重新生成美术或语音，资源已包含在仓库中。

```powershell
npm ci
npm run dev -- --host 127.0.0.1 --port 4173
# 在另一个终端运行检查和构建
npm test
npm run test:sites
npm run android:sync
./android/gradlew.bat -p android assemblePersonalDebug
```

GitHub Actions 在 Windows 上自动运行业务测试、Sites 测试与生产构建。生成文件位于 `dist/`；Android 调试 APK 位于 `android/app/build/outputs/apk/personal/debug/`。构建脚本中的资源裁剪仅操作生成目录。

`?design=1` 是开发模式专用的内存示例，示例密码 123456。正式 APK 不启用该模式，不包含预设家长密码。

发布签名保存在忽略的 `android/signing/` 与 `android/signing.properties` 中。请保留签名密钥，后续更新需沿用。打包时只复制压缩插画与动画图集，原始 PNG 在 `public/assets/` 和美术来源记录中保留。

本项目维护者已有更新签名，不要运行生成脚本替换它。其他开发者首次建立自己的独立发行版时，可安装 RTK 后运行 `pwsh.exe -NoProfile -File scripts/prepare-signing.ps1`，再执行 `./android/gradlew.bat -p android assemblePersonalRelease`；新的签名无法覆盖已有签名不同的安装。APK、签名、验收报告、生成缓存和本机数据库不纳入 Git。

内置 35 条语音由 `scripts/build-mmx-audio.ps1` 调用 mmx / speech-2.8-hd 生成，清单位于 `design/audio-manifest.json`。重新生成需安装 mmx CLI、RTK 并配置 `MINIMAX_CN_API_KEY`，运行 `npm run audio:generate`。图像来源及优化记录位于 `design/art-manifest.json`，64 项启动预载资源位于 `public/assets/preload.json`。资源来源与第三方授权见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

主要目录：`src/` 为界面和业务状态，`android/` 为原生插件与安卓工程，`server/` 为本机开发 AI 代理，`public/` 为离线资源，`design/` 为美术提示词和资源清单，`tests/` 与 `scripts/` 为测试及维护工具。

## 验收

业务测试覆盖审批幂等、预留积分、余额不足、跨日、日期回拨、价格与图片快照、备份校验、密码摘要和后台锁定。浏览器已验证真实提供方的生成配图/裁剪/朗读及对话链路；语音链路使用已有生成音频作为测试麦克风流，不能替代平板真实麦克风验收。

真机验收使用独立 `.qa` 包，不接触孩子正式数据：

```powershell
node --import tsx scripts/create-qa-fixture.ts
./android/gradlew.bat -p android assembleQaDebug assembleQaDebugAndroidTest
pwsh.exe -NoProfile -File scripts/run-tablet-acceptance.ps1 -Serial <device-serial>
```

脚本安装独立验收包，准备测试数据库，临时关闭网络，运行领取/审批/兑换/兑现、重建和 15 分钟 WebGL 帧率测试，最后恢复原网络状态。USB 安装被平板系统限制时，需要设备主人启用 USB 安装并接受安装提示；不要把 APK 构建成功当作真机验收通过。

运行前先完成 `npm run android:sync`。验收证据只写入本地忽略的 `evidence/`；`design-qa.md` 是早期视觉验收快照，后续真机修复见下面版本记录。15 分钟离线与性能验收尚未完成，不属于已通过项目。

### 1.0.1 麦克风修复

补齐 Capacitor WebView 同时检查的 `MODIFY_AUDIO_SETTINGS` 权限；录音权限被拒绝时显示麦克风提示。话筒只跟踪当前主触点，取消或丢失触点捕获时停止录音，长按不弹出系统菜单。

2026-10-09 在目标平板完成真实麦克风与触控回归：旧版返回 `NotAllowedError`，新版持续按住 2 秒、移出按钮继续录音、松开仅提交一次、取消及短点击不提交均通过。提供方响应使用本地测试桩，录音未上传；此测试不代表真实 ASR/LLM/TTS 联网链路或 15 分钟性能验收。记录为 `evidence/voice-before.json` 和 `evidence/voice-after.json`。

```powershell
node --import tsx scripts/create-qa-fixture.ts
./android/gradlew.bat -p android assembleQaDebug assembleQaDebugAndroidTest
pwsh.exe -NoProfile -File scripts/run-voice-acceptance.ps1 -Phase After -Serial <device-serial>
```

验收包隔离在 `.qa` 应用中。正式修复版为 `releases/小小冒险岛-1.0.1.apk`，沿用 1.0.0 签名，覆盖安装保留原应用数据和加密密钥。

### 1.0.2 音色与图片

默认伙伴音色改为 MiniMax `Chinese (Mandarin)_Cute_Spirit`（憨憨萌兽），35 条内置普通话由 mmx CLI / speech-2.8-hd 重新生成，语速 0.92。升级时原默认音色自动迁移，专属 voice_id 保留。生成缓存按音色隔离，并检查输入文本，避免把旧音频当作新音色复用。

新增家长编辑图库图片「神秘礼物」与「自己阅读」，可用于自定义奖励/任务，启动预载共 64 项。图片库独立于任务和奖励模板，不自动发布任务或设置兑换价格。图片白名单覆盖配置、历史快照及备份恢复。

两张插画由内置 image_gen 生成，原图和 640×640 WebP 保存于 `public/assets/rewards/mystery-gift.*`、`public/assets/tasks/read-alone.*`；生成提示词记录为 `design/content-update-1.0.2.json`。正式 APK 为 `releases/小小冒险岛-1.0.2.apk`，沿用原签名，覆盖更新保留应用数据。
