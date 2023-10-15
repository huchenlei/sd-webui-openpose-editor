# Openpose Editor for ControlNet in Stable Diffusion WebUI

这个扩展专门为整合到 Stable Diffusion WebUI 的 ControlNet 扩展中而设计。

![editor_in_modal](/readme_assets/editor_in_modal.png)

# 外部环境
需要预先安装[ControlNet](https://github.com/Mikubill/sd-webui-controlnet) `1.1.216`+.

# 安装
从ControlNet扩展v1.1.411开始，用户不再需要在本地安装此扩展，因为ControlNet扩展现在使用远程端点https://huchenlei.github.io/sd-webui-openpose-editor/，如果未检测到本地编辑器安装。如果您的互联网连接差，或者连接到github.io域名有困难，仍然建议您在本地进行安装。

## 本地安装
![installation_guide](/readme_assets/install_guide.png)
![restart_ui_guide](/readme_assets/restart_ui_guide.png)

在 UI 重启后，此扩展将尝试从 Github 下载编译好的 Vue 应用程序。请检查 `stable-diffusion-webui\extensions\sd-webui-openpose-editor\dist` 是否存在且包含内容。

中国大陆的一些用户报告了使用自动更新脚本下载 dist 时遇到的问题。在这种情况下，用户有两种手动获取 dist 的方法：

### 选项1：构建应用程序
确保你已经准备好了 nodeJS 环境并遵循 `Development` 部分的步骤。运行 `npm run build` 来编译应用程序。

### 选项2：下载编译好的应用程序
你可以从 [发布](https://github.com/huchenlei/sd-webui-openpose-editor/releases) 页面下载编译好的应用程序（`dist.zip`）。在仓库的根目录解压该包，确保解压后的目录命名为 `dist`。

# 使用
Openpose 编辑器核心是使用 Vue3 构建的。gradio 扩展脚本是一个轻量级的包装器，它将 Vue3 应用程序挂载在 `/openpose_editor_index` 上。

用户可以直接在 `localhost:7860/openpose_editor_index` 访问编辑器，如果需要，但主要的入口点是在 ControlNet 扩展中调用编辑器。在 ControlNet 扩展中，选择任何 openpose 预处理器，然后点击运行预处理器按钮。将会生成一个预处理器结果预览。点击生成图像右下角的 `Edit` 按钮将会在一个模态中打开 openpose 编辑器。编辑后，点击 `Send pose to ControlNet` 按钮会将姿势发送回 ControlNet。

以下演示展示了基本的工作流程：
<!-- https://youtu.be/WEHVpPNIh8M -->
[![Basic Workflow](http://img.youtube.com/vi/WEHVpPNIh8M/0.jpg)](http://www.youtube.com/watch?v=WEHVpPNIh8M)

# 特性
1. 支持在 controlnet 中使用的面部/手部。
    - 该扩展能识别 controlnet 预处理结果中的面部/手部对象。
    - 如果预处理结果中遗漏了它们，用户可以添加面部/手部。可以通过以下两种方式实现：
        - 添加默认的手（面部不支持，因为面部的关键点太多（70个关键点），这使得手动调整它们变得非常困难。）
        - 通过上传一个姿势 JSON 来添加对象。将会使用第一人称的相应对象。
2. 可视性切换
    - 如果 ControlNet 预处理器无法识别一个关键点，它将会有 `(-1, -1)` 作为坐标。这种无效的关键点在编辑器中将被设置为不可见。
    - 如果用户将一个关键点设置为不可见并将姿势发送回 controlnet，该关键点连接的肢体段将不会被渲染。实际上，这就是你在编辑器中移除一个肢体段的方式。
3. 组切换
    - 如果你不想意外地选择和修改一个画布对象（手/面部/身体）的关键点。你可以将它们分组。分组后的对象会表现得像一个单一的对象。你可以对组进行缩放、旋转、扭曲。

# Development
## Recommended IDE Setup
[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur) + [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin).

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin) to make the TypeScript language service aware of `.vue` types.

If the standalone TypeScript plugin doesn't feel fast enough to you, Volar has also implemented a [Take Over Mode](https://github.com/johnsoncodehk/volar/discussions/471#discussioncomment-1361669) that is more performant. You can enable it by the following steps:

1. Disable the built-in TypeScript Extension
    1) Run `Extensions: Show Built-in Extensions` from VSCode's command palette
    2) Find `TypeScript and JavaScript Language Features`, right click and select `Disable (Workspace)`
2. Reload the VSCode window by running `Developer: Reload Window` from the command palette.

## Customize configuration

See [Vite Configuration Reference](https://vitejs.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
npm run test:unit
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
