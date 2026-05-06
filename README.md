# 🍃 Breeze

**Breeze** 是一款基于 [Winget](https://github.com/microsoft/winget-cli) 构建的现代化 Windows 软件包管理器。它旨在为原本枯燥的命令行操作提供丝滑、美观且高效的 GUI 交互体验。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows-0078d4.svg)
![Framework](https://img.shields.io/badge/framework-Tauri%20%2B%20React-ff69b4.svg)

## ✨ 核心特性

- **极致美学设计**：采用毛玻璃特效 (Glassmorphism)、暗黑模式和灵动的微动画，打造桌面端的高级感。
- **瞬时响应**：针对 Winget 列表加载缓慢的问题，实现了后台静默预加载技术，页面切换零延迟。
- **智能环境自愈**：内置初始化引导，若系统缺失 Winget 环境，支持一键自动化部署与配置。
- **全生命周期管理**：
  - **发现**：海量软件一键搜索。
  - **安装**：实时彩虹进度条，精准捕捉下载与安装状态。
  - **更新**：一键检查全量升级，保持软件处于最新版本。
  - **卸载**：支持多级降级策略（ID/名称/模糊匹配），攻克顽固残留软件。
- **专业调试支持**：内置实时错误日志查看器，支持一键复制报错信息，方便排查底层问题。

## 🚀 技术栈

- **前端**: React 18 + TypeScript + Vite
- **后端**: Rust (Tauri)
- **样式**: Vanilla CSS (极简、高性能)
- **底层驱动**: Windows Package Manager (winget)

## 🛠️ 开始使用

### 前置要求
- Windows 10/11
- [Rust](https://www.rust-lang.org/) 环境 (仅开发需)
- [Node.js](https://nodejs.org/) (仅开发需)

### 开发运行
1. 克隆仓库
   ```bash
   git clone <your-repo-url>
   cd breeze
