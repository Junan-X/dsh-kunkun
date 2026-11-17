# Kunkun skin（坤坤皮肤）

Shows the Kunkun mascot fixed at the bottom-right corner of the DeepSeek Harness shell, with a settings page to switch the image — including your own uploaded picture.

在 DeepSeek Harness 界面右下角固定显示坤坤立绘，并提供设置页切换立绘（静态图 / 篮球动图 / 自己上传的图片）。

## Install / 安装

```sh
dsh plugin add github:Junan-X/dsh-kunkun
```

Or in the app: **Plugins → Add plugin** and enter the package spec above.

也可在应用内「插件 → 添加插件」输入上面的安装命令。

Restart DSH after installing. 安装后重启 DSH 生效。

## Settings / 设置

Two entries open the same panel: **Settings → Kunkun skin**, or the bundle's own page under **Plugins → dsh-kunkun**.

两个入口打开同一面板：**设置 → 坤坤皮肤**，或 **插件 → dsh-kunkun** 详情页配置区。

| Setting | Default | Behavior |
| --- | --- | --- |
| Show mascot / 显示坤坤立绘 | on | Off hides the mascot; the settings entry stays available. |
| Mascot image / 立绘样式 | basketball animation | Switch between the still Kunkun, the basketball animation, and an uploaded custom image (GIF/WebP/PNG/JPEG, ≤ 5 MB, stored in IndexedDB). |

## Effort slider / 推理等级滑块

A slider sits in the composer toolbar (**conversation.input.right**, next to the model selector):

输入框工具排（模型选择器旁）有一个滑块：

- **Drag** — the basketball animation speed follows the slider live (0.5×–2×, continuous).
- **Release** — the nearest reasoning-effort stop is committed through the official ModelDirectory (`session.selectModel`), exactly like the effort control of the host.
- Stops come from the current model's `reasoning.efforts`; models without ≥2 efforts (and addressed subagent sessions) hide the slider.
- If the model-directory service is unavailable the slider silently disappears — the rest of the skin keeps working.
- **拖动**时篮球动图播放速度实时跟随（0.5×–2× 连续变速）；**松手**时通过官方 ModelDirectory 提交最近的推理等级档位。档位读自当前模型 `reasoning.efforts`；不支持推理或只有 1 档的模型、以及子代理会话不显示滑块。速度由 CSS `steps()` 精灵条驱动（`<img>` GIF 无法调速，所以内置动图改为逐帧精灵条）。

## Notes / 说明

- The mascot is decorative and non-interactive (`pointer-events: none`); it never blocks clicks on the UI underneath.
- Built-in images are embedded in `client.js` as data URIs; an uploaded image lives in the browser's IndexedDB, so nothing is sent over the network.
- Disable the bundle in Plugins to remove the mascot; no other UI is changed.
- 立绘纯装饰、不拦截鼠标事件；内置图片以 data URI 内嵌，上传图片存在浏览器 IndexedDB，不联网。在插件页停用该 bundle 即可移除。

## License

MIT
