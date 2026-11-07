/**
 * SQLite 到 WCDB 适配器
 * 自动检测并使用 WCDB，如果不可用则回退到 SQLite
 * 
 * 使用方法：
 * 1. 在 index.html 中引入此文件
 * 2. 原有的 SQLiteManager 调用会自动使用 WCDB（如果可用）
 * 
 * 注意：此文件会自动创建 SQLiteManager 对象，无需额外的 sqlite-manager.js
 */

(function() {
    'use strict';
    
    console.log('【适配器】SQLite -> WCDB 适配器加载中...');
    
    // 如果 window.SQLiteManager 不存在，创建一个空的占位对象
    if (!window.SQLiteManager) {
        console.log('【适配器】SQLiteManager 不存在，创建占位对象');
        window.SQLiteManager = {
            isAvailable: false,
            checkAvailability: async function() { return false; },
            initDatabase: async function() { return false; }
        };
    }
    
    // 保存原始 SQLiteManager 引用（必须在创建对象之前）
    var originalSQLiteRef = window.SQLiteManager;
    console.log('【适配器】保存原始 SQLiteManager:', !!originalSQLiteRef);
    
    /**
     * 创建适配器对象
     * 优先使用 WCDB，如果不可用则回退到 SQLite
     */
    const DatabaseAdapter = {
        // 内部状态
        _useWCDB: false,
        _wcdbAvailable: false,
        _sqliteAvailable: false,
        _initialized: false,
        _originalSQLite: originalSQLiteRef,
        
        // ==================== 初始化 ====================
        
        /**
         * 初始化适配器
         */
        async init() {
            if (this._initialized) {
                return true;
            }
            
            console.log('【适配器】初始化数据库适配器...');
            
            // 等待 Capacitor 准备好（如果在 Capacitor 环境中）
            if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
                console.log('【适配器】检测到 Capacitor 原生环境，等待 ready...');
                try {
                    await window.Capacitor.Plugins.App.getInfo();
                    console.log('【适配器】Capacitor 已就绪');
                } catch (e) {
                    console.log('【适配器】Capacitor 可能未完全就绪，继续尝试...');
                }
            }
            
            // 1. 检查 WCDB 是否可用
            if (window.WCDBManager) {
                try {
                    console.log('【适配器】检查 WCDB 可用性...');
                    this._wcdbAvailable = await window.WCDBManager.checkAvailability();
                    console.log('【适配器】WCDB 可用性:', this._wcdbAvailable);
                    
                    if (this._wcdbAvailable) {
                        console.log('【适配器】正在初始化 WCDB 数据库...');
                        const initResult = await window.WCDBManager.initDatabase();
                        console.log('【适配器】WCDB 初始化结果:', initResult);
                        
                        if (initResult) {
                            this._useWCDB = true;
                            console.log('【适配器】WCDB 初始化成功，将使用 WCDB');
                            
                            // 执行数据迁移（如果需要）
                            await this._migrateIfNeeded();
                        } else {
                            console.warn('【适配器】WCDB 初始化返回 false');
                        }
                    } else {
                        console.log('【适配器】WCDB 插件不可用');
                    }
                } catch (error) {
                    console.warn('【适配器】WCDB 初始化失败:', error);
                    this._wcdbAvailable = false;
                }
            } else {
                console.log('【适配器】window.WCDBManager 不存在');
            }
            
            // 2. 如果 WCDB 不可用，检查 SQLite
            if (!this._useWCDB && this._originalSQLite) {
                this._sqliteAvailable = this._originalSQLite.isAvailable;
                if (this._sqliteAvailable) {
                    console.log('【适配器】将使用 SQLite');
                }
            }
            
            // 3. 如果都不可用
            if (!this._useWCDB && !this._sqliteAvailable) {
                console.warn('【适配器】WCDB 和 SQLite 都不可用');
            }
            
            this._initialized = true;
            
            // 打印最终状态
            console.log('【适配器】初始化完成:', {
                useWCDB: this._useWCDB,
                wcdbAvailable: this._wcdbAvailable,
                sqliteAvailable: this._sqliteAvailable
            });
            
            return this._useWCDB || this._sqliteAvailable;
        },
        
        /**
         * 如果需要，执行数据迁移
         */
        async _migrateIfNeeded() {
            if (window.WCDBMigration) {
                try {
                    const needMigration = await window.WCDBMigration.checkNeedMigration();
                    if (needMigration) {
                        console.log('【适配器】检测到需要数据迁移，开始迁移...');
                        const result = await window.WCDBMigration.migrate();
                        console.log('【适配器】数据迁移结果:', result);
                    }
                } catch (error) {
                    console.error('【适配器】数据迁移失败:', error);
                }
            }
        },
        
        // ==================== 属性代理 ====================
        
        get isAvailable() {
            if (!this._initialized) {
                return (window.WCDBManager && window.WCDBManager.isAvailable) || 
                       (this._originalSQLite && this._originalSQLite.isAvailable);
            }
            return this._useWCDB ? this._wcdbAvailable : this._sqliteAvailable;
        },
        
        get db() {
            return this._useWCDB ? window.WCDBManager.db : this._originalSQLite.db;
        },
        
        // ==================== 方法代理 ====================
        
        async checkAvailability() {
            await this.init();
            return this.isAvailable;
        },
        
        setAvailable(available) {
            if (this._useWCDB) {
                window.WCDBManager.setAvailable(available);
            } else if (this._originalSQLite) {
                this._originalSQLite.setAvailable(available);
            }
        },
        
        async initDatabase() {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.initDatabase();
            } else if (this._originalSQLite) {
                return await this._originalSQLite.initDatabase();
            }
            return false;
        },
        
        async resetDatabase(preserveData = true) {
            if (this._useWCDB) {
                return await window.WCDBManager.resetDatabase(preserveData);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.resetDatabase(preserveData);
            }
            return false;
        },
        
        async close() {
            if (this._useWCDB) {
                return await window.WCDBManager.close();
            } else if (this._originalSQLite) {
                return await this._originalSQLite.close();
            }
        },
        
        safeJSONParse(value, defaultValue = null, context = '') {
            if (this._useWCDB) {
                return window.WCDBManager.safeJSONParse(value, defaultValue, context);
            } else if (this._originalSQLite) {
                return this._originalSQLite.safeJSONParse(value, defaultValue, context);
            }
            return defaultValue;
        },
        
        // ==================== 消息操作 ====================
        
        async saveMessage(message) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.saveMessage(message);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.saveMessage(message);
            }
            return false;
        },
        
        async saveMessages(messages) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.saveMessages(messages);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.saveMessages(messages);
            }
            return false;
        },
        
        async getMessages(chatId, offset = 0, limit = 50) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.getMessages(chatId, offset, limit);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.getMessages(chatId, offset, limit);
            }
            return null;
        },
        
        async getMessageCount(chatId) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.getMessageCount(chatId);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.getMessageCount(chatId);
            }
            return null;
        },
        
        async deleteMessage(chatId, timestamp) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.deleteMessage(chatId, timestamp);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.deleteMessage(chatId, timestamp);
            }
            return false;
        },
        
        async clearChatMessages(chatId) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.clearChatMessages(chatId);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.clearChatMessages(chatId);
            }
            return false;
        },
        
        async getAllMessagesForBackup(chatId) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.getAllMessagesForBackup(chatId);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.getAllMessagesForBackup(chatId);
            }
            return null;
        },
        
        async getAllMessages(chatId) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.getAllMessages(chatId);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.getAllMessages(chatId);
            }
            return null;
        },
        
        // ==================== 统一存储 ====================
        
        async setSetting(key, value) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.setSetting(key, value);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.setSetting(key, value);
            }
            return false;
        },
        
        async getSetting(key, defaultValue = null) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.getSetting(key, defaultValue);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.getSetting(key, defaultValue);
            }
            return defaultValue;
        },
        
        async saveChatList(chatList) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.saveChatList(chatList);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.saveChatList(chatList);
            }
            return false;
        },
        
        async getChatList() {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.getChatList();
            } else if (this._originalSQLite) {
                return await this._originalSQLite.getChatList();
            }
            return [];
        },
        
        async saveWorldBooks(worldBooks) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.saveWorldBooks(worldBooks);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.saveWorldBooks(worldBooks);
            }
            return false;
        },
        
        async getWorldBooks() {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.getWorldBooks();
            } else if (this._originalSQLite) {
                return await this._originalSQLite.getWorldBooks();
            }
            return [];
        },
        
        async saveRelationshipData(key, value) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.saveRelationshipData(key, value);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.saveRelationshipData(key, value);
            }
            return false;
        },
        
        async getRelationshipData(key, defaultValue = null) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.getRelationshipData(key, defaultValue);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.getRelationshipData(key, defaultValue);
            }
            return defaultValue;
        },
        
        // ==================== 个人资料 ====================
        
        async savePersonalProfile(profile) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.savePersonalProfile(profile);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.savePersonalProfile(profile);
            }
            return false;
        },
        
        async getPersonalProfile() {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.getPersonalProfile();
            } else if (this._originalSQLite) {
                return await this._originalSQLite.getPersonalProfile();
            }
            return null;
        },
        
        // ==================== 通话记录 ====================
        
        async saveCallRecordsForChat(chatId, records) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.saveCallRecordsForChat(chatId, records);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.saveCallRecordsForChat(chatId, records);
            }
            return false;
        },
        
        async getCallRecordsForChat(chatId) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.getCallRecordsForChat(chatId);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.getCallRecordsForChat(chatId);
            }
            return [];
        },
        
        async saveCallRecords(records) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.saveCallRecords(records);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.saveCallRecords(records);
            }
            return false;
        },
        
        async getCallRecords() {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.getCallRecords();
            } else if (this._originalSQLite) {
                return await this._originalSQLite.getCallRecords();
            }
            return [];
        },
        
        // ==================== 荣誉墙 ====================
        
        async saveHonorWall(data) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.saveHonorWall(data);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.saveHonorWall(data);
            }
            return false;
        },
        
        async getHonorWall() {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.getHonorWall();
            } else if (this._originalSQLite) {
                return await this._originalSQLite.getHonorWall();
            }
            return null;
        },
        
        // ==================== 聊天徽章 ====================
        
        async saveChatBadges(badges) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.saveChatBadges(badges);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.saveChatBadges(badges);
            }
            return false;
        },
        
        async getChatBadges() {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.getChatBadges();
            } else if (this._originalSQLite) {
                return await this._originalSQLite.getChatBadges();
            }
            return null;
        },
        
        // ==================== 桌面组件 ====================
        
        async setWidgetData(key, value) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.setWidgetData(key, value);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.setWidgetData(key, value);
            }
            return false;
        },
        
        async getWidgetData(key, defaultValue = null) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.getWidgetData(key, defaultValue);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.getWidgetData(key, defaultValue);
            }
            return defaultValue;
        },
        
        // ==================== 应用状态 ====================
        
        async setAppState(key, value) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.setAppState(key, value);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.setAppState(key, value);
            }
            return false;
        },
        
        async getAppState(key, defaultValue = null) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.getAppState(key, defaultValue);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.getAppState(key, defaultValue);
            }
            return defaultValue;
        },
        
        // ==================== 通用存储 ====================
        
        async setItem(table, key, value) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.setItem(table, key, value);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.setItem(table, key, value);
            }
            return false;
        },
        
        async getItem(table, key, defaultValue = null) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.getItem(table, key, defaultValue);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.getItem(table, key, defaultValue);
            }
            return defaultValue;
        },
        
        // ==================== 日记数据 ====================
        
        async saveDiaryData(diaryData) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.saveDiaryData(diaryData);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.saveDiaryData(diaryData);
            }
            return false;
        },
        
        async getDiaryData() {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.getDiaryData();
            } else if (this._originalSQLite) {
                return await this._originalSQLite.getDiaryData();
            }
            return [];
        },
        
        async saveDiaryCoverSettings(settings) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.saveDiaryCoverSettings(settings);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.saveDiaryCoverSettings(settings);
            }
            return false;
        },
        
        async getDiaryCoverSettings() {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.getDiaryCoverSettings();
            } else if (this._originalSQLite) {
                return await this._originalSQLite.getDiaryCoverSettings();
            }
            return {};
        },
        
        async saveMyDiaryContents(contents) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.saveMyDiaryContents(contents);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.saveMyDiaryContents(contents);
            }
            return false;
        },
        
        async getMyDiaryContents() {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.getMyDiaryContents();
            } else if (this._originalSQLite) {
                return await this._originalSQLite.getMyDiaryContents();
            }
            return {};
        },
        
        // ==================== 日记按钮图标 ====================
        
        async saveDiaryButtonIcons(characterId, icons) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.saveDiaryButtonIcons(characterId, icons);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.saveDiaryButtonIcons(characterId, icons);
            }
            return false;
        },
        
        async getDiaryButtonIcons(characterId) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.getDiaryButtonIcons(characterId);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.getDiaryButtonIcons(characterId);
            }
            return {};
        },
        
        // ==================== 备忘录 ====================
        
        async saveMemoData(key, value) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.saveMemoData(key, value);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.saveMemoData(key, value);
            }
            return false;
        },
        
        async getMemoData(key, defaultValue = null) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.getMemoData(key, defaultValue);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.getMemoData(key, defaultValue);
            }
            return defaultValue;
        },
        
        // ==================== 健康记录 ====================
        
        async saveHealthData(key, value) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.saveHealthData(key, value);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.saveHealthData(key, value);
            }
            return false;
        },
        
        async getHealthData(key, defaultValue = null) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.getHealthData(key, defaultValue);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.getHealthData(key, defaultValue);
            }
            return defaultValue;
        },
        
        // ==================== 学习课桌 ====================
        
        async saveStudyDeskData(data) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.saveStudyDeskData(data);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.saveStudyDeskData(data);
            }
            return false;
        },
        
        async getStudyDeskData() {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.getStudyDeskData();
            } else if (this._originalSQLite) {
                return await this._originalSQLite.getStudyDeskData();
            }
            return {};
        },
        
        // ==================== 数据库维护 ====================
        
        async getDatabaseInfo() {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.getDatabaseInfo();
            }
            return null;
        },
        
        async cleanupOldMessages(maxMessagesPerChat = 1000) {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.cleanupOldMessages(maxMessagesPerChat);
            } else if (this._originalSQLite) {
                return await this._originalSQLite.cleanupOldMessages(maxMessagesPerChat);
            }
            return false;
        },
        
        async getDatabaseSize() {
            await this.init();
            if (this._useWCDB) {
                return await window.WCDBManager.getDatabaseSize();
            } else if (this._originalSQLite) {
                return await this._originalSQLite.getDatabaseSize();
            }
            return null;
        },
        
        // ==================== 额外方法 ====================
        
        /**
         * 获取当前使用的数据库类型
         */
        getCurrentDatabaseType() {
            if (!this._initialized) {
                return 'unknown';
            }
            return this._useWCDB ? 'wcdb' : 'sqlite';
        },
        
        /**
         * 强制使用 WCDB（如果可用）
         */
        async forceUseWCDB() {
            if (window.WCDBManager) {
                const available = await window.WCDBManager.checkAvailability();
                if (available) {
                    this._wcdbAvailable = true;
                    this._useWCDB = true;
                    await window.WCDBManager.initDatabase();
                    console.log('【适配器】已强制切换到 WCDB');
                    return true;
                }
            }
            console.warn('【适配器】WCDB 不可用，无法切换');
            return false;
        },
        
        /**
         * 强制使用 SQLite
         */
        forceUseSQLite() {
            // 使用 _originalSQLite 引用
            if (this._originalSQLite) {
                this._sqliteAvailable = this._originalSQLite.isAvailable;
                this._useWCDB = false;
                console.log('【适配器】已强制切换到 SQLite');
                return true;
            }
            console.warn('【适配器】SQLite 不可用，无法切换');
            return false;
        }
    };
    
    // 替换全局的 SQLiteManager
    window.SQLiteManager = DatabaseAdapter;
    
    // 同时提供 WCDBManager 的别名（方便直接访问）
    window.WCDBManager = window.WCDBManager || {};
    
    console.log('【适配器】SQLite -> WCDB 适配器加载完成');
    console.log('【适配器】原有的 SQLiteManager 现在会自动优先使用 WCDB（如果可用）');
    console.log('【适配器】原始 SQLiteManager 存在:', !!originalSQLiteRef);
    
    // 【重要】延迟初始化，确保所有脚本都加载完成
    setTimeout(function() {
        console.log('【适配器】开始延迟初始化...');
        DatabaseAdapter.init().then(function(result) {
            console.log('【适配器】初始化结果:', result);
        }).catch(function(error) {
            console.error('【适配器】初始化失败:', error);
        });
    }, 100);
    
})();
