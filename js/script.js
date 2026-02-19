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
        languageSwitcher: document.getElementById('language-switcher'),
        languageDisplay: document.getElementById('language-display'),
        verificationModal: document.getElementById('verificationModal'),
        appToast: document.getElementById('appToast'),
    };

    // --- 简单的下拉菜单逻辑 ---
    document.querySelectorAll('.dropdown-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const menu = btn.nextElementSibling;
            // 关闭其他所有下拉菜单
            document.querySelectorAll('.dropdown-menu').forEach(m => {
                if (m !== menu) m.classList.add('hidden');
            });
            menu.classList.toggle('hidden');
        });
    });

    document.addEventListener('click', () => {
        document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.add('hidden'));
    });

    // --- 原生 Modal 逻辑 ---
    const modalUtils = {
        show() {
            elements.verificationModal.classList.remove('hidden');
        },
        hide() {
            elements.verificationModal.classList.add('hidden');
        }
    };
    document.querySelectorAll('.modal-close, .modal-backdrop').forEach(el => {
        el.addEventListener('click', modalUtils.hide);
    });

    // --- 原生 Toast 逻辑 ---
    let toastTimeout;
    const toastUtils = {
        show(message, title = t('common.notice', '提示'), type = 'success') {
            const toastIcon = document.getElementById('toast-icon');
            const toastTitle = document.getElementById('toast-title');
            const toastBody = document.getElementById('toast-body');

            toastTitle.textContent = title;
            toastBody.textContent = message;

            const typeMap = {
                'success': 'fa-check-circle text-emerald-500',
                'error': 'fa-xmark-circle text-red-500',
                'info': 'fa-info-circle text-blue-500'
            };
            toastIcon.className = `fa-solid ${typeMap[type] || typeMap['info']}`;

            // 显示 Toast
            elements.appToast.classList.remove('translate-y-full', 'opacity-0');

            // 自动隐藏
            clearTimeout(toastTimeout);
            toastTimeout = setTimeout(() => {
                this.hide();
            }, 3500);
        },
        hide() {
            elements.appToast.classList.add('translate-y-full', 'opacity-0');
        }
    };
    document.querySelectorAll('.toast-close').forEach(el => {
        el.addEventListener('click', () => toastUtils.hide());
    });

    // --- 图标和颜色映射 ---
    const classifyConfig = {
        pluginsCore: { icon: 'fa-solid fa-puzzle-piece', color: '16, 185, 129' }, // emerald-500
        pluginsAndModsCore_Forge: { icon: 'fa-solid fa-code-branch', color: '249, 115, 22' }, // orange-500
        pluginsAndModsCore_Fabric: { icon: 'fa-solid fa-microchip', color: '139, 92, 246' }, // violet-500
        modsCore_Forge: { icon: 'fa-solid fa-code', color: '245, 158, 11' }, // amber-500
        modsCore_Fabric: { icon: 'fa-solid fa-bug', color: '168, 85, 247' }, // purple-500
        vanillaCore: { icon: 'fa-solid fa-cloud', color: '20, 184, 166' }, // teal-500
        bedrockCore: { icon: 'fa-solid fa-mobile-screen-button', color: '6, 182, 212' }, // cyan-500
        proxyCore: { icon: 'fa-solid fa-network-wired', color: '239, 68, 68' }, // red-500
        default: { icon: 'fa-solid fa-server', color: '59, 130, 246' } // blue-500
    };

    // --- 多语言处理 (需要外部存在翻译对象) ---
    const translations = {
        'zh-CN': typeof translations_zh_CN !== 'undefined' ? translations_zh_CN : {},
        'zh-TW': typeof translations_zh_TW !== 'undefined' ? translations_zh_TW : {},
        'en-US': typeof translations_en_US !== 'undefined' ? translations_en_US : {},
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
        document.title = t('mc.serverCore.title') || 'Minecraft 服务端核心下载 | MSLMC';
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
    }

    // --- API 调用 ---
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

    // --- 渲染函数 ---
    function renderCategories() {
        elements.categoriesGrid.innerHTML = state.serverClassify.map(category => {
            const config = classifyConfig[category.key] || classifyConfig.default;
            const title = t(`mc.serverCore.${category.key}`);
            const description = t(`mc.serverCore.${category.key}Desc`);
            const isActive = state.selectedCategory === title;

            // Tailwind 毛玻璃卡片样式
            const baseClasses = "category-card group flex items-center p-4 rounded-xl transition-all duration-300 cursor-pointer border backdrop-blur-md bg-white/60 dark:bg-slate-800/60";
            const normalClasses = "border-primary/10 dark:border-white/10 hover:-translate-y-1 hover:shadow-lg hover:border-primary/50";
            const activeClasses = "bg-primary/10 border-primary shadow-[0_0_20px_rgba(59,130,246,0.2)] dark:bg-primary/20 scale-[1.02]";

            return `
                <div class="${baseClasses} ${isActive ? activeClasses : normalClasses}" 
                     data-key="${category.key}" data-title="${title}">
                    <div class="flex items-center justify-center w-12 h-12 rounded-lg shrink-0 transition-transform group-hover:scale-110" 
                         style="background-color: rgba(${config.color}, 0.15); color: rgb(${config.color}); font-size: 1.25rem;">
                        <i class="${config.icon}"></i>
                    </div>
                    <div class="ml-4 flex-grow">
                        <h3 class="text-base font-semibold mb-1 text-slate-800 dark:text-slate-100">${title}</h3>
                        <p class="text-xs text-slate-500 dark:text-slate-400 mb-2 leading-tight">${description}</p>
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            ${category.cores.length} ${t('mc.serverCore.coreCount', '个核心')}
                        </span>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderServers() {
        if (!state.selectedCategory) {
            elements.serversPanel.classList.add('hidden');
            elements.emptyState.classList.remove('hidden');
            return;
        }
        elements.serversPanel.classList.remove('hidden');
        elements.emptyState.classList.add('hidden');

        const category = state.serverClassify.find(c => t(`mc.serverCore.${c.key}`) === state.selectedCategory);
        if (!category) return;

        const filteredCores = category.cores.filter(core =>
            core.toLowerCase().includes(state.searchKeyword.toLowerCase())
        );

        elements.serversGrid.innerHTML = filteredCores.map(server => {
            const isActive = state.selectedServer === server;
            const baseClasses = "server-card flex justify-between items-center p-3 rounded-lg cursor-pointer transition-all backdrop-blur-sm bg-white/40 dark:bg-slate-700/60 border";
            const normalClasses = "border-transparent hover:border-primary hover:shadow-md hover:-translate-y-px text-slate-700 dark:text-slate-200";
            const activeClasses = "border-primary bg-primary/5 dark:bg-primary/20 shadow-md text-primary dark:text-primary-subtle font-medium";

            return `
                <div class="${baseClasses} ${isActive ? activeClasses : normalClasses}" data-server="${server}">
                    <span class="${isActive ? 'font-semibold' : 'font-medium'}">${server}</span>
                    ${isActive ? '<i class="fa-solid fa-check text-primary"></i>' : ''}
                </div>
            `;
        }).join('');
    }

    function renderVersions() {
        if (!state.selectedServer) {
            elements.versionsPanel.classList.add('hidden');
            return;
        }
        elements.versionsPanel.classList.remove('hidden');
        elements.versionCardTitle.textContent = `${state.selectedServer} ${t('mc.serverCore.versionList', '版本列表')}`;

        if (state.loadingVersions) {
            elements.versionsContainer.innerHTML = `
                <div class="text-center py-10">
                    <i class="fa-solid fa-circle-notch fa-spin text-primary text-2xl"></i>
                    <p class="mt-3 text-sm text-slate-500">${t('mc.serverCore.loadingVersions', '正在加载版本...')}</p>
                </div>`;
            return;
        }
        if (state.versions.length === 0) {
            elements.versionsContainer.innerHTML = `<div class="text-center py-10 text-slate-500">${t('mc.serverCore.noVersionsFound', '未找到可用版本')}</div>`;
            return;
        }

        elements.versionsContainer.innerHTML = `<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            ${state.versions.map(version => {
            const isActive = state.selectedVersion === version;
            const isDownloading = state.loadingDownload && isActive;
            const baseClasses = "version-card flex justify-between items-center p-3 rounded-lg transition-all backdrop-blur-sm bg-white/40 dark:bg-slate-700/60 border";
            const normalClasses = "border-transparent cursor-pointer hover:border-primary hover:shadow-md hover:-translate-y-px text-slate-700 dark:text-slate-200";
            const activeClasses = "border-primary bg-primary/5 dark:bg-primary/20 shadow-md text-primary";
            const disabledClasses = "opacity-60 cursor-not-allowed";

            return `
                    <div class="${baseClasses} ${isActive ? activeClasses : normalClasses} ${isDownloading ? disabledClasses : ''}" data-version="${version}">
                        <span class="text-sm font-medium">${version}</span>
                        ${isDownloading
                ? '<i class="fa-solid fa-circle-notch fa-spin text-primary"></i>'
                : '<i class="fa-solid fa-download text-slate-400 group-hover:text-primary"></i>'}
                    </div>
                `;
        }).join('')}
        </div>`;
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
                toastUtils.show(res.message || t('mc.serverCore.getVersionsFailed'), t('common.error'), 'error');
            }
        } catch (error) {
            toastUtils.show(t('mc.serverCore.networkErrorVersions'), t('common.error'), 'error');
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
                toastUtils.show(t('mc.serverCore.downloadStarted', '下载已开始'));

                if (res.data.sha256) {
                    document.getElementById('modal-server-name').textContent = state.selectedServer;
                    document.getElementById('modal-version-name').textContent = version;
                    document.getElementById('modal-sha256').textContent = res.data.sha256;
                    modalUtils.show();
                }
            } else {
                toastUtils.show(res.message || t('mc.serverCore.getDownloadLinkFailed'), t('common.error'), 'error');
            }
        } catch (error) {
            toastUtils.show(t('mc.serverCore.networkErrorDownload'), t('common.error'), 'error');
        } finally {
            state.loadingDownload = false;
            renderVersions();
        }
    }

    // --- 主题切换 ---
    const themeSwitcher = {
        init() {
            this.updateActiveIcon(this.getEffectiveTheme());
            document.querySelectorAll('[data-theme-value]').forEach(toggle => {
                toggle.addEventListener('click', () => {
                    const theme = toggle.getAttribute('data-theme-value');
                    localStorage.setItem('theme', theme);
                    this.applyTheme(theme);
                    document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.add('hidden')); // 关闭菜单
                });
            });
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (localStorage.getItem('theme') === 'auto' || !localStorage.getItem('theme')) {
                    this.applyTheme('auto');
                }
            });
        },
        applyTheme(theme) {
            const isDark = (theme === 'auto') ? window.matchMedia('(prefers-color-scheme: dark)').matches : (theme === 'dark');
            if (isDark) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
            this.updateActiveIcon(theme);
        },
        getEffectiveTheme() {
            return localStorage.getItem('theme') || 'auto';
        },
        updateActiveIcon(theme) {
            const iconEl = document.getElementById('theme-icon-active');
            const icons = {
                light: 'fa-sun',
                dark: 'fa-moon',
                auto: 'fa-circle-half-stroke'
            };
            iconEl.className = `fa-solid ${icons[theme] || icons['auto']} me-2`;
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
                toastUtils.show(res.message || t('mc.serverCore.getCategoryFailed'), t('common.error'), 'error');
            }
            renderAll();
        } catch (error) {
            elements.categoriesGrid.innerHTML = `<div class="bg-red-50 text-red-500 p-4 rounded-lg">${t('mc.serverCore.networkError', '网络错误，请稍后重试')}</div>`;
        }

        elements.languageSwitcher.addEventListener('click', e => {
            const langButton = e.target.closest('[data-lang]');
            if (langButton) {
                switchLanguage(langButton.dataset.lang);
                elements.languageSwitcher.classList.add('hidden'); // 关闭菜单
            }
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