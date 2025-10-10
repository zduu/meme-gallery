// 表情包画廊 - 使用 Cloudflare Pages Functions + KV 云端存储
class MemeGallery {
    constructor() {
        this.memes = [];
        this.filteredMemes = [];
        this.apiEndpoint = '';  // 相对路径
        this.isLoading = false;
        this.gridSize = localStorage.getItem('gridSize') || 'medium';  // 网格大小设置
        this.currentCategory = 'all';  // 当前分类：all, link, upload
        this.currentMode = 'link';  // 当前添加模式：link, upload
        this.selectedFile = null;  // 选中的文件
        this.logoClickCount = 0;  // Logo 点击计数
        this.logoClickTimer = null;  // 点击计数重置定时器
        this.isAdmin = sessionStorage.getItem('isAdmin') === 'true';  // 管理员状态
        this.currentMemeForTags = null;  // 当前正在编辑标签的表情包
        this.allTags = new Set();  // 所有标签集合
        this.pageSize = 50;  // 每页显示数量
        this.currentPage = 1;  // 当前页码
        this.copyFormatOptions = ['raw', 'markdown', 'html', 'og'];  // 支持的复制格式
        this.copyFormat = this.loadCopyFormatPreference();  // 当前复制格式
        this.errorPlaceholder = this.generateErrorPlaceholder();  // 图片加载失败占位
        this.init();
    }

    async init() {
        await this.loadFromRemote();
        this.bindEvents();
        this.applyGridSize();
        this.updateAdminButtons();  // 更新管理员按钮显示状态
        this.setupIntersectionObserver();  // 设置图片懒加载观察器
        this.render();
    }

    // ========== 智能懒加载 ==========

    setupIntersectionObserver() {
        // 创建 Intersection Observer 用于智能懒加载
        this.imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const dataSrc = img.dataset.src;
                    if (dataSrc) {
                        img.dataset.isPlaceholder = 'false';
                        img.dataset.fallbackIndex = '0';
                        img.src = dataSrc;
                        img.removeAttribute('data-src');
                        this.imageObserver.unobserve(img);
                    }
                }
            });
        }, {
            rootMargin: '50px',  // 提前 50px 开始加载
            threshold: 0.01
        });
    }

    observeImages() {
        // 绑定事件处理器并观察所有带 data-src 的图片
        document.querySelectorAll('.meme-image').forEach(img => {
            this.attachImageHandlers(img);
        });

        document.querySelectorAll('img[data-src]').forEach(img => {
            this.imageObserver.observe(img);
        });
    }

    // ========== 格式识别 ==========

    // GitHub CDN 加速：将 raw.githubusercontent.com 转换为 jsDelivr CDN
    convertToGitHubCDN(url) {
        const info = this.getGitHubFileInfo(url);
        if (!info) {
            return url;
        }

        const cdnUrl = this.buildGitHubUrl(info, 'jsdelivr');
        return cdnUrl || url;
    }

    getGitHubFileInfo(url) {
        try {
            const parsed = new URL(url);
            const host = parsed.hostname;
            const pathname = parsed.pathname.replace(/^\/+/, '');

            // raw.* domains
            if (['raw.githubusercontent.com', 'raw.fastgit.org', 'raw.gitmirror.com'].includes(host)) {
                const segments = pathname.split('/');
                if (segments.length >= 4) {
                    const [owner, repo, ref, ...rest] = segments;
                    return { owner, repo, ref, path: rest.join('/') };
                }
            }

            // jsDelivr
            if (host === 'cdn.jsdelivr.net' && pathname.startsWith('gh/')) {
                const trimmed = pathname.slice(3); // remove leading "gh/"
                const segments = trimmed.split('/');
                if (segments.length >= 3) {
                    const owner = segments[0];
                    const repoAndRef = segments[1];
                    const [repo, ref] = repoAndRef.split('@');
                    const path = segments.slice(2).join('/');
                    if (owner && repo && ref && path) {
                        return { owner, repo, ref, path };
                    }
                }
            }

            // github.com blob
            if (host === 'github.com') {
                const segments = pathname.split('/');
                const blobIndex = segments.indexOf('blob');
                if (blobIndex !== -1 && blobIndex >= 2 && segments.length > blobIndex + 1) {
                    const owner = segments[0];
                    const repo = segments[1];
                    const ref = segments[blobIndex + 1];
                    const path = segments.slice(blobIndex + 2).join('/');
                    if (owner && repo && ref && path) {
                        return { owner, repo, ref, path };
                    }
                }
            }

            return null;
        } catch (error) {
            console.warn('无法解析 GitHub 链接:', url, error);
            return null;
        }
    }

    buildGitHubUrl(info, provider) {
        if (!info) return null;
        const { owner, repo, ref, path } = info;

        switch (provider) {
            case 'jsdelivr':
                return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${ref}/${path}`;
            case 'fastgit':
                return `https://raw.fastgit.org/${owner}/${repo}/${ref}/${path}`;
            case 'gitmirror':
                return `https://raw.gitmirror.com/${owner}/${repo}/${ref}/${path}`;
            case 'raw':
                return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;
            default:
                return null;
        }
    }

    buildImageSources(url) {
        const sources = new Set();
        const info = this.getGitHubFileInfo(url);

        if (info) {
            const cdnUrl = this.buildGitHubUrl(info, 'jsdelivr');
            const fastgitUrl = this.buildGitHubUrl(info, 'fastgit');
            const gitmirrorUrl = this.buildGitHubUrl(info, 'gitmirror');
            const rawUrl = this.buildGitHubUrl(info, 'raw');

            [cdnUrl, fastgitUrl, gitmirrorUrl, rawUrl].forEach(candidate => {
                if (candidate) {
                    sources.add(candidate);
                }
            });
        }

        sources.add(url);

        return Array.from(sources);
    }

    generateErrorPlaceholder() {
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
                <rect width="400" height="300" fill="#f9fafb"/>
                <text x="50%" y="50%" fill="#9ca3af" font-size="24" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle">
                    图片加载失败
                </text>
            </svg>
        `;
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    }

    attachImageHandlers(img) {
        if (img.dataset.handlersAttached === 'true') {
            return;
        }

        img.dataset.handlersAttached = 'true';

        img.addEventListener('load', () => {
            const skeleton = img.previousElementSibling;
            if (skeleton) {
                skeleton.style.display = 'none';
            }
            img.classList.add('loaded');
            if (img.dataset.isPlaceholder === 'true') {
                img.classList.add('error');
            } else {
                img.classList.remove('error');
            }
        });

        img.addEventListener('error', () => {
            this.handleImageError(img);
        });
    }

    handleImageError(img) {
        // 避免在占位图上重复触发
        if (img.dataset.isPlaceholder === 'true') {
            return;
        }

        const fallbackAttr = img.dataset.fallbacks || '';
        const fallbackUrls = fallbackAttr ? fallbackAttr.split('||').filter(Boolean) : [];
        const index = parseInt(img.dataset.fallbackIndex || '0', 10);

        if (index < fallbackUrls.length) {
            img.dataset.fallbackIndex = String(index + 1);
            const nextUrl = fallbackUrls[index];
            img.src = nextUrl;
            return;
        }

        this.markImageAsFailed(img);
    }

    markImageAsFailed(img) {
        const skeleton = img.previousElementSibling;
        if (skeleton) {
            skeleton.style.display = 'none';
        }

        img.dataset.isPlaceholder = 'true';
        img.classList.add('error');
        img.alt = '图片加载失败';

        if (this.errorPlaceholder) {
            img.src = this.errorPlaceholder;
        }
    }

    // ========== 复制格式控制 ==========

    loadCopyFormatPreference() {
        try {
            const stored = localStorage.getItem('copyFormat');
            if (stored && this.copyFormatOptions.includes(stored)) {
                return stored;
            }
        } catch (error) {
            console.warn('无法读取复制格式偏好:', error);
        }
        return 'raw';
    }

    saveCopyFormatPreference(format) {
        try {
            localStorage.setItem('copyFormat', format);
        } catch (error) {
            console.warn('无法保存复制格式偏好:', error);
        }
    }

    getCopyFormatLabel(format) {
        switch (format) {
            case 'markdown':
                return 'Markdown';
            case 'html':
                return 'HTML';
            case 'og':
                return '分享卡片';
            case 'raw':
            default:
                return '原始链接';
        }
    }

    getCopyFormatIndicator(format) {
        switch (format) {
            case 'markdown':
                return 'MD';
            case 'html':
                return 'HT';
            case 'og':
                return 'OG';
            case 'raw':
            default:
                return '链';
        }
    }

    updateCopyFormatDisplay() {
        const toggleText = document.getElementById('copyFormatToggleText');
        if (toggleText) {
            toggleText.textContent = this.getCopyFormatIndicator(this.copyFormat);
        }

        const menu = document.getElementById('copyFormatMenu');
        if (menu) {
            menu.querySelectorAll('.copy-format-option').forEach(option => {
                option.classList.toggle('active', option.dataset.format === this.copyFormat);
            });
        }

        const toggleBtn = document.getElementById('copyFormatToggle');
        if (toggleBtn) {
            const label = this.getCopyFormatLabel(this.copyFormat);
            toggleBtn.setAttribute('aria-label', `当前复制格式：${label}，点击切换`);
            toggleBtn.setAttribute('title', `当前格式：${label}`);
        }
    }

    setCopyFormat(format) {
        if (!this.copyFormatOptions.includes(format)) {
            return;
        }

        if (format === this.copyFormat) {
            this.updateCopyFormatDisplay();
            this.closeCopyFormatMenu();
            return;
        }

        this.copyFormat = format;
        this.saveCopyFormatPreference(format);
        this.updateCopyFormatDisplay();
        this.closeCopyFormatMenu();

        this.showToast(`复制格式已切换为：${this.getCopyFormatLabel(format)}`, 'success');
    }

    closeCopyFormatMenu() {
        const menu = document.getElementById('copyFormatMenu');
        if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
        }
    }

    getShareUrl(meme) {
        if (!meme || (!meme.id && meme.id !== 0)) {
            return '';
        }

        try {
            const origin = window.location.origin;
            const id = encodeURIComponent(meme.id);
            return `${origin}/share/${id}`;
        } catch (error) {
            console.error('生成分享链接失败:', error);
            return '';
        }
    }

    composeCopyText(meme) {
        if (!meme || !meme.url) {
            return '';
        }

        if (this.copyFormat === 'og') {
            return this.getShareUrl(meme);
        }

        const sources = this.buildImageSources(meme.url);
        const primaryUrl = sources[0] || meme.url;
        const decodeMap = {
            '&apos;': '\'',
            '&#39;': '\'',
            '&quot;': '"',
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>'
        };
        const rawName = (meme.name || 'meme').trim() || 'meme';
        const name = rawName.replace(/&(apos|#39|quot|amp|lt|gt);/g, (match) => decodeMap[match] || match);
        const markdownName = name
            .replace(/\\/g, '\\\\')
            .replace(/\[/g, '\\[')
            .replace(/\]/g, '\\]')
            .replace(/!/g, '\\!');
        const alt = name.replace(/"/g, '&quot;');

        switch (this.copyFormat) {
            case 'markdown':
                return `![${markdownName}](${primaryUrl})`;
            case 'html':
                return `<img src="${primaryUrl}" alt="${alt}">`;
            case 'raw':
            default:
                return primaryUrl;
        }
    }

    async copyTextToClipboard(text) {
        if (!text) {
            return { success: false };
        }

        let copySuccess = false;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                copySuccess = true;
            } catch (error) {
                console.error('Clipboard API 文本复制失败:', error);
            }
        }

        if (!copySuccess) {
            copySuccess = this.fallbackCopyText(text);
        }

        return { success: copySuccess };
    }

    async copyImageToClipboard(url) {
        if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
            return { success: false, unsupported: true };
        }

        try {
            const response = await fetch(url, { mode: 'cors', cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`获取图片失败: ${response.status}`);
            }
            const blob = await response.blob();
            const mimeType = blob.type || 'image/png';
            const clipboardItem = new ClipboardItem({ [mimeType]: blob });
            await navigator.clipboard.write([clipboardItem]);
            return { success: true };
        } catch (error) {
            console.error('复制图片失败:', error);
            return { success: false, error };
        }
    }

    resolveMemeFromButton(button) {
        if (!button) return null;

        const idAttr = button.dataset.id;
        if (idAttr) {
            const memeId = parseFloat(idAttr);
            const existingMeme = this.memes.find(item => item.id === memeId);
            if (existingMeme) {
                return { ...existingMeme };
            }
        }

        const memeData = button.dataset.meme;
        if (memeData) {
            try {
                return JSON.parse(memeData);
            } catch (error) {
                console.error('解析表情数据失败:', error);
            }
        }

        if (button.dataset.url) {
            return {
                url: button.dataset.url,
                name: button.dataset.name || ''
            };
        }

        return null;
    }

    async copyMemeContent(meme) {
        if (!meme || !meme.url) {
            return { success: false, message: '无法找到图片链接' };
        }

        const label = this.getCopyFormatLabel(this.copyFormat);

        if (this.copyFormat === 'og') {
            const shareUrl = this.getShareUrl(meme);
            if (!shareUrl) {
                return { success: false, message: '无法生成分享链接' };
            }

            const textResult = await this.copyTextToClipboard(shareUrl);
            if (textResult.success) {
                return {
                    success: true,
                    message: `${label} 已复制到剪贴板`,
                    type: 'text'
                };
            }

            return { success: false, message: '复制失败,请手动复制' };
        }

        if (this.copyFormat === 'raw') {
            // 原始链接模式:直接复制链接文本,不尝试复制图片
            const sources = this.buildImageSources(meme.url);
            const text = sources[0] || meme.url;
            const textResult = await this.copyTextToClipboard(text);
            if (textResult.success) {
                return {
                    success: true,
                    message: `${label} 已复制到剪贴板`,
                    type: 'text'
                };
            }

            return { success: false, message: '复制失败,请手动复制' };
        }

        const text = this.composeCopyText(meme);
        const textResult = await this.copyTextToClipboard(text);
        if (textResult.success) {
            return { success: true, message: `${label} 已复制到剪贴板`, type: 'text' };
        }

        return { success: false, message: '复制失败,请手动复制' };
    }

    extractImageUrl(input) {
        const trimmed = input.trim();

        // HTML <img> 标签
        const htmlRegex = /<img[^>]+src=["']([^"']+)["']/i;
        const htmlMatch = trimmed.match(htmlRegex);
        if (htmlMatch) return htmlMatch[1];

        // Markdown ![](url)
        const markdownRegex = /!\[.*?\]\(([^)]+)\)/;
        const markdownMatch = trimmed.match(markdownRegex);
        if (markdownMatch) return markdownMatch[1];

        // 纯链接
        try {
            const url = new URL(trimmed);
            if (url.protocol === 'http:' || url.protocol === 'https:') {
                return trimmed;
            }
        } catch (e) {
            return null;
        }

        return null;
    }

    isValidImageUrl(url) {
        if (!url) return false;
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico'];
        const lowerUrl = url.toLowerCase();
        const hasImageExtension = imageExtensions.some(ext => lowerUrl.includes(ext));
        if (hasImageExtension) return true;

        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch {
            return false;
        }
    }

    // ========== API 调用 ==========

    async apiCall(endpoint, method = 'GET', body = null) {
        try {
            const options = {
                method,
                headers: { 'Content-Type': 'application/json' },
            };
            if (body) {
                options.body = JSON.stringify(body);
            }

            const response = await fetch(`${this.apiEndpoint}${endpoint}`, options);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '请求失败');
            }

            return data;
        } catch (error) {
            console.error('API 调用失败:', error);
            throw error;
        }
    }

    // ========== 数据管理 ==========

    async addMeme(input, name = '') {
        const url = this.extractImageUrl(input);

        if (!url) {
            return { success: false, message: '无法识别图片链接，请检查输入格式' };
        }

        if (!this.isValidImageUrl(url)) {
            return { success: false, message: '这不是一个有效的图片链接' };
        }

        try {
            this.setLoading(true);
            const result = await this.apiCall('/api/memes', 'POST', { url, name, source: 'link' });

            if (result.success) {
                await this.loadFromRemote();
                this.closeModal('addModal');
                return { success: true, message: `成功添加表情包：${result.data.name}` };
            } else {
                return { success: false, message: result.error || '添加失败' };
            }
        } catch (error) {
            return { success: false, message: error.message };
        } finally {
            this.setLoading(false);
        }
    }

    async uploadMeme(file, name = '') {
        if (!file) {
            return { success: false, message: '请选择图片文件' };
        }

        // 检查文件类型
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            return { success: false, message: '不支持的文件格式，请选择 JPG、PNG、GIF 或 WEBP' };
        }

        // 检查文件大小 (限制 10MB)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            return { success: false, message: '文件太大，请选择小于 10MB 的图片' };
        }

        try {
            this.setLoading(true);

            // 转换为 Base64
            const base64 = await this.fileToBase64(file);

            // 调用上传 API
            const result = await this.apiCall('/api/upload', 'POST', {
                file: base64,
                filename: file.name,
                name: name || file.name.replace(/\.[^/.]+$/, ''),
                source: 'upload'
            });

            if (result.success) {
                await this.loadFromRemote();
                this.closeModal('addModal');
                this.resetUploadForm();
                return { success: true, message: `成功上传表情包：${result.data.name}` };
            } else {
                return { success: false, message: result.error || '上传失败' };
            }
        } catch (error) {
            return { success: false, message: error.message };
        } finally {
            this.setLoading(false);
        }
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async deleteMeme(id) {
        if (!confirm('确定要删除这个表情包吗？')) return;

        try {
            this.setLoading(true);
            const result = await this.apiCall(`/api/memes/${id}`, 'DELETE');

            if (result.success) {
                await this.loadFromRemote();
                this.showToast(`已删除：${result.data.name}`, 'success');
            }
        } catch (error) {
            this.showToast(`删除失败：${error.message}`, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    async searchMemes(keyword) {
        if (!keyword.trim()) {
            this.filteredMemes = [...this.memes];
            this.currentPage = 1;  // 重置页码
            this.render();
            return;
        }

        try {
            this.setLoading(true);
            const result = await this.apiCall(`/api/memes/search?q=${encodeURIComponent(keyword)}`);

            if (result.success) {
                this.filteredMemes = result.data;
                this.currentPage = 1;  // 重置页码
                this.render();
            }
        } catch (error) {
            this.showToast(`搜索失败：${error.message}`, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    // ========== 远程存储 ==========

    async loadFromRemote() {
        try {
            this.setLoading(true);
            const result = await this.apiCall('/api/memes');

            if (result.success) {
                this.memes = result.data;
                this.filteredMemes = [...this.memes];
                this.render();
            }
        } catch (error) {
            console.error('加载失败:', error);
            this.showToast('加载数据失败，请检查网络连接', 'error');
            this.memes = [];
            this.filteredMemes = [];
            this.render();
        } finally {
            this.setLoading(false);
        }
    }

    async exportData() {
        try {
            this.setLoading(true);
            const response = await fetch(`${this.apiEndpoint}/api/memes/export`);
            const data = await response.json();

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `meme-gallery-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);

            this.showToast('数据导出成功', 'success');
            this.closeModal('menuModal');
        } catch (error) {
            this.showToast(`导出失败：${error.message}`, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    async importData(file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                this.setLoading(true);
                const data = JSON.parse(e.target.result);

                if (data.memes && Array.isArray(data.memes)) {
                    const result = await this.apiCall('/api/memes/import', 'POST', { memes: data.memes });

                    if (result.success) {
                        await this.loadFromRemote();
                        this.showToast(`成功导入 ${result.count} 个表情包`, 'success');
                        this.closeModal('menuModal');
                    }
                } else {
                    this.showToast('文件格式错误', 'error');
                }
            } catch (error) {
                console.error('导入失败:', error);
                this.showToast(`导入失败：${error.message}`, 'error');
            } finally {
                this.setLoading(false);
            }
        };
        reader.readAsText(file);
    }

    async clearAll() {
        if (confirm('确定要清空所有表情包吗？此操作不可恢复！')) {
            try {
                this.setLoading(true);
                const result = await this.apiCall('/api/memes/clear', 'DELETE');

                if (result.success) {
                    await this.loadFromRemote();
                    this.showToast('已清空所有数据', 'success');
                    this.closeModal('menuModal');
                }
            } catch (error) {
                this.showToast(`清空失败：${error.message}`, 'error');
            } finally {
                this.setLoading(false);
            }
        }
    }

    async scanRepo() {
        if (!confirm('扫描 GitHub 仓库中的所有图片文件并添加到画廊？')) {
            return;
        }

        try {
            this.setLoading(true);
            const result = await this.apiCall('/api/scan-repo', 'POST');

            if (result.success) {
                await this.loadFromRemote();
                const { total, new: newCount, existing, removed } = result.data;
                const removedInfo = removed > 0 ? `，已删除 ${removed} 张` : '';
                this.showToast(
                    `扫描完成！发现 ${total} 张图片，新增 ${newCount} 张，已存在 ${existing} 张${removedInfo}`,
                    'success'
                );
                this.closeModal('menuModal');
            }
        } catch (error) {
            this.showToast(`扫描失败：${error.message}`, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    // ========== 标签管理 ==========

    async updateMemeTags(memeId, tags) {
        try {
            this.setLoading(true);
            const result = await this.apiCall('/api/memes/tags', 'POST', {
                memeId,
                tags
            });

            if (result.success) {
                await this.loadFromRemote();
                return { success: true };
            } else {
                return { success: false, message: result.error };
            }
        } catch (error) {
            return { success: false, message: error.message };
        } finally {
            this.setLoading(false);
        }
    }

    openTagsModal(meme) {
        this.currentMemeForTags = meme;
        const tagsInput = document.getElementById('tagsInput');
        const memeName = document.getElementById('tagsMemeNameDisplay');

        // 显示当前表情包名称
        memeName.textContent = meme.name;

        // 初始化标签输入
        tagsInput.value = (meme.tags || []).join(', ');

        // 显示弹窗
        this.openModal('tagsModal');
        tagsInput.focus();
    }

    async saveMemeTags() {
        if (!this.currentMemeForTags) return;

        const tagsInput = document.getElementById('tagsInput');
        const tagsMessage = document.getElementById('tagsMessage');

        // 解析标签（逗号或空格分隔）
        const tagsText = tagsInput.value.trim();
        const tags = tagsText
            ? tagsText.split(/[,，\s]+/).filter(tag => tag.trim()).map(tag => tag.trim())
            : [];

        const result = await this.updateMemeTags(this.currentMemeForTags.id, tags);

        if (result.success) {
            this.showToast('标签已更新', 'success');
            this.closeModal('tagsModal');
            this.currentMemeForTags = null;
        } else {
            tagsMessage.className = 'message error';
            tagsMessage.textContent = `更新失败：${result.message}`;
        }
    }

    collectAllTags() {
        this.allTags.clear();
        this.memes.forEach(meme => {
            if (meme.tags && Array.isArray(meme.tags)) {
                meme.tags.forEach(tag => this.allTags.add(tag));
            }
        });
    }

    // ========== UI 渲染 ==========

    setLoading(loading) {
        this.isLoading = loading;
        document.body.style.cursor = loading ? 'wait' : 'default';
    }

    applyGridSize() {
        const gallery = document.getElementById('gallery');
        // 移除所有尺寸class
        gallery.classList.remove('size-small', 'size-medium', 'size-large');
        // 添加当前尺寸class
        gallery.classList.add(`size-${this.gridSize}`);

        // 更新按钮激活状态
        document.querySelectorAll('.size-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.size === this.gridSize);
        });
    }

    setGridSize(size) {
        this.gridSize = size;
        localStorage.setItem('gridSize', size);
        this.applyGridSize();
        this.closeModal('sizeModal');
        this.showToast(`网格大小已设置为：${size === 'small' ? '小' : size === 'large' ? '大' : '中'}`, 'success');
    }

    render() {
        const gallery = document.getElementById('gallery');
        const totalCount = document.getElementById('totalCount');

        // 收集所有标签
        this.collectAllTags();

        // 应用分类过滤
        let displayMemes = this.filteredMemes.length > 0 || this.memes.length === 0
            ? this.filteredMemes
            : this.memes;

        // 根据当前分类过滤
        if (this.currentCategory !== 'all') {
            displayMemes = displayMemes.filter(meme => meme.source === this.currentCategory);
        } else {
            // 在"全部"分类中，链接添加的图片排在前面，仓库图片排在后面
            displayMemes = [...displayMemes].sort((a, b) => {
                if (a.source === 'link' && b.source === 'upload') return -1;
                if (a.source === 'upload' && b.source === 'link') return 1;
                return 0;
            });
        }

        // 更新计数
        totalCount.textContent = this.memes.length;
        this.updateCategoryCounts();

        if (displayMemes.length === 0 && !this.isLoading) {
            gallery.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🎨</div>
                    <p>${this.filteredMemes.length === 0 && this.memes.length > 0 ? '没有找到匹配的表情包' : '还没有表情包'}</p>
                    <button class="btn-link" onclick="document.getElementById('addToggle').click()">
                        点击右上角 + 添加第一个表情包
                    </button>
                </div>
            `;
            return;
        }

        // 分页：只显示当前页的数据
        const startIndex = 0;
        const endIndex = this.currentPage * this.pageSize;
        const pagedMemes = displayMemes.slice(startIndex, endIndex);
        const hasMore = endIndex < displayMemes.length;

        // 渲染表情包卡片
        gallery.innerHTML = pagedMemes.map(meme => this.createMemeCard(meme)).join('');

        // 添加"加载更多"按钮
        if (hasMore) {
            gallery.innerHTML += `
                <div class="load-more-container">
                    <button id="loadMoreBtn" class="btn-load-more">
                        加载更多 (${displayMemes.length - endIndex} 张)
                    </button>
                </div>
            `;

            // 绑定加载更多按钮事件
            setTimeout(() => {
                const loadMoreBtn = document.getElementById('loadMoreBtn');
                if (loadMoreBtn) {
                    loadMoreBtn.addEventListener('click', () => {
                        this.currentPage++;
                        this.render();
                        // 滚动到新加载的内容
                        window.scrollTo({
                            top: document.body.scrollHeight - window.innerHeight - 200,
                            behavior: 'smooth'
                        });
                    });
                }
            }, 0);
        }

        this.bindCardEvents();

        // 启动图片懒加载观察
        setTimeout(() => this.observeImages(), 0);
    }

    updateCategoryCounts() {
        const allCount = this.memes.length;
        const linkCount = this.memes.filter(m => m.source === 'link').length;
        const uploadCount = this.memes.filter(m => m.source === 'upload').length;

        document.getElementById('countAll').textContent = allCount;
        document.getElementById('countLink').textContent = linkCount;
        document.getElementById('countUpload').textContent = uploadCount;
    }

    setCategory(category) {
        this.currentCategory = category;
        this.currentPage = 1;  // 重置页码

        // 更新标签激活状态
        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.category === category);
        });

        this.render();
    }

    createMemeCard(meme) {
        // 确保 meme 有 tags 数组
        const tags = meme.tags || [];
        const tagsHtml = tags.length > 0
            ? `<div class="meme-tags">${tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join('')}</div>`
            : '';
        const serializedMeme = JSON.stringify(meme).replace(/'/g, '&apos;');

        // 根据 GitHub 链接生成多源地址，降低加载失败概率
        const imageSources = this.buildImageSources(meme.url);
        const [primarySource, ...fallbackSources] = imageSources;
        const dataSrc = this.escapeHtml(primarySource || meme.url);
        const fallbackAttr = fallbackSources.length > 0
            ? ` data-fallbacks="${this.escapeHtml(fallbackSources.join('||'))}"`
            : '';

        return `
            <div class="meme-card">
                <div class="meme-image-container">
                    <!-- 骨架屏占位 -->
                    <div class="image-skeleton"></div>
                    <img
                        data-src="${dataSrc}"
                        data-fallback-index="0"${fallbackAttr}
                        alt="${this.escapeHtml(meme.name)}"
                        class="meme-image"
                    >
                    <div class="meme-overlay">
                        <div class="meme-name">${this.escapeHtml(meme.name)}</div>
                        ${tagsHtml}
                        <div class="meme-actions">
                            <button class="meme-action-btn copy-btn" data-id="${meme.id}" data-meme='${serializedMeme}' data-url="${this.escapeHtml(meme.url)}" onclick="event.stopPropagation()" title="复制（当前格式）">
                                📋
                            </button>
                            <button class="meme-action-btn tags-btn" data-meme='${serializedMeme}' onclick="event.stopPropagation()" title="管理标签">
                                🏷️
                            </button>
                            <button class="meme-action-btn delete-btn ${this.isAdmin ? '' : 'hidden'}" data-id="${meme.id}" onclick="event.stopPropagation()" title="删除">
                                🗑️
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ========== 弹窗控制 ==========

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = '';
        }
    }

    // ========== 事件绑定 ==========

    bindEvents() {
        // Logo 点击事件（5次触发管理员验证）
        document.querySelector('.logo').addEventListener('click', () => {
            this.handleLogoClick();
        });

        // 分类标签切换
        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.setCategory(tab.dataset.category);
            });
        });

        // 添加模式切换
        document.querySelectorAll('.add-mode-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const mode = tab.dataset.mode;
                this.setAddMode(mode);
            });
        });

        // 顶部按钮
        document.getElementById('searchToggle').addEventListener('click', () => {
            const searchBar = document.getElementById('searchBar');
            searchBar.classList.toggle('hidden');
            if (!searchBar.classList.contains('hidden')) {
                document.getElementById('searchInput').focus();
            }
        });

        document.getElementById('addToggle').addEventListener('click', () => {
            this.openModal('addModal');
        });

        document.getElementById('menuToggle').addEventListener('click', () => {
            this.openModal('menuModal');
        });

        document.getElementById('sizeToggle').addEventListener('click', () => {
            this.openModal('sizeModal');
        });

        const copyFormatToggle = document.getElementById('copyFormatToggle');
        const copyFormatMenu = document.getElementById('copyFormatMenu');

        if (copyFormatToggle && copyFormatMenu) {
            copyFormatToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                copyFormatMenu.classList.toggle('hidden');
                this.updateCopyFormatDisplay();
            });

            copyFormatMenu.querySelectorAll('.copy-format-option').forEach(option => {
                option.addEventListener('click', (event) => {
                    event.stopPropagation();
                    const format = option.dataset.format;
                    this.setCopyFormat(format);
                });
            });
        }

        document.addEventListener('click', (event) => {
            if (!copyFormatMenu) return;
            const target = event.target;
            if ((copyFormatToggle && copyFormatToggle.contains && copyFormatToggle.contains(target)) ||
                (copyFormatMenu.contains && copyFormatMenu.contains(target))) {
                return;
            }
            this.closeCopyFormatMenu();
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.closeCopyFormatMenu();
            }
        });

        // 搜索栏
        document.getElementById('searchClose').addEventListener('click', () => {
            document.getElementById('searchBar').classList.add('hidden');
            document.getElementById('searchInput').value = '';
            this.filteredMemes = [...this.memes];
            this.render();
        });

        let searchTimeout;
        document.getElementById('searchInput').addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.searchMemes(e.target.value);
            }, 300);
        });

        // 添加弹窗
        document.getElementById('addModalClose').addEventListener('click', () => {
            this.closeModal('addModal');
        });

        document.getElementById('addBtn').addEventListener('click', async () => {
            const message = document.getElementById('addMessage');

            let result;
            if (this.currentMode === 'link') {
                const urlInput = document.getElementById('urlInput');
                const nameInput = document.getElementById('nameInput');
                result = await this.addMeme(urlInput.value, nameInput.value);

                if (result.success) {
                    urlInput.value = '';
                    nameInput.value = '';
                }
            } else {
                const nameInput = document.getElementById('uploadNameInput');
                result = await this.uploadMeme(this.selectedFile, nameInput.value);
            }

            message.className = `message ${result.success ? 'success' : 'error'}`;
            message.textContent = result.message;

            if (result.success) {
                this.showToast(result.message, 'success');
                setTimeout(() => {
                    message.style.display = 'none';
                }, 3000);
            }
        });

        document.getElementById('clearBtn').addEventListener('click', () => {
            if (this.currentMode === 'link') {
                document.getElementById('urlInput').value = '';
                document.getElementById('nameInput').value = '';
            } else {
                this.resetUploadForm();
            }
            document.getElementById('addMessage').style.display = 'none';
        });

        // 图片上传相关
        const uploadArea = document.getElementById('uploadArea');
        const imageInput = document.getElementById('imageInput');

        uploadArea.addEventListener('click', () => {
            imageInput.click();
        });

        imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleFileSelect(file);
            }
        });

        // 拖拽上传
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                this.handleFileSelect(file);
            }
        });

        document.getElementById('removePreview').addEventListener('click', (e) => {
            e.stopPropagation();
            this.resetUploadForm();
        });

        // 菜单弹窗
        document.getElementById('menuModalClose').addEventListener('click', () => {
            this.closeModal('menuModal');
        });

        document.getElementById('exportBtn').addEventListener('click', async () => {
            await this.exportData();
        });

        document.getElementById('scanRepoBtn').addEventListener('click', async () => {
            await this.scanRepo();
        });

        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('importFile').click();
        });

        document.getElementById('importFile').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.importData(file);
            }
            e.target.value = '';
        });

        document.getElementById('clearAllBtn').addEventListener('click', async () => {
            await this.clearAll();
        });

        // 网格大小弹窗
        document.getElementById('sizeModalClose').addEventListener('click', () => {
            this.closeModal('sizeModal');
        });

        document.querySelectorAll('.size-option').forEach(btn => {
            btn.addEventListener('click', () => {
                const size = btn.dataset.size;
                this.setGridSize(size);
            });
        });

        // 管理员验证弹窗
        document.getElementById('adminModalClose').addEventListener('click', () => {
            this.closeModal('adminModal');
            document.getElementById('adminKeyInput').value = '';
            document.getElementById('adminMessage').style.display = 'none';
        });

        document.getElementById('cancelAdminBtn').addEventListener('click', () => {
            this.closeModal('adminModal');
            document.getElementById('adminKeyInput').value = '';
            document.getElementById('adminMessage').style.display = 'none';
        });

        document.getElementById('verifyAdminBtn').addEventListener('click', async () => {
            await this.verifyAdmin();
        });

        // 密码显示/隐藏切换
        document.getElementById('toggleAdminPassword').addEventListener('click', () => {
            const input = document.getElementById('adminKeyInput');
            const button = document.getElementById('toggleAdminPassword');
            if (input.type === 'password') {
                input.type = 'text';
                button.textContent = '🙈';
                button.title = '隐藏密码';
            } else {
                input.type = 'password';
                button.textContent = '👁️';
                button.title = '显示密码';
            }
        });

        // 管理员密钥输入框回车提交
        document.getElementById('adminKeyInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('verifyAdminBtn').click();
            }
        });

        // 标签管理弹窗
        document.getElementById('tagsModalClose').addEventListener('click', () => {
            this.closeModal('tagsModal');
            document.getElementById('tagsInput').value = '';
            document.getElementById('tagsMessage').style.display = 'none';
        });

        document.getElementById('cancelTagsBtn').addEventListener('click', () => {
            this.closeModal('tagsModal');
            document.getElementById('tagsInput').value = '';
            document.getElementById('tagsMessage').style.display = 'none';
        });

        document.getElementById('saveTagsBtn').addEventListener('click', async () => {
            await this.saveMemeTags();
        });

        // 标签输入框回车提交
        document.getElementById('tagsInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('saveTagsBtn').click();
            }
        });

        // 点击弹窗外部关闭
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });

        // 回车添加
        document.getElementById('urlInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                document.getElementById('addBtn').click();
            }
        });

        this.updateCopyFormatDisplay();
    }

    bindCardEvents() {
        // 复制链接
        document.querySelectorAll('.copy-btn').forEach(btn => {
            if (!btn.dataset.originalContent) {
                btn.dataset.originalContent = btn.innerHTML;
            }
            btn.addEventListener('click', async (e) => {
                const button = e.currentTarget;
                if (button.dataset.copying === 'true') {
                    return;
                }
                button.dataset.copying = 'true';

                const memeForCopy = this.resolveMemeFromButton(button);
                if (!memeForCopy) {
                    this.showToast('无法获取表情信息', 'error');
                    button.dataset.copying = 'false';
                    return;
                }

                const originalText = button.dataset.originalContent || button.innerHTML;
                let success = false;
                let message = '';

                try {
                    const result = await this.copyMemeContent(memeForCopy);
                    success = result.success;
                    message = result.message || (result.success ? '复制成功' : '复制失败，请手动复制');
                } catch (error) {
                    console.error('复制处理失败:', error);
                    success = false;
                    message = '复制失败，请手动复制';
                }

                if (success) {
                    button.innerHTML = '✅';
                    button.classList.add('copied');
                    this.showToast(message, 'success');

                    setTimeout(() => {
                        button.innerHTML = originalText;
                        button.classList.remove('copied');
                    }, 2000);
                } else {
                    this.showToast(message, 'error');
                    button.innerHTML = originalText;
                    button.classList.remove('copied');
                }

                button.dataset.copying = 'false';
            });
        });

        // 标签管理按钮
        document.querySelectorAll('.tags-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const memeData = e.currentTarget.dataset.meme;
                const meme = JSON.parse(memeData);
                this.openTagsModal(meme);
            });
        });

        // 删除表情包
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = parseFloat(e.currentTarget.dataset.id);
                await this.deleteMeme(id);
            });
        });
    }

    // ========== 工具函数 ==========

    fallbackCopyText(text) {
        // 降级复制方案：使用 textarea + execCommand
        let textArea = null;
        try {
            textArea = document.createElement('textarea');
            textArea.value = text;

            // 避免在页面上显示
            textArea.style.position = 'fixed';
            textArea.style.top = '0';
            textArea.style.left = '0';
            textArea.style.width = '2em';
            textArea.style.height = '2em';
            textArea.style.padding = '0';
            textArea.style.border = 'none';
            textArea.style.outline = 'none';
            textArea.style.boxShadow = 'none';
            textArea.style.background = 'transparent';
            textArea.style.opacity = '0';

            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            // 兼容 iOS
            textArea.setSelectionRange(0, 99999);

            const successful = document.execCommand('copy');
            return successful !== false;
        } catch (err) {
            console.error('降级复制方案失败:', err);
            return false;
        } finally {
            if (textArea && textArea.parentNode) {
                textArea.parentNode.removeChild(textArea);
            }
        }
    }

    updateAdminButtons() {
        // 根据管理员状态显示/隐藏按钮
        const importBtn = document.getElementById('importBtn');
        const clearAllBtn = document.getElementById('clearAllBtn');
        const scanRepoBtn = document.getElementById('scanRepoBtn');

        if (this.isAdmin) {
            importBtn.classList.remove('hidden');
            clearAllBtn.classList.remove('hidden');
            scanRepoBtn.classList.remove('hidden');
        } else {
            importBtn.classList.add('hidden');
            clearAllBtn.classList.add('hidden');
            scanRepoBtn.classList.add('hidden');
        }
    }

    handleLogoClick() {
        // 如果已经是管理员,不再计数
        if (this.isAdmin) {
            return;
        }

        // 增加点击计数
        this.logoClickCount++;

        // 清除之前的定时器
        if (this.logoClickTimer) {
            clearTimeout(this.logoClickTimer);
        }

        // 5秒后重置计数
        this.logoClickTimer = setTimeout(() => {
            this.logoClickCount = 0;
        }, 5000);

        // 达到5次点击时触发管理员验证
        if (this.logoClickCount >= 5) {
            this.logoClickCount = 0;
            this.openModal('adminModal');
            document.getElementById('adminKeyInput').focus();
        }
    }

    async verifyAdmin() {
        const keyInput = document.getElementById('adminKeyInput');
        const adminMessage = document.getElementById('adminMessage');
        const key = keyInput.value.trim();

        if (!key) {
            adminMessage.className = 'message error';
            adminMessage.textContent = '请输入管理密钥';
            return;
        }

        try {
            this.setLoading(true);
            const result = await this.apiCall('/api/verify-key', 'POST', { key });

            if (result.success && result.valid) {
                // 验证成功
                this.isAdmin = true;
                sessionStorage.setItem('isAdmin', 'true');
                this.updateAdminButtons();
                this.closeModal('adminModal');

                // 如果有警告信息，显示警告 Toast
                if (result.warning) {
                    this.showToast(`⚠️ ${result.warning}`, 'success');
                } else {
                    this.showToast('管理员权限已激活 ✅', 'success');
                }

                keyInput.value = '';
                adminMessage.style.display = 'none';
            } else if (result.success && !result.valid) {
                // 密钥错误
                adminMessage.className = 'message error';
                adminMessage.textContent = '管理密钥错误，请重新输入';
                keyInput.value = '';
                keyInput.focus();
            } else {
                // 其他错误
                adminMessage.className = 'message error';
                adminMessage.textContent = result.error || '验证失败';
            }
        } catch (error) {
            adminMessage.className = 'message error';
            adminMessage.textContent = `验证失败：${error.message}`;
        } finally {
            this.setLoading(false);
        }
    }

    setAddMode(mode) {
        this.currentMode = mode;

        // 更新标签激活状态
        document.querySelectorAll('.add-mode-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.mode === mode);
        });

        // 切换内容区域
        document.getElementById('linkMode').classList.toggle('hidden', mode !== 'link');
        document.getElementById('uploadMode').classList.toggle('hidden', mode !== 'upload');
    }

    handleFileSelect(file) {
        this.selectedFile = file;

        // 显示预览
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('previewImg').src = e.target.result;
            document.getElementById('uploadArea').style.display = 'none';
            document.getElementById('imagePreview').classList.remove('hidden');

            // 自动填充文件名（去掉扩展名）
            const nameInput = document.getElementById('uploadNameInput');
            if (!nameInput.value) {
                nameInput.value = file.name.replace(/\.[^/.]+$/, '');
            }
        };
        reader.readAsDataURL(file);
    }

    resetUploadForm() {
        this.selectedFile = null;
        document.getElementById('imageInput').value = '';
        document.getElementById('uploadNameInput').value = '';
        document.getElementById('previewImg').src = '';
        document.getElementById('uploadArea').style.display = '';
        document.getElementById('imagePreview').classList.add('hidden');
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type} show`;

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.memeGallery = new MemeGallery();
});
