// 表情包画廊 - 使用 Cloudflare Pages Functions + KV 云端存储
class MemeGallery {
    constructor() {
        this.memes = [];
        this.filteredMemes = [];
        this.apiEndpoint = '';  // 相对路径
        this.isLoading = false;
        this.gridSize = localStorage.getItem('gridSize') || 'medium';  // 网格大小设置
        this.init();
    }

    async init() {
        await this.loadFromRemote();
        this.bindEvents();
        this.applyGridSize();
        this.render();
    }

    // ========== 格式识别 ==========

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
            const result = await this.apiCall('/api/memes', 'POST', { url, name });

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
            this.render();
            return;
        }

        try {
            this.setLoading(true);
            const result = await this.apiCall(`/api/memes/search?q=${encodeURIComponent(keyword)}`);

            if (result.success) {
                this.filteredMemes = result.data;
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
        const displayMemes = this.filteredMemes.length > 0 || this.memes.length === 0
            ? this.filteredMemes
            : this.memes;

        totalCount.textContent = this.memes.length;

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

        gallery.innerHTML = displayMemes.map(meme => this.createMemeCard(meme)).join('');
        this.bindCardEvents();
    }

    createMemeCard(meme) {
        return `
            <div class="meme-card">
                <div class="meme-image-container">
                    <img
                        src="${this.escapeHtml(meme.url)}"
                        alt="${this.escapeHtml(meme.name)}"
                        class="meme-image"
                        loading="lazy"
                        onerror="this.className='meme-image error'; this.alt='图片加载失败'"
                    >
                    <div class="meme-overlay">
                        <div class="meme-name">${this.escapeHtml(meme.name)}</div>
                        <div class="meme-actions">
                            <button class="meme-action-btn copy-btn" data-url="${this.escapeHtml(meme.url)}" onclick="event.stopPropagation()">
                                📋 复制
                            </button>
                            <button class="meme-action-btn delete-btn" data-id="${meme.id}" onclick="event.stopPropagation()">
                                🗑️ 删除
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
            const urlInput = document.getElementById('urlInput');
            const nameInput = document.getElementById('nameInput');
            const message = document.getElementById('addMessage');

            const result = await this.addMeme(urlInput.value, nameInput.value);

            message.className = `message ${result.success ? 'success' : 'error'}`;
            message.textContent = result.message;

            if (result.success) {
                urlInput.value = '';
                nameInput.value = '';
                this.showToast(result.message, 'success');
                setTimeout(() => {
                    message.style.display = 'none';
                }, 3000);
            }
        });

        document.getElementById('clearBtn').addEventListener('click', () => {
            document.getElementById('urlInput').value = '';
            document.getElementById('nameInput').value = '';
            document.getElementById('addMessage').style.display = 'none';
        });

        // 菜单弹窗
        document.getElementById('menuModalClose').addEventListener('click', () => {
            this.closeModal('menuModal');
        });

        document.getElementById('exportBtn').addEventListener('click', async () => {
            await this.exportData();
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
    }

    bindCardEvents() {
        // 复制链接
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const url = e.currentTarget.dataset.url;
                try {
                    await navigator.clipboard.writeText(url);
                    const originalText = e.currentTarget.innerHTML;
                    e.currentTarget.innerHTML = '✅ 已复制';
                    e.currentTarget.classList.add('copied');

                    this.showToast('链接已复制到剪贴板', 'success');

                    setTimeout(() => {
                        e.currentTarget.innerHTML = originalText;
                        e.currentTarget.classList.remove('copied');
                    }, 2000);
                } catch (err) {
                    console.error('复制失败:', err);
                    this.showToast('复制失败，请手动复制', 'error');
                }
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
