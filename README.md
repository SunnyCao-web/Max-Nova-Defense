# Max Nova Defense (Max新星防御)

一款基于 React + Vite + Tailwind CSS 开发的高性能塔防游戏，灵感来源于经典的《导弹指令》(Missile Command)。

## 🚀 快速开始

### 本地开发

1. 安装依赖：
   ```bash
   npm install
   ```

2. 启动开发服务器：
   ```bash
   npm run dev
   ```

3. 构建生产版本：
   ```bash
   npm run build
   ```

## 🌐 部署到 Vercel

1. 将代码上传到你的 **GitHub** 仓库。
2. 登录 [Vercel](https://vercel.com/)。
3. 点击 **"Add New"** -> **"Project"**。
4. 选择你的 GitHub 仓库并导入。
5. 在 **Environment Variables** 中（可选）：
   - 如果你后续集成了 Gemini AI，请添加 `GEMINI_API_KEY`。
6. 点击 **Deploy**。

## 🎮 游戏玩法

- **目标**：保护底部的城市不被坠落的火箭摧毁。
- **操作**：点击屏幕发射拦截弹。拦截弹会在点击位置爆炸，摧毁范围内的敌方火箭。
- **资源**：三个炮台各有有限的弹药，请合理分配。
- **胜利条件**：得分达到 1000 分。

## 🛠 技术栈

- **框架**: React 19
- **样式**: Tailwind CSS 4
- **动画**: Motion (Framer Motion)
- **渲染**: HTML5 Canvas API
- **图标**: Lucide React
