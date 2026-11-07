/**
 * WCDB 数据库管理器
 * 基于微信 WCDB 的跨平台数据库解决方案
 * 支持鸿蒙、低版本安卓、iOS
 * 
 * 完全兼容原有 SQLiteManager API，无缝替换
 */

const WCDBManager = {
    db: null,
    isAvailable: false,
    isInitialized: false,
    
    // ==================== 初始化与可用性检查 ====================
    
    /**
     * 检查 WCDB 是否可用
     */
    async checkAvailability() {
        try {
            console.log('【WCDB】检查可用性...');
            console.log('【WCDB】window.Capacitor:', !!window.Capacitor);
            console.log('【WCDB】window.Capacitor.Plugins:', !!(window.Capacitor && window.Capacitor.Plugins));
            console.log('【WCDB】window.Capacitor.Plugins.WCDB:', !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.WCDB));
            
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.WCDB) {
                console.log('【WCDB】调用 isAvailable...');
                const result = await window.Capacitor.Plugins.WCDB.isAvailable();
                console.log('【WCDB】isAvailable 结果:', result);
                this.isAvailable = result.available;
                console.log('【WCDB】插件可用性检查:', this.isAvailable);
                return this.isAvailable;
            }
            console.log('【WCDB】Capacitor WCDB 插件未找到');
            this.isAvailable = false;
            return false;
        } catch (e) {
            console.log('【WCDB】检查可用性失败:', e);
            this.isAvailable = false;
            return false;
        }
    },
    
    /**
     * 手动设置可用状态
     */
    setAvailable(available) {
        this.isAvailable = available;
        console.log('【WCDB】手动设置可用状态:', available);
    },
    
    /**
     * 初始化数据库
     */
    async initDatabase() {
        if (!this.isAvailable) {
            console.log('【WCDB】initDatabase: isAvailable 为 false，跳过初始化');
            return false;
        }
        
        if (this.isInitialized) {
            console.log('【WCDB】数据库已初始化，跳过');
            return true;
        }
        
        try {
            const { WCDB } = window.Capacitor.Plugins;
            console.log('【WCDB】正在初始化数据库...');
            
            const result = await WCDB.initDatabase();
            console.log('【WCDB】数据库初始化成功:', result);
            
            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('【WCDB】初始化数据库失败:', error);
            this.isAvailable = false;
            return false;
        }
    },
    
    /**
     * 重置数据库
     */
    async resetDatabase(preserveData = true) {
        try {
            if (!this.isAvailable) {
                console.log('【WCDB】resetDatabase: WCDB 不可用');
                return false;
            }
            
            const { WCDB } = window.Capacitor.Plugins;
            console.log('【WCDB】正在重置数据库...');
            
            // 备份数据
            let backupData = null;
            if (preserveData) {
                try {
                    console.log('【WCDB】正在备份数据...');
                    const allMessages = [];
                    const chatList = await this.getChatList();
                    
                    for (const chat of chatList) {
                        const messages = await this.getAllMessagesForBackup(chat.id);
                        if (messages) {
                            allMessages.push(...messages);
                        }
                    }
                    
                    backupData = {
                        chatList: chatList,
                        messages: allMessages,
                        settings: await this.getSetting('appSettings', null),
                        profile: await this.getPersonalProfile(),
                        worldBooks: await this.getWorldBooks(),
                        backupTime: new Date().toISOString()
                    };
                    
                    await localforage.setItem('__wcdb_backup_before_reset', backupData);
                    console.log('【WCDB】数据备份完成:', {
                        聊天数: chatList.length,
                        消息数: allMessages.length
                    });
                } catch (backupError) {
                    console.warn('【WCDB】数据备份失败（继续重置）:', backupError);
                }
            }
            
            // 删除数据库
            await WCDB.deleteDatabase({ database: 'chat_messages.db' });
            console.log('【WCDB】旧数据库已删除');
            
            // 重新初始化
            this.db = null;
            this.isInitialized = false;
            const initResult = await this.initDatabase();
            
            if (initResult && backupData) {
                console.log('【WCDB】正在恢复数据...');
                
                if (backupData.chatList && backupData.chatList.length > 0) {
                    await this.saveChatList(backupData.chatList);
                    console.log('【WCDB】聊天列表已恢复');
                }
                
                if (backupData.messages && backupData.messages.length > 0) {
                    const batchSize = 100;
                    for (let i = 0; i < backupData.messages.length; i += batchSize) {
                        const batch = backupData.messages.slice(i, i + batchSize);
                        await this.saveMessages(batch);
                        console.log(`【WCDB】已恢复 ${Math.min(i + batchSize, backupData.messages.length)}/${backupData.messages.length} 条消息`);
                    }
                }
                
                if (backupData.settings) {
                    await this.setSetting('appSettings', backupData.settings);
                }
                
                if (backupData.profile) {
                    await this.savePersonalProfile(backupData.profile);
                }
                
                if (backupData.worldBooks) {
                    await this.saveWorldBooks(backupData.worldBooks);
                }
                
                console.log('【WCDB】数据恢复完成');
                await localforage.removeItem('__wcdb_backup_before_reset');
            }
            
            return true;
        } catch (error) {
            console.error('【WCDB】重置数据库失败:', error);
            return false;
        }
    },
    
    /**
     * 关闭数据库
     */
    async close() {
        if (this.isAvailable) {
            try {
                const { WCDB } = window.Capacitor.Plugins;
                await WCDB.close();
                this.db = null;
                this.isInitialized = false;
                console.log('【WCDB】数据库连接已关闭');
            } catch (error) {
                console.error('【WCDB】关闭数据库失败:', error);
            }
        }
    },
    
    // ==================== 安全解析工具 ====================
    
    safeJSONParse(value, defaultValue = null, context = '') {
        if (value === '[object Object]' || value === '' || value === null || value === undefined) {
            console.warn(`【WCDB】${context}: 检测到无效值，返回默认值:`, value);
            return defaultValue;
        }
        try {
            return JSON.parse(value);
        } catch (e) {
            console.warn(`【WCDB】${context}: JSON.parse 失败，返回默认值:`, value, e.message);
            return defaultValue;
        }
    },
    
    // ==================== 消息操作 ====================
    
    /**
     * 保存单条消息
     */
    async saveMessage(message) {
        if (!this.isAvailable || !this.isInitialized) {
            return false;
        }
        
        try {
            const { WCDB } = window.Capacitor.Plugins;
            const id = `${message.chatId}_${message.timestamp}`;
            
            // 处理 quote 字段
            let quoteValue = null;
            if (message.quote) {
                if (typeof message.quote === 'string') {
                    if (message.quote === '[object Object]') {
                        console.warn('【WCDB】saveMessage: 检测到无效的 quote 字符串，已清空');
                        quoteValue = null;
                    } else {
                        try {
                            const parsed = JSON.parse(message.quote);
                            quoteValue = JSON.stringify(parsed);
                        } catch (e) {
                            quoteValue = null;
                        }
                    }
                } else if (typeof message.quote === 'object') {
                    quoteValue = JSON.stringify(message.quote);
                }
            }
            
            await WCDB.run({
                statement: `
                    INSERT OR REPLACE INTO chat_messages 
                    (id, chatId, sender, content, timestamp, type, quote, isTeaching, isDateMessage)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                values: [
                    id,
                    message.chatId,
                    message.sender,
                    message.content || '',
                    message.timestamp,
                    message.type || 'text',
                    quoteValue,
                    message.isTeaching ? 1 : 0,
                    message.isDateMessage ? 1 : 0
                ]
            });
            return true;
        } catch (error) {
            console.error('【WCDB】保存消息失败:', error);
            return false;
        }
    },
    
    /**
     * 批量保存消息
     */
    async saveMessages(messages) {
        if (!this.isAvailable || !this.isInitialized) {
            console.warn('【WCDB】saveMessages: WCDB 不可用');
            return false;
        }
        
        try {
            const { WCDB } = window.Capacitor.Plugins;
            console.log(`【WCDB】开始保存 ${messages.length} 条消息...`);
            
            let successCount = 0;
            for (const msg of messages) {
                const id = `${msg.chatId}_${msg.timestamp}`;
                try {
                    let quoteValue = null;
                    if (msg.quote) {
                        if (typeof msg.quote === 'string') {
                            if (msg.quote === '[object Object]') {
                                quoteValue = null;
                            } else {
                                try {
                                    const parsed = JSON.parse(msg.quote);
                                    quoteValue = JSON.stringify(parsed);
                                } catch (e) {
                                    quoteValue = null;
                                }
                            }
                        } else if (typeof msg.quote === 'object') {
                            quoteValue = JSON.stringify(msg.quote);
                        }
                    }
                    
                    await WCDB.run({
                        statement: `
                            INSERT OR REPLACE INTO chat_messages 
                            (id, chatId, sender, content, timestamp, type, quote, isTeaching, isDateMessage)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `,
                        values: [
                            id,
                            msg.chatId,
                            msg.sender,
                            msg.content || '',
                            msg.timestamp,
                            msg.type || 'text',
                            quoteValue,
                            msg.isTeaching ? 1 : 0,
                            msg.isDateMessage ? 1 : 0
                        ]
                    });
                    successCount++;
                } catch (itemError) {
                    console.error('【WCDB】保存单条消息失败:', id, itemError);
                }
            }
            console.log(`【WCDB】批量保存完成: ${successCount}/${messages.length} 条成功`);
            return successCount;
        } catch (error) {
            console.error('【WCDB】批量保存消息失败:', error);
            return false;
        }
    },
    
    /**
     * 获取指定聊天的消息（分页）
     */
    async getMessages(chatId, offset = 0, limit = 50) {
        if (!this.isAvailable || !this.isInitialized) {
            return null;
        }
        
        try {
            const { WCDB } = window.Capacitor.Plugins;
            const result = await WCDB.query({
                statement: `
                    SELECT * FROM chat_messages 
                    WHERE chatId = ? 
                    AND isTeaching = 0 
                    AND isDateMessage = 0 
                    AND (type IS NULL OR type != 'hidden')
                    ORDER BY timestamp ASC 
                    LIMIT ? OFFSET ?
                `,
                values: [chatId, limit, offset]
            });
            
            return result.values.map(row => {
                let parsedQuote = null;
                if (row.quote && row.quote !== '[object Object]') {
                    try {
                        parsedQuote = JSON.parse(row.quote);
                    } catch (e) {
                        parsedQuote = null;
                    }
                }
                return {
                    id: row.id,
                    chatId: row.chatId,
                    sender: row.sender,
                    content: row.content,
                    timestamp: row.timestamp,
                    type: row.type,
                    quote: parsedQuote,
                    isTeaching: row.isTeaching === 1,
                    isDateMessage: row.isDateMessage === 1
                };
            });
        } catch (error) {
            console.error('【WCDB】获取消息失败:', error);
            return null;
        }
    },
    
    /**
     * 获取消息总数
     */
    async getMessageCount(chatId) {
        if (!this.isAvailable || !this.isInitialized) {
            return null;
        }
        
        try {
            const { WCDB } = window.Capacitor.Plugins;
            const result = await WCDB.query({
                statement: `
                    SELECT COUNT(*) as count FROM chat_messages 
                    WHERE chatId = ? 
                    AND isTeaching = 0 
                    AND isDateMessage = 0 
                    AND (type IS NULL OR type != 'hidden')
                `,
                values: [chatId]
            });
            return result.values[0].count;
        } catch (error) {
            console.error('【WCDB】获取消息数量失败:', error);
            return null;
        }
    },
    
    /**
     * 删除单条消息
     */
    async deleteMessage(chatId, timestamp) {
        if (!this.isAvailable || !this.isInitialized) {
            return false;
        }
        
        try {
            const { WCDB } = window.Capacitor.Plugins;
            
            const idFormats = [
                `${chatId}_${timestamp}`,
                `${chatId}_${Number(timestamp)}`,
                `${chatId}_${String(timestamp)}`
            ];
            
            for (const id of idFormats) {
                const checkResult = await WCDB.query({
                    statement: 'SELECT id FROM chat_messages WHERE id = ?',
                    values: [id]
                });
                
                if (checkResult.values && checkResult.values.length > 0) {
                    await WCDB.run({
                        statement: 'DELETE FROM chat_messages WHERE id = ?',
                        values: [id]
                    });
                    return true;
                }
            }
            
            // 尝试使用 timestamp 字段删除
            const timestampResult = await WCDB.run({
                statement: 'DELETE FROM chat_messages WHERE chatId = ? AND timestamp = ?',
                values: [chatId, timestamp]
            });
            
            if (timestampResult.changes && timestampResult.changes > 0) {
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('【WCDB】删除消息失败:', error);
            return false;
        }
    },
    
    /**
     * 清空指定聊天的所有消息
     */
    async clearChatMessages(chatId) {
        if (!this.isAvailable || !this.isInitialized) {
            return false;
        }
        
        try {
            const { WCDB } = window.Capacitor.Plugins;
            await WCDB.run({
                statement: 'DELETE FROM chat_messages WHERE chatId = ?',
                values: [chatId]
            });
            return true;
        } catch (error) {
            console.error('【WCDB】清空聊天消息失败:', error);
            return false;
        }
    },
    
    /**
     * 获取所有消息（用于备份）
     */
    async getAllMessagesForBackup(chatId) {
        if (!this.isAvailable || !this.isInitialized) {
            return null;
        }
        
        try {
            const { WCDB } = window.Capacitor.Plugins;
            const result = await WCDB.query({
                statement: `
                    SELECT * FROM chat_messages 
                    WHERE chatId = ? 
                    ORDER BY timestamp ASC
                `,
                values: [chatId]
            });
            
            return result.values.map(row => {
                let parsedQuote = null;
                if (row.quote && row.quote !== '[object Object]') {
                    try {
                        parsedQuote = JSON.parse(row.quote);
                    } catch (e) {
                        parsedQuote = null;
                    }
                }
                return {
                    id: row.id,
                    chatId: row.chatId,
                    sender: row.sender,
                    content: row.content,
                    timestamp: row.timestamp,
                    type: row.type,
                    quote: parsedQuote,
                    isTeaching: row.isTeaching === 1,
                    isDateMessage: row.isDateMessage === 1
                };
            });
        } catch (error) {
            console.error('【WCDB】备份获取消息失败:', error);
            return null;
        }
    },
    
    /**
     * 获取所有消息
     */
    async getAllMessages(chatId) {
        return this.getAllMessagesForBackup(chatId);
    },
    
    // ==================== 统一存储方法 ====================
    
    async setSetting(key, value) {
        if (!this.isAvailable || !this.isInitialized) return false;
        try {
            const { WCDB } = window.Capacitor.Plugins;
            await WCDB.run({
                statement: `INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)`,
                values: [key, JSON.stringify(value), Date.now()]
            });
            return true;
        } catch (error) {
            console.error('【WCDB】保存设置失败:', error);
            return false;
        }
    },
    
    async getSetting(key, defaultValue = null) {
        if (!this.isAvailable || !this.isInitialized) return defaultValue;
        try {
            const { WCDB } = window.Capacitor.Plugins;
            const result = await WCDB.query({
                statement: `SELECT value FROM app_settings WHERE key = ?`,
                values: [key]
            });
            if (result.values && result.values.length > 0) {
                return this.safeJSONParse(result.values[0].value, defaultValue, 'getSetting');
            }
            return defaultValue;
        } catch (error) {
            console.error('【WCDB】获取设置失败:', error);
            return defaultValue;
        }
    },
    
    async saveChatList(chatList) {
        if (!this.isAvailable || !this.isInitialized) return false;
        try {
            const { WCDB } = window.Capacitor.Plugins;
            await WCDB.run({ statement: `DELETE FROM chat_list` });
            for (const chat of chatList) {
                await WCDB.run({
                    statement: `INSERT INTO chat_list (id, data, updated_at) VALUES (?, ?, ?)`,
                    values: [chat.id, JSON.stringify(chat), Date.now()]
                });
            }
            return true;
        } catch (error) {
            console.error('【WCDB】保存聊天列表失败:', error);
            return false;
        }
    },
    
    async getChatList() {
        if (!this.isAvailable || !this.isInitialized) return [];
        try {
            const { WCDB } = window.Capacitor.Plugins;
            const result = await WCDB.query({
                statement: `SELECT data FROM chat_list ORDER BY updated_at DESC`
            });
            return result.values.map(row => {
                try {
                    return JSON.parse(row.data);
                } catch (e) {
                    return null;
                }
            }).filter(item => item !== null);
        } catch (error) {
            console.error('【WCDB】获取聊天列表失败:', error);
            return [];
        }
    },
    
    async saveWorldBooks(worldBooks) {
        if (!this.isAvailable || !this.isInitialized) return false;
        try {
            const { WCDB } = window.Capacitor.Plugins;
            await WCDB.run({ statement: `DELETE FROM world_books` });
            for (const book of worldBooks) {
                await WCDB.run({
                    statement: `INSERT INTO world_books (id, data, updated_at) VALUES (?, ?, ?)`,
                    values: [book.id, JSON.stringify(book), Date.now()]
                });
            }
            return true;
        } catch (error) {
            console.error('【WCDB】保存世界书失败:', error);
            return false;
        }
    },
    
    async getWorldBooks() {
        if (!this.isAvailable || !this.isInitialized) return [];
        try {
            const { WCDB } = window.Capacitor.Plugins;
            const result = await WCDB.query({
                statement: `SELECT data FROM world_books`
            });
            return result.values.map(row => {
                try {
                    return JSON.parse(row.data);
                } catch (e) {
                    return null;
                }
            }).filter(item => item !== null);
        } catch (error) {
            console.error('【WCDB】获取世界书失败:', error);
            return [];
        }
    },
    
    async saveRelationshipData(key, value) {
        if (!this.isAvailable || !this.isInitialized) return false;
        try {
            const { WCDB } = window.Capacitor.Plugins;
            const serializedValue = JSON.stringify(value, (k, v) => {
                if (v === undefined) return null;
                if (typeof v === 'string' && v === '[object Object]') {
                    return '';
                }
                return v;
            });
            
            await WCDB.run({
                statement: `INSERT OR REPLACE INTO relationship_data (key, value, updated_at) VALUES (?, ?, ?)`,
                values: [key, serializedValue, Date.now()]
            });
            return true;
        } catch (error) {
            console.error('【WCDB】保存关系数据失败:', error);
            return false;
        }
    },
    
    async getRelationshipData(key, defaultValue = null) {
        if (!this.isAvailable || !this.isInitialized) return defaultValue;
        try {
            const { WCDB } = window.Capacitor.Plugins;
            const result = await WCDB.query({
                statement: `SELECT value FROM relationship_data WHERE key = ?`,
                values: [key]
            });
            if (result.values && result.values.length > 0) {
                return this.safeJSONParse(result.values[0].value, defaultValue, 'getRelationshipData');
            }
            return defaultValue;
        } catch (error) {
            console.error('【WCDB】获取关系数据失败:', error);
            return defaultValue;
        }
    },
    
    // ==================== 个人资料 ====================
    async savePersonalProfile(profile) {
        if (!this.isAvailable || !this.isInitialized) return false;
        try {
            const { WCDB } = window.Capacitor.Plugins;
            await WCDB.run({
                statement: `INSERT OR REPLACE INTO personal_profile (id, data, updated_at) VALUES (1, ?, ?)`,
                values: [JSON.stringify(profile), Date.now()]
            });
            return true;
        } catch (error) {
            console.error('【WCDB】保存个人资料失败:', error);
            return false;
        }
    },
    
    async getPersonalProfile() {
        if (!this.isAvailable || !this.isInitialized) return null;
        try {
            const { WCDB } = window.Capacitor.Plugins;
            const result = await WCDB.query({
                statement: `SELECT data FROM personal_profile WHERE id = 1`
            });
            if (result.values && result.values.length > 0) {
                return this.safeJSONParse(result.values[0].data, null, 'getPersonalProfile');
            }
            return null;
        } catch (error) {
            console.error('【WCDB】获取个人资料失败:', error);
            return null;
        }
    },
    
    // ==================== 通话记录 ====================
    async saveCallRecordsForChat(chatId, records) {
        if (!this.isAvailable || !this.isInitialized) return false;
        try {
            const { WCDB } = window.Capacitor.Plugins;
            await WCDB.run({
                statement: `DELETE FROM call_records WHERE id = ?`,
                values: [chatId]
            });
            await WCDB.run({
                statement: `INSERT INTO call_records (id, data, updated_at) VALUES (?, ?, ?)`,
                values: [chatId, JSON.stringify(records), Date.now()]
            });
            return true;
        } catch (error) {
            console.error('【WCDB】保存通话记录失败:', error);
            return false;
        }
    },
    
    async getCallRecordsForChat(chatId) {
        if (!this.isAvailable || !this.isInitialized) return [];
        try {
            const { WCDB } = window.Capacitor.Plugins;
            const result = await WCDB.query({
                statement: `SELECT data FROM call_records WHERE id = ?`,
                values: [chatId]
            });
            if (result.values && result.values.length > 0) {
                return this.safeJSONParse(result.values[0].data, [], 'getCallRecordsForChat');
            }
            return [];
        } catch (error) {
            console.error('【WCDB】获取通话记录失败:', error);
            return [];
        }
    },
    
    async saveCallRecords(records) {
        if (!this.isAvailable || !this.isInitialized) return false;
        try {
            const { WCDB } = window.Capacitor.Plugins;
            await WCDB.run({ statement: `DELETE FROM call_records` });
            for (const record of records) {
                await WCDB.run({
                    statement: `INSERT INTO call_records (id, data, updated_at) VALUES (?, ?, ?)`,
                    values: [record.id || Date.now().toString(), JSON.stringify(record), Date.now()]
                });
            }
            return true;
        } catch (error) {
            console.error('【WCDB】保存通话记录失败:', error);
            return false;
        }
    },
    
    async getCallRecords() {
        if (!this.isAvailable || !this.isInitialized) return [];
        try {
            const { WCDB } = window.Capacitor.Plugins;
            const result = await WCDB.query({
                statement: `SELECT data FROM call_records ORDER BY updated_at DESC`
            });
            return result.values.map(row => this.safeJSONParse(row.data, null, 'getCallRecords')).filter(item => item !== null);
        } catch (error) {
            console.error('【WCDB】获取通话记录失败:', error);
            return [];
        }
    },
    
    // ==================== 荣誉墙 ====================
    async saveHonorWall(data) {
        if (!this.isAvailable || !this.isInitialized) return false;
        try {
            const { WCDB } = window.Capacitor.Plugins;
            await WCDB.run({
                statement: `INSERT OR REPLACE INTO honor_wall (id, data, updated_at) VALUES ('main', ?, ?)`,
                values: [JSON.stringify(data), Date.now()]
            });
            return true;
        } catch (error) {
            console.error('【WCDB】保存荣誉墙失败:', error);
            return false;
        }
    },
    
    async getHonorWall() {
        if (!this.isAvailable || !this.isInitialized) return null;
        try {
            const { WCDB } = window.Capacitor.Plugins;
            const result = await WCDB.query({
                statement: `SELECT data FROM honor_wall WHERE id = 'main'`
            });
            if (result.values && result.values.length > 0) {
                return this.safeJSONParse(result.values[0].data, null, 'getHonorWall');
            }
            return null;
        } catch (error) {
            console.error('【WCDB】获取荣誉墙失败:', error);
            return null;
        }
    },
    
    // ==================== 聊天徽章 ====================
    async saveChatBadges(badges) {
        if (!this.isAvailable || !this.isInitialized) return false;
        try {
            const { WCDB } = window.Capacitor.Plugins;
            await WCDB.run({
                statement: `INSERT OR REPLACE INTO chat_badges (id, data, updated_at) VALUES ('main', ?, ?)`,
                values: [JSON.stringify(badges), Date.now()]
            });
            return true;
        } catch (error) {
            console.error('【WCDB】保存聊天徽章失败:', error);
            return false;
        }
    },
    
    async getChatBadges() {
        if (!this.isAvailable || !this.isInitialized) return null;
        try {
            const { WCDB } = window.Capacitor.Plugins;
            const result = await WCDB.query({
                statement: `SELECT data FROM chat_badges WHERE id = 'main'`
            });
            if (result.values && result.values.length > 0) {
                return this.safeJSONParse(result.values[0].data, null, 'getChatBadges');
            }
            return null;
        } catch (error) {
            console.error('【WCDB】获取聊天徽章失败:', error);
            return null;
        }
    },
    
    // ==================== 桌面组件数据 ====================
    async setWidgetData(key, value) {
        if (!this.isAvailable || !this.isInitialized) return false;
        try {
            const { WCDB } = window.Capacitor.Plugins;
            await WCDB.run({
                statement: `INSERT OR REPLACE INTO widget_data (key, value, updated_at) VALUES (?, ?, ?)`,
                values: [key, JSON.stringify(value), Date.now()]
            });
            return true;
        } catch (error) {
            console.error('【WCDB】保存组件数据失败:', error);
            return false;
        }
    },
    
    async getWidgetData(key, defaultValue = null) {
        if (!this.isAvailable || !this.isInitialized) return defaultValue;
        try {
            const { WCDB } = window.Capacitor.Plugins;
            const result = await WCDB.query({
                statement: `SELECT value FROM widget_data WHERE key = ?`,
                values: [key]
            });
            if (result.values && result.values.length > 0) {
                return this.safeJSONParse(result.values[0].value, defaultValue, 'getWidgetData');
            }
            return defaultValue;
        } catch (error) {
            console.error('【WCDB】获取组件数据失败:', error);
            return defaultValue;
        }
    },
    
    // ==================== 应用状态 ====================
    async setAppState(key, value) {
        if (!this.isAvailable || !this.isInitialized) return false;
        try {
            const { WCDB } = window.Capacitor.Plugins;
            await WCDB.run({
                statement: `INSERT OR REPLACE INTO app_state (key, value, updated_at) VALUES (?, ?, ?)`,
                values: [key, JSON.stringify(value), Date.now()]
            });
            return true;
        } catch (error) {
            console.error('【WCDB】保存应用状态失败:', error);
            return false;
        }
    },
    
    async getAppState(key, defaultValue = null) {
        if (!this.isAvailable || !this.isInitialized) return defaultValue;
        try {
            const { WCDB } = window.Capacitor.Plugins;
            const result = await WCDB.query({
                statement: `SELECT value FROM app_state WHERE key = ?`,
                values: [key]
            });
            if (result.values && result.values.length > 0) {
                return this.safeJSONParse(result.values[0].value, defaultValue, 'getAppState');
            }
            return defaultValue;
        } catch (error) {
            console.error('【WCDB】获取应用状态失败:', error);
            return defaultValue;
        }
    },
    
    // ==================== 通用键值对存储 ====================
    async setItem(table, key, value) {
        if (!this.isAvailable || !this.isInitialized) return false;
        try {
            const { WCDB } = window.Capacitor.Plugins;
            await WCDB.run({
                statement: `INSERT OR REPLACE INTO ${table} (key, value, updated_at) VALUES (?, ?, ?)`,
                values: [key, JSON.stringify(value), Date.now()]
            });
            return true;
        } catch (error) {
            console.error(`【WCDB】保存到 ${table} 失败:`, error);
            return false;
        }
    },
    
    async getItem(table, key, defaultValue = null) {
        if (!this.isAvailable || !this.isInitialized) return defaultValue;
        try {
            const { WCDB } = window.Capacitor.Plugins;
            const result = await WCDB.query({
                statement: `SELECT value FROM ${table} WHERE key = ?`,
                values: [key]
            });
            if (result.values && result.values.length > 0) {
                return this.safeJSONParse(result.values[0].value, defaultValue, `getItem(${table})`);
            }
            return defaultValue;
        } catch (error) {
            console.error(`【WCDB】从 ${table} 获取失败:`, error);
            return defaultValue;
        }
    },
    
    // ==================== 日记数据 ====================
    async saveDiaryData(diaryData) {
        if (!this.isAvailable || !this.isInitialized) return false;
        try {
            const { WCDB } = window.Capacitor.Plugins;
            await WCDB.run({
                statement: `INSERT OR REPLACE INTO diary_data (id, data, updated_at) VALUES ('main', ?, ?)`,
                values: [JSON.stringify(diaryData), Date.now()]
            });
            return true;
        } catch (error) {
            console.error('【WCDB】保存日记数据失败:', error);
            return false;
        }
    },
    
    async getDiaryData() {
        if (!this.isAvailable || !this.isInitialized) return [];
        try {
            const { WCDB } = window.Capacitor.Plugins;
            const result = await WCDB.query({
                statement: `SELECT data FROM diary_data WHERE id = 'main'`
            });
            if (result.values && result.values.length > 0) {
                return this.safeJSONParse(result.values[0].data, [], 'getDiaryData');
            }
            return [];
        } catch (error) {
            console.error('【WCDB】获取日记数据失败:', error);
            return [];
        }
    },
    
    async saveDiaryCoverSettings(settings) {
        if (!this.isAvailable || !this.isInitialized) return false;
        try {
            const { WCDB } = window.Capacitor.Plugins;
            await WCDB.run({
                statement: `INSERT OR REPLACE INTO diary_cover_settings (id, data, updated_at) VALUES ('main', ?, ?)`,
                values: [JSON.stringify(settings), Date.now()]
            });
            return true;
        } catch (error) {
            console.error('【WCDB】保存日记封面设置失败:', error);
            return false;
        }
    },
    
    async getDiaryCoverSettings() {
        if (!this.isAvailable || !this.isInitialized) return {};
        try {
            const { WCDB } = window.Capacitor.Plugins;
            const result = await WCDB.query({
                statement: `SELECT data FROM diary_cover_settings WHERE id = 'main'`
            });
            if (result.values && result.values.length > 0) {
                return this.safeJSONParse(result.values[0].data, {}, 'getDiaryCoverSettings');
            }
            return {};
        } catch (error) {
            console.error('【WCDB】获取日记封面设置失败:', error);
            return {};
        }
    },
    
    async saveMyDiaryContents(contents) {
        if (!this.isAvailable || !this.isInitialized) return false;
        try {
            const { WCDB } = window.Capacitor.Plugins;
            await WCDB.run({
                statement: `INSERT OR REPLACE INTO my_diary_contents (id, data, updated_at) VALUES ('main', ?, ?)`,
                values: [JSON.stringify(contents), Date.now()]
            });
            return true;
        } catch (error) {
            console.error('【WCDB】保存我的日记内容失败:', error);
            return false;
        }
    },
    
    async getMyDiaryContents() {
        if (!this.isAvailable || !this.isInitialized) return {};
        try {
            const { WCDB } = window.Capacitor.Plugins;
            const result = await WCDB.query({
                statement: `SELECT data FROM my_diary_contents WHERE id = 'main'`
            });
            if (result.values && result.values.length > 0) {
                return this.safeJSONParse(result.values[0].data, {}, 'getMyDiaryContents');
            }
            return {};
        } catch (error) {
            console.error('【WCDB】获取我的日记内容失败:', error);
            return {};
        }
    },
    
    // ==================== 日记按钮图标数据 ====================
    async saveDiaryButtonIcons(characterId, icons) {
        if (!this.isAvailable || !this.isInitialized) return false;
        try {
            const { WCDB } = window.Capacitor.Plugins;
            const key = characterId === 'mine' ? 'my_diary_buttons' : `character_${characterId}_buttons`;
            await WCDB.run({
                statement: `INSERT OR REPLACE INTO diary_button_icons (key, data, updated_at) VALUES (?, ?, ?)`,
                values: [key, JSON.stringify(icons), Date.now()]
            });
            return true;
        } catch (error) {
            console.error('【WCDB】保存日记按钮图标失败:', error);
            return false;
        }
    },
    
    async getDiaryButtonIcons(characterId) {
        if (!this.isAvailable || !this.isInitialized) return {};
        try {
            const { WCDB } = window.Capacitor.Plugins;
            const key = characterId === 'mine' ? 'my_diary_buttons' : `character_${characterId}_buttons`;
            const result = await WCDB.query({
                statement: `SELECT data FROM diary_button_icons WHERE key = ?`,
                values: [key]
            });
            if (result.values && result.values.length > 0) {
                return this.safeJSONParse(result.values[0].data, {}, 'getDiaryButtonIcons');
            }
            return {};
        } catch (error) {
            console.error('【WCDB】获取日记按钮图标失败:', error);
            return {};
        }
    },
    
    // ==================== 备忘录数据 ====================
    async saveMemoData(key, value) {
        if (!this.isAvailable || !this.isInitialized) return false;
        try {
            const { WCDB } = window.Capacitor.Plugins;
            await WCDB.run({
                statement: `INSERT OR REPLACE INTO memo_data (key, value, updated_at) VALUES (?, ?, ?)`,
                values: [key, JSON.stringify(value), Date.now()]
            });
            return true;
        } catch (error) {
            console.error('【WCDB】保存备忘录数据失败:', error);
            return false;
        }
    },
    
    async getMemoData(key, defaultValue = null) {
        if (!this.isAvailable || !this.isInitialized) return defaultValue;
        try {
            const { WCDB } = window.Capacitor.Plugins;
            const result = await WCDB.query({
                statement: `SELECT value FROM memo_data WHERE key = ?`,
                values: [key]
            });
            if (result.values && result.values.length > 0) {
                return this.safeJSONParse(result.values[0].value, defaultValue, 'getMemoData');
            }
            return defaultValue;
        } catch (error) {
            console.error('【WCDB】获取备忘录数据失败:', error);
            return defaultValue;
        }
    },
    
    // ==================== 健康记录数据 ====================
    async saveHealthData(key, value) {
        if (!this.isAvailable || !this.isInitialized) return false;
        try {
            const { WCDB } = window.Capacitor.Plugins;
            await WCDB.run({
                statement: `INSERT OR REPLACE INTO health_data (key, value, updated_at) VALUES (?, ?, ?)`,
                values: [key, JSON.stringify(value), Date.now()]
            });
            return true;
        } catch (error) {
            console.error('【WCDB】保存健康记录失败:', error);
            return false;
        }
    },
    
    async getHealthData(key, defaultValue = null) {
        if (!this.isAvailable || !this.isInitialized) return defaultValue;
        try {
            const { WCDB } = window.Capacitor.Plugins;
            const result = await WCDB.query({
                statement: `SELECT value FROM health_data WHERE key = ?`,
                values: [key]
            });
            if (result.values && result.values.length > 0) {
                return this.safeJSONParse(result.values[0].value, defaultValue, 'getHealthData');
            }
            return defaultValue;
        } catch (error) {
            console.error('【WCDB】获取健康记录失败:', error);
            return defaultValue;
        }
    },
    
    // ==================== 学习课桌数据 ====================
    async saveStudyDeskData(data) {
        if (!this.isAvailable || !this.isInitialized) return false;
        try {
            const { WCDB } = window.Capacitor.Plugins;
            await WCDB.run({
                statement: `INSERT OR REPLACE INTO study_desk_data (id, data, updated_at) VALUES ('main', ?, ?)`,
                values: [JSON.stringify(data), Date.now()]
            });
            return true;
        } catch (error) {
            console.error('【WCDB】保存学习课桌数据失败:', error);
            return false;
        }
    },
    
    async getStudyDeskData() {
        if (!this.isAvailable || !this.isInitialized) return {};
        try {
            const { WCDB } = window.Capacitor.Plugins;
            const result = await WCDB.query({
                statement: `SELECT data FROM study_desk_data WHERE id = 'main'`
            });
            if (result.values && result.values.length > 0) {
                return this.safeJSONParse(result.values[0].data, {}, 'getStudyDeskData');
            }
            return {};
        } catch (error) {
            console.error('【WCDB】获取学习课桌数据失败:', error);
            return {};
        }
    },
    
    // ==================== 数据库维护 ====================
    
    /**
     * 获取数据库信息
     */
    async getDatabaseInfo() {
        if (!this.isAvailable || !this.isInitialized) return null;
        try {
            const { WCDB } = window.Capacitor.Plugins;
            return await WCDB.getDatabaseInfo();
        } catch (error) {
            console.error('【WCDB】获取数据库信息失败:', error);
            return null;
        }
    },
    
    /**
     * 清理旧消息
     */
    async cleanupOldMessages(maxMessagesPerChat = 1000) {
        if (!this.isAvailable || !this.isInitialized) return false;
        
        try {
            const { WCDB } = window.Capacitor.Plugins;
            console.log('【WCDB】开始清理旧消息，每个聊天保留最新', maxMessagesPerChat, '条');
            
            const chatResult = await WCDB.query({
                statement: 'SELECT DISTINCT chatId FROM chat_messages'
            });
            
            let totalDeleted = 0;
            
            for (const row of chatResult.values) {
                const chatId = row.chatId;
                
                const countResult = await WCDB.query({
                    statement: 'SELECT COUNT(*) as count FROM chat_messages WHERE chatId = ?',
                    values: [chatId]
                });
                
                const messageCount = countResult.values[0].count;
                
                if (messageCount > maxMessagesPerChat) {
                    const deleteResult = await WCDB.run({
                        statement: `
                            DELETE FROM chat_messages 
                            WHERE chatId = ? AND id IN (
                                SELECT id FROM chat_messages 
                                WHERE chatId = ? 
                                ORDER BY timestamp ASC 
                                LIMIT ?
                            )
                        `,
                        values: [chatId, chatId, messageCount - maxMessagesPerChat]
                    });
                    
                    totalDeleted += deleteResult.changes || 0;
                }
            }
            
            console.log('【WCDB】清理完成，共删除', totalDeleted, '条旧消息');
            return true;
        } catch (error) {
            console.error('【WCDB】清理旧消息失败:', error);
            return false;
        }
    },
    
    /**
     * 获取数据库大小
     */
    async getDatabaseSize() {
        if (!this.isAvailable || !this.isInitialized) return null;
        
        try {
            const { WCDB } = window.Capacitor.Plugins;
            const result = await WCDB.query({
                statement: `
                    SELECT 
                        COUNT(*) as messageCount,
                        SUM(LENGTH(content)) as totalContentSize
                    FROM chat_messages
                `
            });
            
            return {
                messageCount: result.values[0].messageCount,
                totalContentSize: result.values[0].totalContentSize || 0
            };
        } catch (error) {
            console.error('【WCDB】获取数据库大小失败:', error);
            return null;
        }
    }
};

// 导出到全局
window.WCDBManager = WCDBManager;
