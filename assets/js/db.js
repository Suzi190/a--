// IndexedDB 数据库管理
class CharacterDB {
    constructor() {
        this.dbName = 'CharacterDB';
        this.dbVersion = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('configs')) {
                    db.createObjectStore('configs', { keyPath: 'id' });
                }
            };
        });
    }

    async saveConfig(config) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['configs'], 'readwrite');
            const store = transaction.objectStore('configs');
            const request = store.put({ id: 'character', config: config });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async loadConfig() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['configs'], 'readonly');
            const store = transaction.objectStore('configs');
            const request = store.get('character');

            request.onsuccess = () => {
                resolve(request.result ? request.result.config : null);
            };
            request.onerror = () => reject(request.error);
        });
    }
}

// 聊天设置专用存储 - 使用 IndexedDB 避免 SQLite 闪退问题
class ChatSettingsDB {
    constructor() {
        this.dbName = 'ChatSettingsDB';
        this.dbVersion = 1;
        this.db = null;
        this.storeName = 'chatSettings';
    }

    async init() {
        if (this.db) return;
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('【ChatSettingsDB】打开数据库失败:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                console.log('【ChatSettingsDB】数据库初始化成功');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    // 使用 chatId 作为 keyPath
                    const store = db.createObjectStore(this.storeName, { keyPath: 'chatId' });
                    console.log('【ChatSettingsDB】创建对象存储:', this.storeName);
                }
            };
        });
    }

    // 保存单个聊天的设置
    async saveChatSettings(chatId, settings) {
        try {
            if (!this.db) await this.init();

            // 【关键修复】确保 chatId 是字符串类型，避免类型不匹配
            const chatIdStr = String(chatId);

            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                
                // 只保存必要的设置字段，避免数据过大
                const dataToSave = {
                    chatId: chatIdStr,
                    // 基本设置
                    remark: settings.remark || '',
                    name: settings.name || '',
                    myNickname: settings.myNickname || '',
                    // AI 行为设置
                    personality: settings.personality || '',
                    backgroundActivity: settings.backgroundActivity || false,
                    cooldown: settings.cooldown || 30,
                    contextLength: settings.contextLength || 20,
                    // 记忆设置
                    memorySummaryFrequency: settings.memorySummaryFrequency || 20,
                    memoryMountCount: settings.memoryMountCount || 5,
                    // 世界书
                    worldbooks: settings.worldbooks || [],
                    // 定时设置
                    autoStopBackground: settings.autoStopBackground || false,
                    autoStopTime: settings.autoStopTime || '23:00',
                    autoStartBackground: settings.autoStartBackground || false,
                    autoStartTime: settings.autoStartTime || '08:00',
                    // 语音设置
                    voiceSettings: settings.voiceSettings || {
                        voiceId: 'female-tianmei',
                        voiceLanguage: 'zh-CN',
                        voiceSpeed: 1.0
                    },
                    // 群聊挂载
                    mountedGroupChatId: settings.mountedGroupChatId || null,
                    mountedGroupChatContextCount: settings.mountedGroupChatContextCount || 10,
                    // 信件字体
                    letterFont: settings.letterFont || '',
                    // 头像和背景（引用键）
                    avatar: settings.avatar || '',
                    background: settings.background || '',
                    // 更新时间
                    updatedAt: Date.now()
                };
                
                const request = store.put(dataToSave);

                request.onsuccess = () => {
                    resolve(true);
                };
                
                request.onerror = () => {
                    console.error('【ChatSettingsDB】设置保存失败:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('【ChatSettingsDB】保存设置时出错:', error);
            return false;
        }
    }

    // 加载单个聊天的设置
    async loadChatSettings(chatId) {
        try {
            if (!this.db) await this.init();

            // 【关键修复】确保 chatId 是字符串类型
            const chatIdStr = String(chatId);

            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.get(chatIdStr);

                request.onsuccess = () => {
                    const result = request.result;
                    if (result) {
                        // 移除 chatId 字段，返回纯设置对象
                        const { chatId, ...settings } = result;
                        console.log('【ChatSettingsDB】设置加载成功:', chatId);
                        resolve(settings);
                    } else {
                        console.log('【ChatSettingsDB】未找到设置:', chatId);
                        resolve(null);
                    }
                };
                
                request.onerror = () => {
                    console.error('【ChatSettingsDB】设置加载失败:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('【ChatSettingsDB】加载设置时出错:', error);
            return null;
        }
    }

    // 加载所有聊天设置
    async loadAllChatSettings() {
        try {
            if (!this.db) await this.init();

            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.getAll();

                request.onsuccess = () => {
                    const results = request.result || [];
                    const settingsMap = {};
                    results.forEach(item => {
                        const { chatId, ...settings } = item;
                        settingsMap[chatId] = settings;
                    });
                    resolve(settingsMap);
                };
                
                request.onerror = () => {
                    console.error('【ChatSettingsDB】加载所有设置失败:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('【ChatSettingsDB】加载所有设置时出错:', error);
            return {};
        }
    }

    // 删除聊天设置
    async deleteChatSettings(chatId) {
        try {
            if (!this.db) await this.init();

            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.delete(chatId);

                request.onsuccess = () => {
                    console.log('【ChatSettingsDB】设置删除成功:', chatId);
                    resolve(true);
                };
                
                request.onerror = () => {
                    console.error('【ChatSettingsDB】设置删除失败:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('【ChatSettingsDB】删除设置时出错:', error);
            return false;
        }
    }
}

// 全局实例
window.characterDB = new CharacterDB();
window.chatSettingsDB = new ChatSettingsDB();
