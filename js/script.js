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
        languageSwitcher: document.querySelector('#language-display').parentElement.nextElementSibling,
        languageDisplay: document.getElementById('language-display'),
        verificationModal: document.getElementById('verificationModal'),
        appToast: document.getElementById('appToast'),
    };

    // --- 优雅的下拉菜单逻辑 ---
    document.querySelectorAll('.dropdown-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const menu = btn.nextElementSibling;
            const isHidden = menu.classList.contains('hidden');

            // 关闭其他
            document.querySelectorAll('.dropdown-menu').forEach(m => {
                m.classList.add('hidden');
                setTimeout(() => m.classList.remove('opacity-100', 'scale-100'), 10);
            });

            if (isHidden) {
                menu.classList.remove('hidden');
                // 触发过渡动画
                setTimeout(() => {
                    menu.classList.remove('opacity-0', 'scale-95');
                    menu.classList.add('opacity-100', 'scale-100');
                }, 10);
            }
        });
    });

    document.addEventListener('click', () => {
        document.querySelectorAll('.dropdown-menu').forEach(m => {
            m.classList.remove('opacity-100', 'scale-100');
            m.classList.add('opacity-0', 'scale-95');
            setTimeout(() => m.classList.add('hidden'), 200); // 等待动画完成
        });
    });

    // --- 现代化 Modal 逻辑 ---
    const modalUtils = {
        show() {
            const modal = elements.verificationModal;
            const backdrop = modal.querySelector('.modal-backdrop');
            const content = modal.querySelector('.modal-content');

            modal.classList.remove('hidden');
            setTimeout(() => {
                backdrop.classList.remove('opacity-0');
                content.classList.remove('opacity-0', 'scale-95');
            }, 10);
        },
        hide() {
            const modal = elements.verificationModal;
            const backdrop = modal.querySelector('.modal-backdrop');
            const content = modal.querySelector('.modal-content');

            backdrop.classList.add('opacity-0');
            content.classList.add('opacity-0', 'scale-95');
            setTimeout(() => modal.classList.add('hidden'), 300);
        }
    };
    document.querySelectorAll('.modal-close, .modal-backdrop').forEach(el => {
        el.addEventListener('click', modalUtils.hide);
    });

    // --- 现代化 Toast 逻辑 ---
    let toastTimeout;
    const toastUtils = {
        show(message, title = t('common.notice', '提示'), type = 'success') {
            const toast = elements.appToast;
            const toastIcon = document.getElementById('toast-icon');
            const toastIconWrapper = document.getElementById('toast-icon-wrapper');
            const toastTitle = document.getElementById('toast-title');
            const toastBody = document.getElementById('toast-body');

            toastTitle.textContent = title;
            toastBody.textContent = message;

            const typeMap = {
                'success': { icon: 'fa-check', color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-500/20' },
                'error': { icon: 'fa-xmark', color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-500/20' },
                'info': { icon: 'fa-info', color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-500/20' }
            };
            const style = typeMap[type] || typeMap['info'];

            toastIcon.className = `fa-solid ${style.icon} ${style.color}`;
            toastIconWrapper.className = `shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${style.bg}`;

            toast.classList.remove('translate-y-8', 'opacity-0');

            clearTimeout(toastTimeout);
            toastTimeout = setTimeout(() => this.hide(), 4000);
        },
        hide() {
            elements.appToast.classList.add('translate-y-8', 'opacity-0');
        }
    };
    document.querySelector('.toast-close').addEventListener('click', () => toastUtils.hide());

    // --- 极简图标映射 ---
    const classifyConfig = {
        pluginsCore: { icon: 'fa-puzzle-piece', color: 'text-emerald-500' },
        pluginsAndModsCore_Forge: { icon: 'fa-code-branch', color: 'text-orange-500' },
        pluginsAndModsCore_Fabric: { icon: 'fa-microchip', color: 'text-violet-500' },
        modsCore_Forge: { icon: 'fa-code', color: 'text-amber-500' },
        modsCore_Fabric: { icon: 'fa-bug', color: 'text-purple-500' },
        vanillaCore: { icon: 'fa-cube', color: 'text-teal-500' },
        bedrockCore: { icon: 'fa-mobile-screen', color: 'text-cyan-500' },
        proxyCore: { icon: 'fa-network-wired', color: 'text-red-500' },
        default: { icon: 'fa-server', color: 'text-blue-500' }
    };

    // --- 多语言处理 ---
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

        // 更新下拉菜单显示
        const btns = document.querySelectorAll(`[data-lang]`);
        btns.forEach(b => {
            if (b.dataset.lang === state.currentLang) {
                elements.languageDisplay.textContent = b.textContent;
            }
        });
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
            const response = await fetch('https://api.mslmc.cn/v4/mirrors');
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        },
        async getMCServerCoreSupportVersion(name) {
            const response = await fetch(`https://api.mslmc.cn/v4/mirrors/${name}`);
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        },
        async getMCServerDownloadUrl(name, version) {
            const response = await fetch(`https://api.mslmc.cn/v4/download/server/${name}/${version}`);
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        }
    };

    // --- 高级渲染函数 ---
    function renderCategories() {
        elements.categoriesGrid.innerHTML = state.serverClassify.map(category => {
            const config = classifyConfig[category.key] || classifyConfig.default;
            const title = t(`mc.serverCore.${category.key}`);
            const isActive = state.selectedCategory === title;

            // 现代化侧边栏卡片样式
            const baseClasses = "category-card group flex items-center p-3 rounded-2xl transition-all duration-300 cursor-pointer border";
            const normalClasses = "border-transparent hover:bg-white/60 dark:hover:bg-slate-800/50 hover:border-slate-200/50 dark:hover:border-slate-700/50 text-slate-600 dark:text-slate-400";
            const activeClasses = "bg-white dark:bg-slate-800 border-slate-200/60 dark:border-slate-700 shadow-sm shadow-slate-200/50 dark:shadow-none text-slate-900 dark:text-white";

            return `
                <div class="${baseClasses} ${isActive ? activeClasses : normalClasses}" data-title="${title}">
                    <div class="flex items-center justify-center w-10 h-10 rounded-xl transition-transform duration-300 ${isActive ? 'scale-110 bg-slate-50 dark:bg-slate-900 ring-1 ring-slate-100 dark:ring-slate-800' : 'group-hover:scale-110 group-hover:bg-white dark:group-hover:bg-slate-800'}">
                        <i class="fa-solid ${config.icon} ${config.color} text-lg drop-shadow-sm"></i>
                    </div>
                    <div class="ml-3 flex-grow">
                        <div class="flex justify-between items-center">
                            <h3 class="text-sm font-semibold tracking-tight ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}">${title}</h3>
                            <span class="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}">
                                ${category.cores.length}
                            </span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderServers() {
        if (!state.selectedCategory) {
            elements.serversPanel.classList.replace('flex', 'hidden');
            elements.emptyState.classList.remove('hidden');
            return;
        }
        elements.serversPanel.classList.replace('hidden', 'flex');
        elements.emptyState.classList.add('hidden');

        const category = state.serverClassify.find(c => t(`mc.serverCore.${c.key}`) === state.selectedCategory);
        if (!category) return;

        const filteredCores = category.cores.filter(core =>
            core.toLowerCase().includes(state.searchKeyword.toLowerCase())
        );

        if(filteredCores.length === 0) {
            elements.serversGrid.innerHTML = `<div class="col-span-full text-center py-8 text-slate-400 text-sm">No servers found</div>`;
            return;
        }

        elements.serversGrid.innerHTML = filteredCores.map(server => {
            const isActive = state.selectedServer === server;

            // 现代化网格卡片
            const baseClasses = "server-card relative flex justify-between items-center p-4 rounded-2xl cursor-pointer transition-all duration-300 border bg-white/50 dark:bg-slate-800/30 backdrop-blur-sm overflow-hidden";
            const normalClasses = "border-slate-200/60 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-white dark:hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-200/40 dark:hover:shadow-none hover:-translate-y-1 text-slate-700 dark:text-slate-300";
            const activeClasses = "border-primary-500 dark:border-primary-500 shadow-md shadow-primary-500/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold ring-1 ring-primary-500/20";

            return `
                <div class="${baseClasses} ${isActive ? activeClasses : normalClasses} group" data-server="${server}">
                    ${isActive ? '<div class="absolute inset-y-0 left-0 w-1 bg-primary-500"></div>' : ''}
                    <span class="${isActive ? 'ml-1' : ''} transition-all duration-300 z-10">${server}</span>
                    <div class="w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${isActive ? 'bg-primary-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'}">
                        <i class="fa-solid ${isActive ? 'fa-check text-xs' : 'fa-chevron-right text-[10px]'}"></i>
                    </div>
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
        elements.versionCardTitle.textContent = `${state.selectedServer}`;

        if (state.loadingVersions) {
            elements.versionsContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center py-12">
                    <div class="w-8 h-8 border-2 border-slate-200 dark:border-slate-700 border-t-primary-500 rounded-full animate-spin"></div>
                    <p class="mt-4 text-sm font-medium text-slate-500">${t('mc.serverCore.loadingVersions', 'Fetching versions...')}</p>
                </div>`;
            return;
        }
        if (state.versions.length === 0) {
            elements.versionsContainer.innerHTML = `<div class="text-center py-12 text-slate-500 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">${t('mc.serverCore.noVersionsFound', '未找到可用版本')}</div>`;
            return;
        }

        elements.versionsContainer.innerHTML = `<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            ${state.versions.map(version => {
            const isActive = state.selectedVersion === version;
            const isDownloading = state.loadingDownload && isActive;

            // 极简的版本药丸按钮
            const baseClasses = "version-card group flex justify-between items-center px-4 py-3 rounded-xl transition-all duration-200 border bg-white/60 dark:bg-slate-800/50 backdrop-blur-md";
            const normalClasses = "border-slate-200/80 dark:border-slate-700/80 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm text-slate-600 dark:text-slate-300";
            const activeClasses = "border-primary-500/50 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 ring-1 ring-primary-500/20 shadow-sm";
            const disabledClasses = "opacity-60 cursor-wait";

            return `
                    <div class="${baseClasses} ${isActive ? activeClasses : normalClasses} ${isDownloading ? disabledClasses : ''}" data-version="${version}">
                        <span class="text-sm font-semibold tracking-tight truncate mr-2">${version}</span>
                        ${isDownloading
                ? '<div class="w-3 h-3 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin shrink-0"></div>'
                : `<i class="fa-solid fa-cloud-arrow-down text-sm shrink-0 transition-colors ${isActive ? 'text-primary-500' : 'text-slate-300 dark:text-slate-600 group-hover:text-primary-400'}"></i>`}
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
                state.versions = res.data.versions;
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
                toastUtils.show(t('mc.serverCore.downloadStarted', 'Download starting...'));

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

    // --- 主题切换逻辑 ---
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
                light: 'fa-sun text-amber-500',
                dark: 'fa-moon text-indigo-400',
                auto: 'fa-desktop text-slate-400'
            };
            iconEl.className = `fa-solid ${icons[theme] || icons['auto']} mr-2`;
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
        return supportedLangs.find(lang => lang.startsWith(primaryLang)) || 'zh-CN';
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
            elements.categoriesGrid.innerHTML = `
                <div class="p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm font-medium">
                    <i class="fa-solid fa-triangle-exclamation mr-2"></i> ${t('mc.serverCore.networkError', 'Network Error')}
                </div>`;
        }

        // 事件委托绑定
        document.addEventListener('click', e => {
            const langBtn = e.target.closest('[data-lang]');
            if (langBtn) switchLanguage(langBtn.dataset.lang);

            const categoryCard = e.target.closest('.category-card');
            if (categoryCard) handleCategorySelect(categoryCard.dataset.title);

            const serverCard = e.target.closest('.server-card');
            if (serverCard) handleServerClick(serverCard.dataset.server);

            const versionCard = e.target.closest('.version-card');
            if (versionCard) handleVersionClick(versionCard.dataset.version);
        });

        elements.searchInput.addEventListener('input', e => {
            state.searchKeyword = e.target.value;
            renderServers();
        });

        elements.refreshBtn.addEventListener('click', () => {
            if (state.selectedServer && !state.loadingVersions) {
                handleServerClick(state.selectedServer);

                // 给刷新按钮一个旋转的小动画反馈
                const icon = elements.refreshBtn.querySelector('i');
                icon.classList.add('animate-spin');
                setTimeout(() => icon.classList.remove('animate-spin'), 500);
            }
        });
    }

    initialize();
});