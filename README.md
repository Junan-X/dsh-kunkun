# Kunkun skin（坤坤皮肤）

Shows the Kunkun mascot fixed at the bottom-right corner of the DeepSeek Harness shell.

在 DeepSeek Harness 界面右下角固定显示坤坤立绘。

## Install / 安装

```sh
dsh plugin add github:Junan-X/dsh-kunkun
```

Or in the app: **Plugins → Add plugin** and enter the package spec above.

也可在应用内「插件 → 添加插件」输入上面的安装命令。

Restart DSH after installing. 安装后重启 DSH 生效。

## Notes / 说明

- The mascot is decorative and non-interactive (`pointer-events: none`); it never blocks clicks on the UI underneath.
- The image is embedded in `client.js` as a data URI, so the plugin needs no asset server route.
- Disable the bundle in Plugins to remove the mascot; no other UI is changed.
- 立绘纯装饰、不拦截鼠标事件；图片以 data URI 内嵌，无需资源服务器。在插件页停用该 bundle 即可移除。

## License

MIT
