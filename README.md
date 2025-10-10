# 表情包管理器 - Meme Gallery

一个功能完善的表情包管理系统，基于 Cloudflare Pages + KV 构建，支持链接添加和本地上传，数据云端存储。

## ✨ 核心功能

### 📥 智能添加
- **链接识别**：自动识别三种格式（纯链接、Markdown、HTML）
- **仓库上传**：拖拽或选择图片，上传到 GitHub 仓库作为图床
- **仓库扫描**：自动检索 GitHub 仓库中的所有图片文件（需管理权限）
- **去重检测**：自动识别重复链接
- **格式支持**：JPG、PNG、GIF、WebP

### 🎨 强大管理
- **分类查看**：全部 / 链接添加 / 仓库图片
  - **全部**：智能排序，链接添加的图片优先显示在前面
  - **链接添加**：仅显示通过链接添加的表情包
  - **仓库图片**：仅显示 GitHub 仓库中的图片
- **标签管理**：为每个表情包添加多个标签，方便分类管理
- **实时搜索**：关键词搜索（300ms 防抖）
- **网格调整**：小(150px) / 中(200px) / 大(300px)
- **一键复制**：支持原始链接 / Markdown / HTML / 分享卡片 / 图片多格式；
  - 原始模式：优先复制图片本体，失败降级为链接
  - 分享卡片：复制带 OG 元信息的中转页链接
  - 图片模式：强制复制图片/GIF 到剪贴板（部分浏览器不支持）

### ☁️ 数据安全
- **云端存储**：Cloudflare KV 持久化存储
- **跨设备同步**：导出/导入 JSON 数据
- **管理保护**：默认密钥 `meme-gallery-2025`，可自定义
- **智能导出**：自动将上传图片转换为链接格式
- **频率限制**：上传间隔 3 秒，防止 API 滥用

### 📱 用户体验
- **响应式设计**：完美适配桌面和移动端
- **美观界面**：Gallery-first 设计理念
- **流畅交互**：统一网格、悬停预览
- **性能优化**：
  - 骨架屏加载：优雅的加载状态提示
  - CDN 加速：自动将 GitHub 图片转换为 jsDelivr CDN
  - 分页加载：每页显示 50 张,按需加载更多
  - 智能懒加载：Intersection Observer 实现视口内图片优先加载

## 🚀 快速开始

### 部署到 Cloudflare Pages

#### 1. 推送到 GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/zduu/meme-gallery.git
git push -u origin main
```

#### 2. 连接 Cloudflare Pages

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. 选择仓库 `meme-gallery`
4. 构建配置**全部留空**
5. 点击 **Save and Deploy**

#### 3. 配置环境

**必需配置：**

| 位置 | 操作 |
|------|------|
| **Settings** → **Functions** → **KV namespace bindings** | 添加绑定：`MEME_GALLERY_KV` |

**可选配置（Settings → Environment variables）：**

| 变量名 | 用途 | 示例值 | 默认值 |
|--------|------|--------|--------|
| `GITHUB_TOKEN` | GitHub 图床上传 | `ghp_xxxxxxxxxxxx` | - |
| `GITHUB_REPO` | GitHub 仓库 | `username/repo-name` | - |
| `GITHUB_BRANCH` | GitHub 分支 | `main` | `main` |
| `ADMIN_KEY` | 管理功能保护 | `my-secret-2025` | `meme-gallery-2025` |

**配置说明：**
- **GITHUB_TOKEN**：访问 [GitHub Settings](https://github.com/settings/tokens) 生成，需要 `repo` 权限
- **ADMIN_KEY**：自定义强密码，默认为 `meme-gallery-2025`，**强烈建议修改**

#### 4. 完成

✅ 访问你的 Pages 域名即可使用！

## 🎯 使用指南

### 添加表情包

**方式一：链接添加**
```
纯链接：https://example.com/image.gif
Markdown：![](https://example.com/image.gif)
HTML：<img src="https://example.com/image.gif">
```

**方式二：仓库上传**
1. 点击 ➕ → 📤 上传图片
2. 拖拽或选择图片（JPG/PNG/GIF/WebP，最大 10MB）
3. 输入名称（可选）→ 添加
4. **注意**：上传间隔最少 3 秒，防止 API 频率限制
5. 图片会被上传到配置的 GitHub 仓库，自动归类到"仓库图片"分类

### 分类查看

- **全部**：所有表情包（智能排序：链接添加的图片显示在前，仓库图片显示在后）
- **链接添加**：通过链接添加的表情包
- **仓库图片**：GitHub 仓库中的所有图片（包括手动上传和扫描发现的图片）

### 分享卡片复制

1. 在画廊卡片上点击 `📋` 复制按钮，并通过右上角菜单切换到“分享卡片”格式。
2. 复制成功后会得到一个 `https://你的域名/share/{id}` 形式的中转链接。
3. 将该链接粘贴到微信、QQ 等平台，客户端会读取页面中的 `og:*`/Twitter meta 信息自动生成预览卡片。
4. 链接打开时会展示一个包含标题、图片和描述的静态页面，便于分享者再次预览或下载表情。

### 管理功能

**导出数据**：
- 点击菜单 → 导出数据
- 自动将上传图片转换为链接格式
- 便于跨设备迁移

**扫描仓库（需管理权限）**：
1. 配置 GitHub 相关环境变量
2. 验证管理员权限后，点击"扫描仓库图片"
3. 自动检索仓库中所有图片文件（JPG、PNG、GIF、WebP）
4. 自动去重，只添加新图片
5. 扫描到的图片会被归类到"仓库图片"分类

**导入/清空（需管理权限）**：
1. 在前端页面点击 5 次 "🎨 Meme Gallery" 标题
2. 输入管理密钥进行验证（默认密钥：`meme-gallery-2025`）
3. 验证成功后显示导入和清空按钮
4. 管理权限在当前会话期间有效（刷新页面后需重新验证）

## 🧪 本地开发

### 方法 1：完整测试（推荐）

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 访问 http://localhost:8788
```

### 方法 2：快速预览

```bash
python3 -m http.server 8000
# 访问 http://localhost:8000
# 注意：仅前端，API 不可用
```

## 📝 API 接口

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/memes` | 获取所有表情包 | 公开 |
| POST | `/api/memes` | 添加表情包（链接） | 公开 |
| POST | `/api/upload` | 上传图片到 GitHub | 公开（3秒频率限制） |
| DELETE | `/api/memes/:id` | 删除表情包 | 公开 |
| GET | `/api/memes/search?q=关键词` | 搜索表情包 | 公开 |
| GET | `/api/memes/export` | 导出数据 | 公开 |
| POST | `/api/verify-key` | 验证管理密钥 | - |
| POST | `/api/scan-repo` | 扫描仓库图片 | 需管理权限 |
| POST | `/api/memes/import` | 导入数据 | 需管理权限 |
| DELETE | `/api/memes/clear` | 清空所有 | 需管理权限 |

## 🐛 常见问题

<details>
<summary><b>Q: 移动端分类栏遮挡表情包？</b></summary>

**A:** 已优化移动端布局间距：
- 768px 以下设备：画廊顶部间距 135px
- 480px 以下设备：画廊顶部间距 140px
- 确保分类栏不会遮挡任何表情包内容
</details>

<details>
<summary><b>Q: 手机上复制功能不正常？</b></summary>

**A:** 已优化复制功能，支持多种复制方式：
1. **优先使用** Clipboard API（现代浏览器）
2. **降级方案** execCommand（兼容旧版浏览器和某些移动设备）
3. 如果遇到权限问题，会自动尝试降级方案
4. 复制成功后会显示 ✅ 图标和成功提示
</details>

<details>
<summary><b>Q: 图片加载很慢怎么办？</b></summary>

**A:** 项目已内置多项性能优化：
1. **CDN 加速**：自动将 GitHub 图片转换为 jsDelivr CDN，国内访问更快
2. **分页加载**：每页仅加载 50 张图片，点击"加载更多"继续加载
3. **骨架屏**：加载时显示优雅的占位动画，提升用户体验
4. **智能懒加载**：使用 Intersection Observer，只加载视口内可见的图片
5. 如果图片仍然较慢，可以考虑使用图床服务（如 Cloudflare R2、七牛云等）
</details>

<details>
<summary><b>Q: 提示 "MEME_GALLERY_KV is not defined"</b></summary>

**A:** 需要在 Pages 项目设置中绑定 KV namespace：
- Settings → Functions → KV namespace bindings
- 添加绑定：`MEME_GALLERY_KV`
</details>

<details>
<summary><b>Q: 为什么看不到导入和清空按钮？</b></summary>

**A:** 这些功能需要管理权限：
1. 在前端页面点击 5 次 "🎨 Meme Gallery" 标题
2. 在弹出的验证框中输入密钥（默认：`meme-gallery-2025`）
3. 验证成功后导入、清空和扫描按钮会显示
4. 管理权限在当前会话有效，刷新页面需重新验证
5. 建议在 Cloudflare Pages 设置中配置自定义 `ADMIN_KEY`
</details>

<details>
<summary><b>Q: 上传功能提示 "未配置 GitHub 存储"</b></summary>

**A:** 需要配置环境变量：
- `GITHUB_TOKEN`：GitHub Personal Access Token (需要 repo 权限)
- `GITHUB_REPO`：仓库地址 (格式: `username/repo-name`)
</details>

<details>
<summary><b>Q: 导出的数据可以在其他设备使用吗？</b></summary>

**A:** 可以！导出时会自动将上传图片转换为链接格式：
- 不依赖原 GitHub 仓库配置
- 可在任何设备/项目导入
- 图片仍托管在原仓库，可正常访问
</details>

<details>
<summary><b>Q: 上传提示"上传过于频繁"？</b></summary>

**A:** 为了保护 GitHub API，上传功能有频率限制：
- 最小间隔：3 秒
- 如果触发限制，请等待提示的秒数后再试
- 这是为了防止 GitHub API 滥用和触发更严格的限制
</details>

<details>
<summary><b>Q: 管理密钥忘记了怎么办？</b></summary>

**A:** 访问 Cloudflare Dashboard：
- Pages → 你的项目 → Settings → Environment variables
- 查看或修改 `ADMIN_KEY` 的值
- 如果未设置，默认密钥是 `meme-gallery-2025`
</details>

<details>
<summary><b>Q: 本地测试时 API 不工作？</b></summary>

**A:** 使用 `npm run dev` 启动 Wrangler，而不是普通 HTTP 服务器。
</details>

## 💰 成本说明

Cloudflare 免费套餐：
- **Pages**：无限带宽和构建
- **KV**：1 GB 存储，每天 100,000 次读取
- **Functions**：每天 100,000 次请求

**个人使用完全免费！**

## 📦 项目结构

```
meme-gallery/
├── index.html                 # 前端页面骨架
├── style.css                  # UI 样式
├── app.js                     # 前端交互逻辑
├── functions/                 # Cloudflare Pages Functions
│   ├── api/
│   │   ├── memes.js           # 表情包列表增删查
│   │   ├── scan-repo.js       # 仓库图片扫描同步
│   │   ├── upload.js          # 上传图片到 GitHub
│   │   ├── verify-key.js      # 管理员密钥校验
│   │   ├── friends.js         # 友情链接增删查
│   │   ├── proxy.js           # 受限图床代理（hdslb/zhimg/pximg/sinaimg/byteimg/douyinpic/miyoushe）
│   │   └── memes/
│   │       ├── [id].js        # 删除单个表情包
│   │       ├── clear.js       # 清空全部数据
│   │       ├── export.js      # 导出数据
│   │       ├── import.js      # 导入数据
│   │       ├── search.js      # 搜索接口
│   │       └── tags.js        # 标签管理
│   └── share/
│       └── [id].js            # 生成带 OG Meta 的分享页
├── package.json
├── package-lock.json
└── README.md
```

## 🔧 技术栈

- **前端**：HTML5 + CSS3 + Vanilla JavaScript
- **后端**：Cloudflare Pages Functions (Workers)
- **存储**：Cloudflare KV + GitHub
- **特性**：零配置、一键部署、响应式设计

## 📝 重要提示

⚠️ **必须配置**
- KV Namespace 绑定：`MEME_GALLERY_KV`

⚙️ **可选配置**
- GitHub 图床：`GITHUB_TOKEN`、`GITHUB_REPO`
- 管理保护：`ADMIN_KEY`（默认：`meme-gallery-2025`，**强烈建议修改**）

🔐 **安全建议**
- 使用强随机密码作为 `ADMIN_KEY`（不要使用默认密钥）
- 不要在公开场合分享 GitHub Token 和 ADMIN_KEY
- 定期导出数据备份
- 管理权限在会话期间有效（sessionStorage），页面刷新后需重新验证
- 验证密钥通过 HTTPS 加密传输，不会在 URL 中暴露
- 上传功能有频率限制（3秒/次），防止 API 滥用

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

**🎉 享受你的表情包管理之旅！**
