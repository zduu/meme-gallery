# 表情包管理器 - Meme Gallery

一个功能完善的表情包管理系统，基于 Cloudflare Pages + KV 构建，支持链接添加和本地上传，数据云端存储。

## ✨ 核心功能

### 📥 智能添加
- **链接识别**：自动识别三种格式（纯链接、Markdown、HTML）
- **本地上传**：拖拽或选择图片，上传到 GitHub 作为图床
- **去重检测**：自动识别重复链接

### 🎨 强大管理
- **分类查看**：全部 / 链接添加 / 本地上传
- **实时搜索**：关键词搜索（300ms 防抖）
- **网格调整**：小(150px) / 中(200px) / 大(300px)
- **一键复制**：快速复制表情包链接

### ☁️ 数据安全
- **云端存储**：Cloudflare KV 持久化存储
- **跨设备同步**：导出/导入 JSON 数据
- **管理保护**：管理密钥保护敏感操作
- **智能导出**：自动将上传图片转换为链接格式

### 📱 用户体验
- **响应式设计**：完美适配桌面和移动端
- **美观界面**：Gallery-first 设计理念
- **流畅交互**：统一网格、悬停预览

## 🚀 快速开始

### 部署到 Cloudflare Pages

#### 1. 推送到 GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/meme-gallery.git
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

| 变量名 | 用途 | 示例值 |
|--------|------|--------|
| `GITHUB_TOKEN` | GitHub 图床上传 | `ghp_xxxxxxxxxxxx` |
| `GITHUB_REPO` | GitHub 仓库 | `username/repo-name` |
| `GITHUB_BRANCH` | GitHub 分支 | `main` (默认) |
| `ADMIN_KEY` | 管理功能保护 | `my-secret-2024` |

**配置说明：**
- **GITHUB_TOKEN**：访问 [GitHub Settings](https://github.com/settings/tokens) 生成，需要 `repo` 权限
- **ADMIN_KEY**：自定义强密码，保护导入和清空功能

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

**方式二：本地上传**
1. 点击 ➕ → 📤 上传图片
2. 拖拽或选择图片（JPG/PNG/GIF/WEBP，最大 10MB）
3. 输入名称（可选）→ 添加

### 分类查看

- **全部**：所有表情包
- **链接添加**：通过链接添加的表情包
- **本地上传**：上传到 GitHub 的表情包

### 管理功能

**导出数据**：
- 点击菜单 → 导出数据
- 自动将上传图片转换为链接格式
- 便于跨设备迁移

**导入/清空（需管理权限）**：
1. 配置 `ADMIN_KEY` 环境变量
2. 访问 `https://your-site.pages.dev/?key=你的密钥`
3. 验证成功后显示管理按钮

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
| POST | `/api/upload` | 上传图片到 GitHub | 公开 |
| DELETE | `/api/memes/:id` | 删除表情包 | 公开 |
| GET | `/api/memes/search?q=关键词` | 搜索表情包 | 公开 |
| GET | `/api/memes/export` | 导出数据 | 公开 |
| POST | `/api/verify-key` | 验证管理密钥 | - |
| POST | `/api/memes/import` | 导入数据 | 需管理权限 |
| DELETE | `/api/memes/clear` | 清空所有 | 需管理权限 |

## 🐛 常见问题

<details>
<summary><b>Q: 提示 "MEME_GALLERY_KV is not defined"</b></summary>

**A:** 需要在 Pages 项目设置中绑定 KV namespace：
- Settings → Functions → KV namespace bindings
- 添加绑定：`MEME_GALLERY_KV`
</details>

<details>
<summary><b>Q: 为什么看不到导入和清空按钮？</b></summary>

**A:** 这些功能需要管理权限：
1. 配置环境变量 `ADMIN_KEY`
2. 访问 `https://your-site.pages.dev/?key=你的密钥`
3. 验证成功后按钮会显示
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
<summary><b>Q: 管理密钥忘记了怎么办？</b></summary>

**A:** 访问 Cloudflare Dashboard：
- Pages → 你的项目 → Settings → Environment variables
- 查看或修改 `ADMIN_KEY` 的值
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
├── index.html              # 前端页面
├── style.css               # 样式文件
├── app.js                  # 前端逻辑
├── functions/              # Pages Functions API
│   └── api/
│       ├── memes.js        # 表情包增删查
│       ├── upload.js       # GitHub 图床上传
│       ├── verify-key.js   # 管理密钥验证
│       └── memes/
│           ├── [id].js     # 删除单个
│           ├── search.js   # 搜索
│           ├── export.js   # 导出
│           ├── import.js   # 导入（需权限）
│           └── clear.js    # 清空（需权限）
├── package.json
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
- 管理保护：`ADMIN_KEY`（强烈推荐）

🔐 **安全建议**
- 使用强随机密码作为 `ADMIN_KEY`
- 不要在公开场合分享 GitHub Token
- 定期导出数据备份
- 管理权限每次刷新后需重新验证

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

---

**🎉 享受你的表情包管理之旅！**
