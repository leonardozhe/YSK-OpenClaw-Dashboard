# YSK - OpenClaw Dashboard

[![Version](https://img.shields.io/badge/version-2.4-cyan)](https://github.com/leonardozhe/YSK-OpenClaw-Dashboard/releases)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![License](https://img.shields.io/badge/license-YSK%20Fan%20Exclusive-red)](https://github.com/leonardozhe/YSK-OpenClaw-Dashboard#-license)

![Screenshot](public/ScreenShot_2026-04-15_213037_098.png)

**English** | [中文](#中文文档)

---

## 🤖 Agent 安装方式（复制给 AI Agent）

> **使用方法**：将以下框内内容完整复制，发送给 OpenClaw、Hermes 或其他 AI 编程 Agent，Agent 将自动完成安装部署。

---

````
请帮我安装并部署 MeetClaw 监控系统。项目地址：https://github.com/leonardozhe/YSK-OpenClaw-Dashboard

请按以下步骤执行：

1. **克隆仓库**
   ```bash
   git clone https://github.com/leonardozhe/YSK-OpenClaw-Dashboard.git
   cd YSK-OpenClaw-Dashboard
   ```

2. **检查环境**
   - 确认 Node.js 版本 >= 20：`node -v`
   - 如果 Node.js 未安装，请先安装

3. **安装依赖**
   ```bash
   npm install
   ```

4. **构建并启动**
   ```bash
   npm run build
   npm start
   ```

5. **验证安装**
   - 确认服务运行在 http://localhost:4000
   - 检查终端输出无错误

6. **可选：配置 OpenClaw 连接**
   - 确保 `~/.openclaw/openclaw.json` 存在且配置正确
   - 系统将自动读取 OpenClaw 的配置信息

完成后告诉我访问地址和运行状态。
````

---

## 🚀 Quick Start

### Production Run (Recommended)

```bash
# Clone the repository
git clone https://github.com/leonardozhe/YSK-OpenClaw-Dashboard.git
cd YSK-OpenClaw-Dashboard

# Install dependencies
npm install

# Build and start production server
npm run build
npm start
```

Open [http://localhost:4000](http://localhost:4000) in your browser.

### Development Mode (For Customization)

If you need to modify the code for secondary development:

```bash
npm run dev
```

---

## 📋 Requirements

- Node.js 20+
- npm

## 🌐 Features

- **Device Monitoring**: Real-time GPU, CPU, memory usage
- **Agent Management**: View and manage all AI agents
- **System Status**: OpenClaw gateway service monitoring
- **Terminal Access**: WebSocket terminal (requires OpenClaw Gateway)
- **Log Viewer**: System runtime logs
- **Cron Jobs**: Manage scheduled tasks

## 📁 Project Structure

```
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/          # API Routes
│   │   ├── layout.tsx    # Root layout
│   │   └── page.tsx      # Home page
│   ├── components/       # React components
│   └── lib/              # Utilities
├── public/               # Static assets
├── next.config.ts        # Next.js config
└── package.json          # Dependencies
```

## 🎨 Customization

### Replace Brand Assets

You can customize the following assets to match your brand:

| Asset | File Path | Description |
|-------|-----------|-------------|
| **Logo** | `public/openclaw.png` | Main logo displayed in the header |
| **Avatar** | `public/avatar-team.png` | Default avatar for contacts |
| **Lobster Image** | `public/lobster.png` | Lobster character image |
| **Lobster Reference** | `public/lobster-ref.jpg` | Reference image for lobster animation |
| **Favicon** | `src/app/favicon.ico` | Browser tab icon |
| **Screenshot** | `public/ScreenShot_*.png` | README screenshot (update filename in README.md) |

### Modify Publishable Content

Before publishing, review and update:

1. **Project Name**: Search and replace "MeetClaw" with your project name
2. **GitHub URL**: Update all `github.com/leonardozhe/YSK-OpenClaw-Dashboard` references
3. **Screenshot**: Replace `public/ScreenShot_*.png` with your own screenshot
4. **Default Port**: Change port `4000` in `package.json` if needed

## 🔐 Installation Approval

When you first install and run YSK - OpenClaw Dashboard, a permission modal will appear:

### What to Expect

1. **First Launch**: A license agreement modal will appear on first run
2. **Content**: The modal displays the YSK fan exclusive license terms
3. **Actions**:
   - Click **"我已阅读并同意"** (I have read and agree) to proceed
   - Click **"拒绝并退出"** (Decline and exit) to decline
4. **Persistence**: Once accepted, the modal will not appear again (stored in localStorage)

### For Deployers

If you are deploying this for others:
- The permission modal appears only on **first installation**
- Users who have already agreed will not see the modal again
- To reset the permission state: `localStorage.removeItem('ysk-permission-agreed')`

---

## 📄 License

MIT License

**YSK 会员粉丝专属** - 免费使用，禁止商用

- ✅ YSK 会员粉丝可以免费使用本软件
- ❌ 禁止用于任何商业用途
- ❌ 禁止转售、分发或作为商业服务的一部分

---

## 📦 V2.3 更新内容

### ✨ 新功能
- **配置持久化导出/导入** - 设置弹窗新增配置管理功能，支持导出/导入/重置配置
- **24小时版本自动检测** - 每24小时检测GitHub Releases，发现新版本自动提示
- **向量记忆Recall检测** - 左侧监控面板新增向量记忆Recall功能状态检测（延迟检测）

### 🔧 修复
- 向量记忆插件检测优化 - 支持全局npm路径检测
- 版权信息布局修复 - 底部信息正确显示在聊天框下方，不重叠
- 配置导出优化 - 只导出系统设置，不包含聊天记录

### 📊 左侧监控面板增强
- 向量记忆状态：LanceDB插件、Recall功能、自动Recall、Ollama状态
- 新增待解决问题列表

### 🎨 UI优化
- 版本号移至底部中间：Powered by ClawBang.cn © 2026 All Rights Reserved V2.3
- 新版本提示按钮（带动画效果）
- 配置管理区域：导出配置、导入配置、重置设置

---

## 🤖 Agent 安装方式（复制给 AI Agent）

> **使用方法**：将以下框内内容完整复制，发送给 OpenClaw、Hermes 或其他 AI 编程 Agent，Agent 将自动完成安装部署。

---

````
请帮我安装并部署 MeetClaw 监控系统。项目地址：https://github.com/leonardozhe/YSK-OpenClaw-Dashboard

请按以下步骤执行：

1. **克隆仓库**
   ```bash
   git clone https://github.com/leonardozhe/YSK-OpenClaw-Dashboard.git
   cd YSK-OpenClaw-Dashboard
   ```

2. **检查环境**
   - 确认 Node.js 版本 >= 20：`node -v`
   - 如果 Node.js 未安装，请先安装

3. **安装依赖**
   ```bash
   npm install
   ```

4. **构建并启动**
   ```bash
   npm run build
   npm start
   ```

5. **验证安装**
   - 确认服务运行在 http://localhost:4000
   - 检查终端输出无错误

6. **可选：配置 OpenClaw 连接**
   - 确保 `~/.openclaw/openclaw.json` 存在且配置正确
   - 系统将自动读取 OpenClaw 的配置信息

完成后告诉我访问地址和运行状态。
````

---

## 中文文档

## 🚀 快速开始

### 生产运行（推荐）

```bash
# 克隆仓库
git clone https://github.com/leonardozhe/YSK-OpenClaw-Dashboard.git
cd YSK-OpenClaw-Dashboard

# 安装依赖
npm install

# 构建并启动生产服务器
npm run build
npm start
```

在浏览器中打开 [http://localhost:4000](http://localhost:4000)。

### 开发模式（二次开发）

如需自行修改代码进行二次开发：

```bash
npm run dev
```

---

## 📋 环境要求

- Node.js 20+
- npm

## 🌐 功能特性

- **设备监控**: 实时查看 GPU、CPU、内存使用情况
- **Agent 管理**: 查看和管理所有 AI Agent 状态
- **系统状态**: OpenClaw 网关服务状态监控
- **终端访问**: WebSocket 终端（需要 OpenClaw Gateway）
- **日志查看**: 查看系统运行日志
- **定时任务**: 管理 Cron 定时任务

## 📁 项目结构

```
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/          # API Routes
│   │   ├── layout.tsx    # 根布局
│   │   └── page.tsx      # 主页
│   ├── components/       # React 组件
│   └── lib/              # 工具库
├── public/               # 静态资源
├── next.config.ts        # Next.js 配置
└── package.json          # 依赖配置
```

## 🔐 安装审批

首次安装并运行 YSK - OpenClaw Dashboard 时，会出现权限审批弹窗：

### 审批流程

1. **首次启动**: 第一次运行时会显示许可协议弹窗
2. **弹窗内容**: 显示 YSK 会员粉丝专属许可条款
3. **操作选项**:
   - 点击 **"我已阅读并同意"** 继续使用
   - 点击 **"拒绝并退出"** 拒绝许可
4. **持久化**: 同意后弹窗不再显示（存储在 localStorage 中）

### 部署者须知

如果你是为他人部署：
- 权限弹窗仅在**首次安装**时出现
- 已同意的用户不会再看到弹窗
- 重置权限状态：`localStorage.removeItem('ysk-permission-agreed')`

---

## 🎨 自定义内容

### 替换品牌资源

你可以替换以下资源来匹配你的品牌：

| 资源 | 文件路径 | 说明 |
|------|---------|------|
| **Logo** | `public/openclaw.png` | 头部显示的主 Logo |
| **头像** | `public/avatar-team.png` | 联系人默认头像 |
| **龙虾图片** | `public/lobster.png` | 龙虾角色图片 |
| **龙虾参考图** | `public/lobster-ref.jpg` | 龙虾动画参考图片 |
| **Favicon** | `src/app/favicon.ico` | 浏览器标签页图标 |
| **截图** | `public/ScreenShot_*.png` | README 截图（需要同步更新 README.md 中的文件名） |

### 修改发布内容

发布前，请检查并更新：

1. **项目名称**: 搜索并替换 "MeetClaw" 为你的项目名称
2. **GitHub 地址**: 更新所有 `github.com/leonardozhe/YSK-OpenClaw-Dashboard` 引用
3. **截图**: 替换 `public/ScreenShot_*.png` 为你自己的截图
4. **默认端口**: 如需修改，在 `package.json` 中更改端口 `4000`

---

## 📄 许可证

MIT License

**YSK 会员粉丝专属** - 免费使用，禁止商用

- ✅ YSK 会员粉丝可以免费使用本软件
- ❌ 禁止用于任何商业用途
- ❌ 禁止转售、分发或作为商业服务的一部分
