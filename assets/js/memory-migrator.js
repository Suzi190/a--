/**
 * 记忆迁移工具 - 使用 AI 将旧记忆分类到新的重要/日常系统
 */

class MemoryMigrator {
    constructor() {
        this.isMigrating = false;
        this.progress = {
            total: 0,
            processed: 0,
            important: 0,
            daily: 0,
            failed: 0,
            currentBatch: 0,
            totalBatches: 0
        };
        // 分批配置
        this.batchConfig = {
            batchSize: 40,       // 每批处理40条记忆
            delayBetweenBatches: 1000,  // 每批之间延迟1秒
            maxRetries: 3       // 单条记忆最大重试次数
        };
    }
    
    /**
     * 从旧系统收集所有记忆，并按时间排序（从早到晚）
     */
    async collectOldMemories() {
        const oldMemories = [];
        
        console.log('【记忆迁移】开始收集旧记忆...');
        console.log('【记忆迁移】window.localforage:', !!window.localforage);
        console.log('【记忆迁移】window.relationshipData:', !!window.relationshipData);
        
        // 尝试从 localforage 加载数据
        let relationshipData = null;
        try {
            if (window.localforage) {
                relationshipData = await window.localforage.getItem('relationshipData');
                console.log('【记忆迁移】从 localforage 加载数据:', relationshipData ? '成功' : '失败');
                if (relationshipData) {
                    console.log('【记忆迁移】localforage 数据类型:', typeof relationshipData);
                    console.log('【记忆迁移】localforage 是否有 wechatChatList:', !!relationshipData.wechatChatList);
                    if (relationshipData.wechatChatList) {
                        console.log('【记忆迁移】localforage wechatChatList 长度:', relationshipData.wechatChatList.length);
                    }
                }
            } else {
                console.log('【记忆迁移】window.localforage 不可用');
            }
        } catch (e) {
            console.error('【记忆迁移】从 localforage 加载数据失败:', e);
        }
        
        // 如果 localforage 没有，尝试从 window.relationshipData
        if (!relationshipData && window.relationshipData) {
            relationshipData = window.relationshipData;
            console.log('【记忆迁移】使用 window.relationshipData');
            console.log('【记忆迁移】window.relationshipData 类型:', typeof relationshipData);
            console.log('【记忆迁移】window.relationshipData 是否有 wechatChatList:', !!relationshipData.wechatChatList);
            if (relationshipData.wechatChatList) {
                console.log('【记忆迁移】window.relationshipData wechatChatList 长度:', relationshipData.wechatChatList.length);
            }
        }
        
        console.log('【记忆迁移】最终 relationshipData:', !!relationshipData);
        console.log('【记忆迁移】最终 wechatChatList:', relationshipData?.wechatChatList?.length || 0);
        
        // 【新增】如果 relationshipData 没有数据，尝试从 SQLite 加载
        if (!relationshipData || !relationshipData.wechatChatList || relationshipData.wechatChatList.length === 0) {
            console.log('【记忆迁移】尝试从 SQLite 加载聊天列表...');
            try {
                if (window.SQLiteManager && window.SQLiteManager.isAvailable) {
                    const chatList = await window.SQLiteManager.getChatList();
                    console.log('【记忆迁移】从 SQLite 加载聊天列表:', chatList ? chatList.length : 0, '个聊天');
                    if (chatList && chatList.length > 0) {
                        // 【调试】打印第一个聊天的完整数据
                        console.log('【记忆迁移】第一个聊天对象:', JSON.stringify(chatList[0], null, 2));
                        console.log('【记忆迁移】第一个聊天的 memories:', chatList[0].memories);
                        console.log('【记忆迁移】第一个聊天的 memories 类型:', typeof chatList[0].memories);
                        relationshipData = { wechatChatList: chatList };
                        console.log('【记忆迁移】使用 SQLite 的聊天列表');
                    }
                } else {
                    console.log('【记忆迁移】SQLiteManager 不可用');
                }
            } catch (e) {
                console.error('【记忆迁移】从 SQLite 加载失败:', e);
            }
        }
        
        // 从 relationshipData 中收集
        if (relationshipData && relationshipData.wechatChatList) {
            console.log('【记忆迁移】找到聊天列表，共', relationshipData.wechatChatList.length, '个聊天');
            
            for (const chat of relationshipData.wechatChatList) {
                console.log('【记忆迁移】检查聊天:', chat.name || chat.id);
                console.log('【记忆迁移】聊天对象键:', Object.keys(chat));
                console.log('【记忆迁移】chat.memories:', chat.memories);
                console.log('【记忆迁移】chat.memories 类型:', typeof chat.memories);
                console.log('【记忆迁移】chat.memories 是数组:', Array.isArray(chat.memories));
                console.log('【记忆迁移】chat.memories 长度:', chat.memories?.length || 0);
                console.log('【记忆迁移】chat.longTermMemories:', chat.longTermMemories?.length || 0);
                
                if (chat.memories && Array.isArray(chat.memories)) {
                    console.log('【记忆迁移】从聊天', chat.name || chat.id, '收集到', chat.memories.length, '条私聊记忆');
                    for (const memory of chat.memories) {
                        oldMemories.push({
                            ...memory,
                            chatId: chat.id,
                            chatName: chat.name || chat.remark || '未知',
                            source: 'chat'
                        });
                    }
                }
                
                // 群聊长期记忆
                if (chat.longTermMemories && Array.isArray(chat.longTermMemories)) {
                    console.log('【记忆迁移】从群聊', chat.name || chat.id, '收集到', chat.longTermMemories.length, '条长期记忆');
                    for (const memory of chat.longTermMemories) {
                        oldMemories.push({
                            ...memory,
                            chatId: chat.id,
                            chatName: chat.name || '群聊',
                            source: 'group',
                            isGroup: true
                        });
                    }
                }
            }
        } else {
            console.log('【记忆迁移】没有找到 relationshipData 或 wechatChatList');
        }
        
        // 【新增】检查 relationshipData.memories（全局记忆存储）
        if (relationshipData && relationshipData.memories && Array.isArray(relationshipData.memories)) {
            console.log('【记忆迁移】从 relationshipData.memories 收集到', relationshipData.memories.length, '条全局记忆');
            for (const memory of relationshipData.memories) {
                oldMemories.push({
                    ...memory,
                    chatId: 'global',
                    chatName: '全局记忆',
                    source: 'global'
                });
            }
        }
        
        // 【新增】检查 localStorage 中的记忆数据
        try {
            const localStorageKeys = ['memories', 'longTermMemories', 'chatMemories', 'relationshipData'];
            for (const key of localStorageKeys) {
                const data = localStorage.getItem(key);
                if (data) {
                    try {
                        const parsed = JSON.parse(data);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            console.log('【记忆迁移】从 localStorage[' + key + '] 收集到', parsed.length, '条记忆');
                            for (const memory of parsed) {
                                if (memory && typeof memory === 'object') {
                                    oldMemories.push({
                                        ...memory,
                                        chatId: memory.chatId || 'localStorage',
                                        chatName: memory.chatName || '本地存储',
                                        source: 'localStorage_' + key
                                    });
                                }
                            }
                        } else if (parsed && typeof parsed === 'object' && parsed.memories && Array.isArray(parsed.memories)) {
                            console.log('【记忆迁移】从 localStorage[' + key + '].memories 收集到', parsed.memories.length, '条记忆');
                            for (const memory of parsed.memories) {
                                if (memory && typeof memory === 'object') {
                                    oldMemories.push({
                                        ...memory,
                                        chatId: memory.chatId || 'localStorage',
                                        chatName: memory.chatName || '本地存储',
                                        source: 'localStorage_' + key
                                    });
                                }
                            }
                        }
                    } catch (e) {
                        console.log('【记忆迁移】解析 localStorage[' + key + '] 失败:', e.message);
                    }
                }
            }
        } catch (e) {
            console.error('【记忆迁移】检查 localStorage 失败:', e);
        }
        
        // 按时间排序（从早到晚）
        oldMemories.sort((a, b) => {
            const timeA = a.timestamp || a.startTime || 0;
            const timeB = b.timestamp || b.startTime || 0;
            return timeA - timeB;
        });
        
        console.log('【记忆迁移】收集到旧记忆:', oldMemories.length, '条，已按时间排序');
        
        // 打印时间范围
        if (oldMemories.length > 0) {
            const firstTime = oldMemories[0].timestamp || oldMemories[0].startTime;
            const lastTime = oldMemories[oldMemories.length - 1].timestamp || oldMemories[oldMemories.length - 1].startTime;
            if (firstTime && lastTime) {
                console.log('【记忆迁移】时间范围:', 
                    new Date(firstTime).toLocaleString(), '到', 
                    new Date(lastTime).toLocaleString()
                );
            }
        }
        
        return oldMemories;
    }
    
    /**
     * 使用 AI 分类单条记忆
     */
    async classifyMemoryWithAI(memory, apiSettings) {
        const prompt = `请分析以下记忆内容，判断它应该被分类为"重要记忆"还是"日常记忆"。

重要记忆的特征：
- 涉及情感交流、关系发展
- 包含承诺、约定或重要决定
- 记录了特殊的时刻或事件
- 对双方关系有重要意义
- 包含个人秘密或深层想法

日常记忆的特征：
- 普通的问候或闲聊
- 日常琐事分享
- 简单的信息交换
- 没有特殊情感价值

记忆内容：
"""${memory.content}"""

${memory.summary ? `记忆摘要：${memory.summary}` : ''}

请只回答一个字："重要" 或 "日常"`;

        try {
            const response = await fetch(`${apiSettings.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiSettings.apiKey}`
                },
                body: JSON.stringify({
                    model: apiSettings.model || 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                            content: '你是一个记忆分类助手，帮助用户将记忆分类为重要或日常。只回答"重要"或"日常"。'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 10
                })
            });
            
            if (!response.ok) {
                throw new Error(`API 请求失败: ${response.status}`);
            }
            
            const data = await response.json();
            const result = data.choices[0].message.content.trim();
            
            // 解析结果
            if (result.includes('重要')) {
                return 'important';
            } else if (result.includes('日常')) {
                return 'daily';
            }
            
            // 默认返回日常
            return 'daily';
            
        } catch (error) {
            console.error('【记忆迁移】AI 分类失败:', error);
            // 失败时默认分类为日常
            return 'daily';
        }
    }
    
    /**
     * 批量分类记忆（分批处理，带进度回调）
     */
    async classifyMemoriesBatch(memories, apiSettings, onProgress) {
        const results = {
            important: [],
            daily: [],
            failed: []
        };
        
        this.progress.total = memories.length;
        this.progress.processed = 0;
        this.progress.currentBatch = 0;
        
        // 计算批次
        const totalBatches = Math.ceil(memories.length / this.batchConfig.batchSize);
        this.progress.totalBatches = totalBatches;
        
        console.log(`【记忆迁移】开始分批处理，共 ${memories.length} 条记忆，分 ${totalBatches} 批，每批 ${this.batchConfig.batchSize} 条`);
        
        // 分批处理
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            this.progress.currentBatch = batchIndex + 1;
            
            const start = batchIndex * this.batchConfig.batchSize;
            const end = Math.min(start + this.batchConfig.batchSize, memories.length);
            const batch = memories.slice(start, end);
            
            console.log(`【记忆迁移】处理第 ${batchIndex + 1}/${totalBatches} 批，共 ${batch.length} 条记忆`);
            
            // 处理当前批次
            for (const memory of batch) {
                let retryCount = 0;
                let success = false;
                
                // 重试机制
                while (retryCount < this.batchConfig.maxRetries && !success) {
                    try {
                        const type = await this.classifyMemoryWithAI(memory, apiSettings);
                        
                        if (type === 'important') {
                            results.important.push(memory);
                            this.progress.important++;
                        } else {
                            results.daily.push(memory);
                            this.progress.daily++;
                        }
                        
                        success = true;
                        
                    } catch (error) {
                        retryCount++;
                        console.error(`【记忆迁移】分类失败 (尝试 ${retryCount}/${this.batchConfig.maxRetries}):`, error);
                        
                        if (retryCount >= this.batchConfig.maxRetries) {
                            // 超过重试次数，标记为失败
                            results.failed.push(memory);
                            this.progress.failed++;
                            console.log('【记忆迁移】超过最大重试次数，标记为失败:', memory.summary || memory.content.substring(0, 50));
                        } else {
                            // 等待后重试
                            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                        }
                    }
                }
                
                // 更新进度
                this.progress.processed++;
                
                if (onProgress) {
                    onProgress({
                        ...this.progress,
                        stage: 'classifying',
                        currentMemory: memory.summary || memory.content.substring(0, 50) + '...',
                        batchProgress: `${this.progress.currentBatch}/${totalBatches}`
                    });
                }
                
                // 单条处理完后短暂延迟
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            // 批次之间延迟，避免API限制
            if (batchIndex < totalBatches - 1) {
                console.log(`【记忆迁移】第 ${batchIndex + 1} 批完成，等待 ${this.batchConfig.delayBetweenBatches}ms 后继续...`);
                if (onProgress) {
                    onProgress({
                        ...this.progress,
                        stage: 'waiting',
                        message: `第 ${batchIndex + 1}/${totalBatches} 批完成，等待中...`
                    });
                }
                await new Promise(resolve => setTimeout(resolve, this.batchConfig.delayBetweenBatches));
            }
        }
        
        console.log(`【记忆迁移】分批处理完成，重要: ${results.important.length}, 日常: ${results.daily.length}, 失败: ${results.failed.length}`);
        
        return results;
    }
    
    /**
     * 开始迁移流程
     */
    async startMigration(onProgress, onComplete) {
        if (this.isMigrating) {
            throw new Error('迁移正在进行中');
        }
        
        this.isMigrating = true;
        
        try {
            // 1. 收集旧记忆
            const oldMemories = await this.collectOldMemories();
            
            if (oldMemories.length === 0) {
                onComplete && onComplete({
                    success: true,
                    message: '没有找到需要迁移的旧记忆',
                    stats: { total: 0, important: 0, daily: 0, failed: 0 }
                });
                return;
            }
            
            // 2. 获取 API 设置
            const apiSettings = await this.getAPISettings();
            
            if (!apiSettings.apiKey) {
                throw new Error('请先配置 API 密钥');
            }
            
            // 3. AI 分类
            onProgress && onProgress({ stage: 'classifying', message: '正在使用 AI 分类记忆...' });
            
            const classified = await this.classifyMemoriesBatch(
                oldMemories, 
                apiSettings,
                (progress) => {
                    onProgress && onProgress({ 
                        stage: 'classifying', 
                        message: `正在分类记忆 (${progress.processed}/${progress.total})`,
                        progress 
                    });
                }
            );
            
            // 4. 导入到新系统
            onProgress && onProgress({ stage: 'importing', message: '正在导入新系统...' });
            
            const imported = await this.importToNewSystem(classified);
            
            // 5. 【新增】清除旧记忆数据
            onProgress && onProgress({ stage: 'cleaning', message: '正在清理旧数据...' });
            await this.clearOldMemories();
            
            // 6. 完成
            onComplete && onComplete({
                success: true,
                message: '迁移完成！旧记忆数据已清除',
                stats: {
                    total: oldMemories.length,
                    important: imported.important.length,
                    daily: imported.daily.length,
                    failed: classified.failed.length
                }
            });
            
        } catch (error) {
            console.error('【记忆迁移】迁移失败:', error);
            onComplete && onComplete({
                success: false,
                message: error.message,
                error: error
            });
        } finally {
            this.isMigrating = false;
        }
    }
    
    /**
     * 导入到新系统
     */
    async importToNewSystem(classified) {
        const imported = {
            important: [],
            daily: []
        };
        
        // 导入重要记忆
        for (const memory of classified.important) {
            const newMemory = await window.memorySystem.addMemory(memory, 'important');
            imported.important.push(newMemory);
        }
        
        // 导入日常记忆
        for (const memory of classified.daily) {
            const newMemory = await window.memorySystem.addMemory(memory, 'daily');
            imported.daily.push(newMemory);
        }
        
        return imported;
    }
    
    /**
     * 清除旧记忆数据
     */
    async clearOldMemories() {
        console.log('【记忆迁移】开始清除旧记忆数据...');
        
        try {
            // 从 relationshipData 中清除
            if (window.relationshipData && window.relationshipData.wechatChatList) {
                for (const chat of window.relationshipData.wechatChatList) {
                    // 清除私聊记忆
                    if (chat.memories && Array.isArray(chat.memories)) {
                        const memoryCount = chat.memories.length;
                        chat.memories = [];
                        console.log(`【记忆迁移】清除聊天 ${chat.name || chat.id} 的 ${memoryCount} 条私聊记忆`);
                    }
                    
                    // 清除群聊长期记忆
                    if (chat.longTermMemories && Array.isArray(chat.longTermMemories)) {
                        const memoryCount = chat.longTermMemories.length;
                        chat.longTermMemories = [];
                        console.log(`【记忆迁移】清除群聊 ${chat.name || chat.id} 的 ${memoryCount} 条长期记忆`);
                    }
                    
                    // 重置计数器
                    chat.totalMessageCount = 0;
                    chat.summarizedMessageCount = 0;
                }
                
                // 保存清理后的数据
                if (window.saveChatListOnly) {
                    await window.saveChatListOnly();
                    console.log('【记忆迁移】旧记忆数据已清除并保存');
                }
            }
        } catch (error) {
            console.error('【记忆迁移】清除旧记忆数据失败:', error);
            // 不影响迁移结果
        }
    }
    
    /**
     * 获取 API 设置
     */
    async getAPISettings() {
        // 优先使用设置中的 API
        const settings = await window.loadAppSettings({});
        
        // 检查是否使用副 API
        const useSecondary = settings.api?.secondary?.enabled && settings.api?.secondary?.apiKey;
        
        if (useSecondary) {
            return {
                baseUrl: settings.api.secondary.baseUrl || 'https://api.openai.com/v1',
                apiKey: settings.api.secondary.apiKey,
                model: settings.api.secondary.model || 'gpt-4o-mini'
            };
        }
        
        return {
            baseUrl: settings.api?.baseUrl || 'https://api.openai.com/v1',
            apiKey: settings.api?.apiKey || localStorage.getItem('apiKey'),
            model: settings.api?.model || 'gpt-4o'
        };
    }
    
    /**
     * 获取迁移进度
     */
    getProgress() {
        return this.progress;
    }
    
    /**
     * 是否正在迁移
     */
    isMigrationRunning() {
        return this.isMigrating;
    }
}

// 创建全局实例
window.memoryMigrator = new MemoryMigrator();
