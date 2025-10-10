document.addEventListener('DOMContentLoaded', () => {
    // --- 状态管理 ---
    let state = {
        serverClassify: [],
        versions: [],
        selectedCategory: null,
        selectedServer: null,
        selectedVersion: null,
        loadingVersions: false,
        loadingDownload: false,
        searchKeyword: '',
        currentLang: 'zh-CN',
    };

    // --- DOM 元素引用 ---
    const elements = {
        categoriesGrid: document.getElementById('categories-grid'),
        serversPanel: document.getElementById('servers-panel'),
        serversGrid: document.getElementById('servers-grid'),
        versionsPanel: document.getElementById('versions-panel'),
        versionsContainer: document.getElementById('versions-container'),
        versionCardTitle: document.getElementById('version-card-title'),
        emptyState: document.getElementById('empty-state'),
        searchInput: document.getElementById('search-keyword'),
        refreshBtn: document.getElementById('refresh-versions-btn'),
        verificationModal: new bootstrap.Modal(document.getElementById('verificationModal')),
        appToast: new bootstrap.Toast(document.getElementById('appToast')),
        languageSwitcher: document.getElementById('language-switcher'),
        languageDisplay: document.getElementById('language-display'),
    };

    // --- 图标和颜色映射 ---
    const classifyConfig = {
        pluginsCore: { icon: 'fa-solid fa-puzzle-piece', color: '0, 208, 132' },
        pluginsAndModsCore_Forge: { icon: 'fa-solid fa-code-branch', color: '255, 107, 53' },
        pluginsAndModsCore_Fabric: { icon: 'fa-solid fa-microchip', color: '124, 58, 237' },
        modsCore_Forge: { icon: 'fa-solid fa-code', color: '245, 158, 11' },
        modsCore_Fabric: { icon: 'fa-solid fa-bug', color: '139, 92, 246' },
        vanillaCore: { icon: 'fa-solid fa-cloud', color: '16, 185, 129' },
        bedrockCore: { icon: 'fa-solid fa-mobile-screen-button', color: '6, 182, 212' },
        proxyCore: { icon: 'fa-solid fa-network-wired', color: '239, 68, 68' },
        default: { icon: 'fa-solid fa-server', color: '99, 102, 241' }
    };

    // --- 多语言处理 ---
    const translations = {
        'zh-CN': translations_zh_CN,
        'zh-TW': translations_zh_TW,
        'en-US': translations_en_US,
    };

    function t(key, fallback = '') {
        return translations[state.currentLang]?.[key] || fallback || key;
    }

    function updateUIText() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            el.innerHTML = t(el.getAttribute('data-i18n'));
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
        });
        document.title = t('mc.serverCore.title');
        const currentLangOption = elements.languageSwitcher.querySelector(`[data-lang="${state.currentLang}"]`);
        if (currentLangOption) {
            elements.languageDisplay.textContent = currentLangOption.textContent;
        }
    }

    function switchLanguage(lang) {
        if (!translations[lang]) return;
        state.currentLang = lang;
        document.documentElement.lang = lang.split('-')[0];
        updateUIText();
        renderAll();
    };

    // --- 真实 API 调用 ---
    const API = {
        async getMCServerCoreClassify() {
            const response = await fetch('https://api.mslmc.cn/v3/query/server_classify');
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        },
        async getMCServerCoreSupportVersion(name) {
            const response = await fetch(`https://api.mslmc.cn/v3/query/available_versions/${name}`);
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        },
        async getMCServerDownloadUrl(name, version) {
            const response = await fetch(`https://api.mslmc.cn/v3/download/server/${name}/${version}`);
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        }
    };

    // --- 通用提示 Toast ---
    function showToast(message, title = t('common.notice', '提示'), type = 'success') {
        const toastIcon = document.getElementById('toast-icon');
        const toastTitle = document.getElementById('toast-title');
        const toastBody = document.getElementById('toast-body');
        toastTitle.textContent = title;
        toastBody.textContent = message;
        const typeMap = {
            'success': 'fa-solid fa-check-circle text-success me-2',
            'error': 'fa-solid fa-xmark-circle text-danger me-2',
            'info': 'fa-solid fa-info-circle text-info me-2'
        };
        toastIcon.className = typeMap[type] || typeMap['info'];
        elements.appToast.show();
    }

    // --- 渲染函数 ---
    function renderCategories() {
        elements.categoriesGrid.innerHTML = state.serverClassify.map(category => {
            const config = classifyConfig[category.key] || classifyConfig.default;
            const title = t(`mc.serverCore.${category.key}`);
            const description = t(`mc.serverCore.${category.key}Desc`);
            return `
                <div class="category-card d-flex align-items-center p-3 rounded-3 ${state.selectedCategory === title ? 'active' : ''}" 
                     data-key="${category.key}" data-title="${title}">
                    <div class="category-icon d-flex align-items-center justify-content-center rounded-2" 
                         style="--icon-rgb-color: ${config.color}; background-color: rgba(var(--icon-rgb-color), 0.125); color: rgb(var(--icon-rgb-color));">
                        <i class="${config.icon}"></i>
                    </div>
                    <div class="ms-3 flex-grow-1">
                        <h3 class="fs-6 fw-semibold mb-1">${title}</h3>
                        <p class="small text-body-secondary mb-2 lh-sm">${description}</p>
                        <span class="badge text-bg-secondary fw-medium">${category.cores.length} ${t('mc.serverCore.coreCount')}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderServers() {
        if (!state.selectedCategory) {
            elements.serversPanel.classList.add('d-none');
            elements.emptyState.classList.remove('d-none');
            return;
        }
        elements.serversPanel.classList.remove('d-none');
        elements.emptyState.classList.add('d-none');
        const category = state.serverClassify.find(c => t(`mc.serverCore.${c.key}`) === state.selectedCategory);
        if (!category) return;
        const filteredCores = category.cores.filter(core =>
            core.toLowerCase().includes(state.searchKeyword.toLowerCase())
        );
        elements.serversGrid.innerHTML = filteredCores.map(server => `
            <div class="col">
                <div class="server-card p-2 rounded-2 d-flex justify-content-between align-items-center ${state.selectedServer === server ? 'active' : ''}"
                     data-server="${server}">
                    <span class="fw-medium">${server}</span>
                    ${state.selectedServer === server ? '<i class="fa-solid fa-check text-primary"></i>' : ''}
                </div>
            </div>
        `).join('');
    }

    function renderVersions() {
        if (!state.selectedServer) {
            elements.versionsPanel.classList.add('d-none');
            return;
        }
        elements.versionsPanel.classList.remove('d-none');
        elements.versionCardTitle.textContent = `${state.selectedServer} ${t('mc.serverCore.versionList')}`;
        if (state.loadingVersions) {
            elements.versionsContainer.innerHTML = `
                <div class="text-center p-4">
                    <div class="spinner-border spinner-border-sm" role="status"></div>
                    <p class="mt-2 small text-body-secondary">${t('mc.serverCore.loadingVersions')}</p>
                </div>`;
            return;
        }
        if (state.versions.length === 0) {
            elements.versionsContainer.innerHTML = `<div class="text-center p-4 text-body-secondary">${t('mc.serverCore.noVersionsFound')}</div>`;
            return;
        }
        const grid = document.createElement('div');
        grid.className = 'row row-cols-2 row-cols-sm-3 row-cols-lg-4 g-2';
        grid.innerHTML = state.versions.map(version => `
            <div class="col">
                <div class="version-card p-2 rounded-2 d-flex justify-content-between align-items-center ${state.selectedVersion === version ? 'active' : ''} ${state.loadingDownload && state.selectedVersion === version ? 'downloading' : ''}"
                    data-version="${version}">
                    <span class="small fw-medium">${version}</span>
                    ${state.loadingDownload && state.selectedVersion === version
            ? '<div class="spinner-border spinner-border-sm text-primary" role="status"></div>'
            : '<i class="fa-solid fa-download text-primary"></i>'}
                </div>
            </div>
        `).join('');
        elements.versionsContainer.innerHTML = '';
        elements.versionsContainer.appendChild(grid);
    }

    function renderAll() {
        renderCategories();
        renderServers();
        renderVersions();
    }

    async function handleCategorySelect(title) {
        state.selectedCategory = title;
        state.selectedServer = null;
        state.selectedVersion = null;
        state.versions = [];
        state.searchKeyword = '';
        elements.searchInput.value = '';
        renderAll();
    }

    async function handleServerClick(serverName) {
        if (state.selectedServer === serverName) return;
        state.selectedServer = serverName;
        state.selectedVersion = null;
        state.versions = [];
        state.loadingVersions = true;
        renderAll();
        try {
            const res = await API.getMCServerCoreSupportVersion(serverName);
            if (res.code === 200) {
                state.versions = res.data.versionList;
            } else {
                showToast(res.message || t('mc.serverCore.getVersionsFailed'), t('common.error'), 'error');
            }
        } catch (error) {
            showToast(t('mc.serverCore.networkErrorVersions'), t('common.error'), 'error');
        } finally {
            state.loadingVersions = false;
            renderVersions();
        }
    }

    async function handleVersionClick(version) {
        if (state.loadingDownload || !state.selectedServer) return;
        state.selectedVersion = version;
        state.loadingDownload = true;
        renderVersions();
        try {
            const res = await API.getMCServerDownloadUrl(state.selectedServer, version);
            if (res.code === 200 && res.data.url) {
                const link = document.createElement('a');
                link.href = res.data.url;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                showToast(t('mc.serverCore.downloadStarted'));
                if (res.data.sha256) {
                    document.getElementById('modal-server-name').textContent = state.selectedServer;
                    document.getElementById('modal-version-name').textContent = version;
                    document.getElementById('modal-sha256').textContent = res.data.sha256;
                    elements.verificationModal.show();
                }
            } else {
                showToast(res.message || t('mc.serverCore.getDownloadLinkFailed'), t('common.error'), 'error');
            }
        } catch (error) {
            showToast(t('mc.serverCore.networkErrorDownload'), t('common.error'), 'error');
        } finally {
            state.loadingDownload = false;
            renderVersions();
        }
    }

    const themeSwitcher = {
        init() {
            this.updateActiveIcon(this.getEffectiveTheme());
            document.querySelectorAll('[data-theme-value]').forEach(toggle => {
                toggle.addEventListener('click', () => {
                    const theme = toggle.getAttribute('data-theme-value');
                    localStorage.setItem('theme', theme);
                    this.applyTheme(theme);
                });
            });
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
                if (localStorage.getItem('theme') === 'auto') {
                    this.applyTheme('auto');
                }
            });
        },
        applyTheme(theme) {
            const effectiveTheme = (theme === 'auto') ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme;
            document.documentElement.setAttribute('data-bs-theme', effectiveTheme);
            this.updateActiveIcon(theme);
        },
        getEffectiveTheme() {
            return localStorage.getItem('theme') || 'auto';
        },
        updateActiveIcon(theme) {
            const iconEl = document.getElementById('theme-icon-active');
            const icons = {
                light: 'fa-solid fa-sun',
                dark: 'fa-solid fa-moon',
                auto: 'fa-solid fa-circle-half-stroke'
            };
            iconEl.className = `${icons[theme] || icons['auto']} me-1`;
        }
    };

    function getInitialLang() {
        const supportedLangs = ['zh-CN', 'zh-TW', 'en-US'];
        const browserLang = navigator.language;
        if (supportedLangs.includes(browserLang)) return browserLang;
        const primaryLang = browserLang.split('-')[0];
        if (primaryLang === 'zh') {
            return (browserLang.toLowerCase().includes('tw') || browserLang.toLowerCase().includes('hk')) ? 'zh-TW' : 'zh-CN';
        }
        const matchedLang = supportedLangs.find(lang => lang.startsWith(primaryLang));
        return matchedLang || 'zh-CN';
    }

    async function initialize() {
        themeSwitcher.init();
        switchLanguage(getInitialLang());
        try {
            const res = await API.getMCServerCoreClassify();
            if (res.code === 200) {
                state.serverClassify = Object.entries(res.data).map(([key, value]) => ({
                    key: key,
                    cores: value,
                }));
            } else {
                showToast(res.message || t('mc.serverCore.getCategoryFailed'), t('common.error'), 'error');
            }
            renderAll();
        } catch (error) {
            elements.categoriesGrid.innerHTML = `<div class="alert alert-danger">${t('mc.serverCore.networkError')}</div>`;
        }
        elements.languageSwitcher.addEventListener('click', e => {
            const langButton = e.target.closest('[data-lang]');
            if (langButton) switchLanguage(langButton.dataset.lang);
        });
        elements.categoriesGrid.addEventListener('click', e => {
            const card = e.target.closest('.category-card');
            if (card) handleCategorySelect(card.dataset.title);
        });
        elements.serversGrid.addEventListener('click', e => {
            const card = e.target.closest('.server-card');
            if (card) handleServerClick(card.dataset.server);
        });
        elements.versionsContainer.addEventListener('click', e => {
            const card = e.target.closest('.version-card');
            if (card) handleVersionClick(card.dataset.version);
        });
        elements.searchInput.addEventListener('input', e => {
            state.searchKeyword = e.target.value;
            renderServers();
        });
        elements.refreshBtn.addEventListener('click', () => {
            if (state.selectedServer && !state.loadingVersions) {
                handleServerClick(state.selectedServer);
            }
        });
    }

    initialize();
});