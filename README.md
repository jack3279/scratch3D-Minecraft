# 🌍 Simple3D Pro Engine for TurboWarp

![Version](https://img.shields.io/badge/Version-Pro_1.0-blue.svg)
![Platform](https://img.shields.io/badge/Platform-TurboWarp/Scratch-orange.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

> **Simple3D Pro** 是一款专为 TurboWarp (Scratch 3.0 魔改版) 打造的工业级 3D 渲染扩展引擎。它打破了传统图形化编程的性能瓶颈，将现代 3A 游戏的底层技术（GPU 实例化、体素引擎、光照烘焙）完美封装成了积木！

## ✨ 核心震撼特性 (Core Features)

* 🧱 **Minecraft 级体素引擎 (Voxel Core)**
  * 原生支持光线步进 (Raymarching) 视线碰撞检测。
  * 支持 40,000+ 方块瞬间生成与剔除，极低 CPU 消耗。
  * 左键破坏、右键建造，自带镂空透视优化。
* ☀️ **宏观光照烘焙 (Macro Light Baking) & LOD**
  * 告别死黑阴影！算法自动解算山脉法线，将完美阴影烤入地形。
  * 根据海拔无缝缩放，防摩尔纹膨胀处理。
* 🌊 **GPU 硬件级水面动画 (Vertex Displacement)**
  * 零 CPU 消耗，利用着色器 (Shader) 内部正弦波算法实现波浪起伏。
* 🏃‍♂️ **GPU 硬件骨骼蒙皮 (Hardware Skinning)**
  * 支持导入 3D 人物骨骼权重，显卡并发计算几万个顶点动画，极致流畅。
* 🎨 **电影级 6 色地貌系统 (Technical Art)**
  * 支持自定义 海沟/沙滩/平原/森林/岩石/雪顶 6 级无缝高度渐变。

## 🚀 如何在 TurboWarp 中使用？
1.输入本引擎的直链地址并下载：https://jack3279.github.io/scratch3D-Minecraft/simple3Dpro21.js
2. 打开 [TurboWarp](https://turbowarp.org/) 网页编辑器或者本地的turbowrap软件。
3. 点击左下角的 **添加扩展 (Add Extension)。
4. 选择底部的 自定义扩展 (Custom Extension)。
 <img width="428" height="426" alt="image" src="https://github.com/user-attachments/assets/52e4e3d8-2885-4837-ae66-bb01de399f97" />
5. 选择文件选项卡，勾选在非沙盒环境运行，点击“未选择文件”按钮，上传下载的js文件。

## 🕹️ 快速上手 (Quick Start)

### 1. 宏观星球渲染管线
- 关闭全局光影。
- 使用 `[标准立方体]` 和 `45.5` 缩放倍数。
- 加载高清地球高度图与水波材质。
- <img width="776" height="477" alt="image" src="https://github.com/user-attachments/assets/6f3dfbb7-4a64-4fd5-a446-3a62ed4fa483" />
<img width="1031" height="814" alt="image" src="https://github.com/user-attachments/assets/185d708c-7e4d-46e4-bf31-c786021dd71a" />



### 2. 第一人称沙盒模式
- 锁定 FPS 鼠标。
- 使用 `[引擎：寻找方块返回 XYZ]` 积木实现精准挖矿。

## 🛠️ 待办清单与未来计划 (Roadmap)
- [x] 深度冲突 (Z-Fighting) 修复与透明水面镂空
- [ ] 动态加载外部 .GLB 带动画模型
- [ ] 物理引擎刚体碰撞接入 (Cannon.js)
- [ ] 体素世界的数据保存与读取 (JSON 导出)

## 🤝 参与贡献 (Contributing)
欢迎提交 Pull Request 或发布 Issues 探讨新功能！如果您用这个引擎做出了惊艳的游戏，欢迎在 Issues 里与我们分享！

## 📄 开源协议 (License)
本项目基于 MIT License 开源，教育与商业使用均不受限，但请保留原作者归属。
