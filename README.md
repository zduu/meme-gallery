# 表情包管理器 - Meme Gallery

一个使用 Cloudflare Pages + KV 存储的表情包管理系统，支持静态图片和动态 GIF，数据存储在云端。

## ✨ 功能特点

- 📥 **智能识别**：自动识别三种格式的图片链接
  - 纯链接：`https://example.com/image.gif`
  - Markdown：`![](https://example.com/image.gif)`
  - HTML：`<img src="https://example.com/image.gif">`

- 🎨 **表情包管理**
  - 添加/删除表情包
  - 自定义表情包名称
  - 实时搜索功能（防抖优化）
  - 预览静态和动态图片

- 📋 **一键复制**：快速复制表情包链接

- ☁️ **云端存储**
  - Cloudflare KV 存储
  - 跨设备同步
  - 数据持久化
  - 导出/导入 JSON 数据

- 📱 **响应式设计**：适配桌面端和移动端

## 📦 项目结构

```
meme-gallery/
├── index.html                      # 前端页面
├── style.css                       # 样式文件
├── app.js                          # 前端逻辑
├── functions/                      # Pages Functions (API)
│   └── api/
│       ├── memes.js               # GET/POST /api/memes
│       └── memes/
│           ├── [id].js            # DELETE /api/memes/:id
│           ├── search.js          # GET /api/memes/search
│           ├── export.js          # GET /api/memes/export
│           ├── import.js          # POST /api/memes/import
│           └── clear.js           # DELETE /api/memes/clear
├── package.json                    # NPM 配置
├── .gitignore
└── README.md
```

## 🧪 本地测试

### 方法 1：Wrangler 完整测试（推荐）

完整模拟生产环境，支持 Pages Functions + KV。

```bash
# 安装 Wrangler
npm install -g wrangler

# 安装项目依赖
cd meme-gallery
npm install

# 启动开发服务器（本地模拟 KV）
npm run dev

# 访问 http://localhost:8788
```

**优点：**
- ✅ 完整的 API 功能
- ✅ 本地 KV 模拟（无需登录）
- ✅ 热重载
- ✅ 实时日志

### 方法 2：纯静态测试（快速预览）

只测试前端界面，API 功能不可用。

```bash
# 使用 Python
python3 -m http.server 8000

# 或使用 Node.js
npx http-server -p 8000

# 访问 http://localhost:8000
```

### 方法 3：使用远程 KV 测试

测试真实的云端存储。

```bash
# 登录 Cloudflare
wrangler login

# 创建预览 KV
wrangler kv:namespace create MEME_GALLERY_KV --preview
# 记录返回的 preview_id

# 使用远程 KV 启动
wrangler pages dev . --kv MEME_GALLERY_KV=YOUR_PREVIEW_KV_ID

# 访问 http://localhost:8788
```

### 测试功能清单

部署前确保以下功能正常：

- [ ] 添加表情包（纯链接 / Markdown / HTML）
- [ ] 删除表情包
- [ ] 搜索表情包
- [ ] 复制链接到剪贴板
- [ ] 导出 JSON 数据
- [ ] 导入 JSON 数据
- [ ] 清空所有数据
- [ ] 响应式布局（手机/桌面）
- [ ] GIF 动图播放

## 🚀 部署到 Cloudflare Pages

### 方法 A：Git 部署（推荐）

#### 1️⃣ 推送到 GitHub

```bash
git init
git add .
git commit -m "Initial commit: 表情包管理器"
git remote add origin https://github.com/YOUR_USERNAME/meme-gallery.git
git branch -M main
git push -u origin main
```

#### 2️⃣ 连接到 Cloudflare Pages

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
3. 选择你的 GitHub 仓库 `meme-gallery`
4. 构建设置**全部留空**（无需任何配置）
5. 点击 **Save and Deploy**

#### 3️⃣ 绑定 KV 存储

部署完成后：

1. 进入你的 Pages 项目
2. **Settings** → **Functions** → **KV namespace bindings**
3. 点击 **Add binding**：
   - **Variable name**: `MEME_GALLERY_KV`（必须完全一致）
   - **KV namespace**: 创建新的或选择现有的
4. 保存设置

✅ 完成！访问你的 Pages 域名开始使用。

### 方法 B：直接上传（无需 Git）

#### 1️⃣ 压缩并上传

1. 将整个 `meme-gallery` 文件夹打包为 zip（包含 `functions` 文件夹）
2. Cloudflare Dashboard → **Workers & Pages** → **Create application** → **Pages** → **Upload assets**
3. 上传 zip 文件并部署

#### 2️⃣ 绑定 KV

同上面的第 3 步。

## 🔧 技术栈

- **前端**：HTML5 + CSS3 + JavaScript (ES6+)
- **后端**：Cloudflare Pages Functions（基于 Workers）
- **存储**：Cloudflare KV（键值存储）
- **特点**：零配置，一键部署

## 📝 API 接口说明

所有 API 通过 Pages Functions 自动处理：

- `GET /api/memes` - 获取所有表情包
- `POST /api/memes` - 添加表情包
- `DELETE /api/memes/:id` - 删除表情包
- `GET /api/memes/search?q=关键词` - 搜索表情包
- `GET /api/memes/export` - 导出数据
- `POST /api/memes/import` - 导入数据
- `DELETE /api/memes/clear` - 清空所有

## 🎯 使用说明

### 添加表情包

支持三种格式，粘贴后自动识别：

```
https://example.com/meme.gif
![表情包](https://example.com/meme.gif)
<img src="https://example.com/meme.gif">
```

### 搜索表情包

在搜索框输入关键词，实时搜索（300ms 防抖）

### 数据管理

- **导出**：下载 JSON 文件备份
- **导入**：从 JSON 文件恢复
- **清空**：删除所有数据（需确认）

## 💰 成本说明

Cloudflare 免费套餐包括：

- **Pages**：无限带宽和构建
- **KV**：1 GB 存储，每天 100,000 次读取
- **Functions**：每天 100,000 次请求

**个人使用完全免费！**

## 🌐 浏览器兼容性

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- 移动端浏览器

## 🐛 常见问题

### Q: 提示 "MEME_GALLERY_KV is not defined"

**A:** 需要在 Pages 项目设置中绑定 KV namespace，变量名必须是 `MEME_GALLERY_KV`。

### Q: 如何查看 KV 存储的数据？

**A:** Cloudflare Dashboard → Workers & Pages → KV → 选择你的 namespace → 查看 key `memes`

### Q: 可以迁移数据吗？

**A:** 使用导出功能下载 JSON，在新项目中导入即可。

### Q: 本地测试时 API 不工作？

**A:** 使用 `npm run dev` 启动 Wrangler 开发服务器，而不是普通的 HTTP 服务器。

### Q: `wrangler: command not found`

**A:** 运行 `npm install -g wrangler` 安装 Wrangler CLI。

### Q: 修改代码后没有生效？

**A:** Wrangler 支持热重载，刷新浏览器即可。如果还是没有生效，重启 `npm run dev`。

### Q: 端口被占用怎么办？

**A:** 使用 `wrangler pages dev . --port 8080` 更改端口。

## 💡 进阶技巧

### 自定义域名

Pages 设置 → Custom domains → 添加你的域名

### 查看 KV 数据

```bash
# 列出所有 key
wrangler kv:key list --namespace-id=YOUR_KV_ID

# 查看 memes 数据
wrangler kv:key get memes --namespace-id=YOUR_KV_ID
```

### 调试技巧

1. **查看 Functions 日志**：Wrangler 终端会显示所有 API 请求
2. **浏览器开发者工具**：Network 面板查看 API 请求和响应
3. **添加调试日志**：在 `functions/api/` 文件中添加 `console.log()`

### 推荐工作流

```bash
# 1. 本地开发和测试
npm install
npm run dev
# 测试所有功能...

# 2. 提交代码
git add .
git commit -m "Feature: 新功能"
git push

# 3. Cloudflare Pages 自动部署
# 在 Dashboard 确认 KV 已绑定

# 4. 访问生产环境测试
# https://your-site.pages.dev
```

## 📝 注意事项

1. **KV 变量名必须是 `MEME_GALLERY_KV`**（区分大小写）
2. **必须包含 `functions` 文件夹**，这是 API 所在位置
3. **不需要任何配置文件**，Pages Functions 自动识别
4. **建议定期导出数据**作为备份
5. 绑定 KV 后等待几秒钟生效

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

---

**🎉 享受你的表情包管理之旅！**
