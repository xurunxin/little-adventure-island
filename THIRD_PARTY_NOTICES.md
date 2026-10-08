# 资源来源与第三方授权

- 项目插画由图像生成模型制作，原始 PNG、运行时 WebP 和动画图集随仓库提供。生成提示词记录在 `design/*-prompt.txt` 与 `design/content-update-1.0.2.json`，优化清单为 `design/art-manifest.json`。`generated-images/` 是来源标记，并非仓库中的依赖目录。
- 内置普通话语音通过 MiniMax TTS / mmx CLI 生成，朗读文本为 `scripts/audio-texts.json`，模型、音色与文件摘要为 `design/audio-manifest.json`。运行时使用 `public/audio/`，无需在线重新生成。
- `public/assets/adventure.ttf` 为 ZCOOL KuaiLe，版权归 ZCOOL KuaiLe Project Authors，使用 SIL Open Font License 1.1；完整许可为 `public/assets/font-license.txt`。
- `public/assets/sql-wasm.wasm` 来自 sql.js，版权归 sql.js authors，使用 MIT 许可；完整许可为 `public/assets/sql-js-license.txt`。
- 其他 npm 与 Android 依赖遵循各自上游许可，依赖版本分别记录在 `package-lock.json` 与 Android Gradle 配置中。

以上是来源及第三方许可记录，不代表为项目自身的代码或生成素材授予新的统一许可。
