/**
 * 记忆宫殿 3.0 - 角色独立记忆系统
 * 
 * 核心特性：
 * 1. 每个角色拥有独立的记忆空间
 * 2. 艾宾浩斯遗忘曲线算法（代码层面实现）
 * 3. 自动根据记忆强度筛选和排序
 * 4. 重要/日常记忆分类管理
 * 5. 今日时间线展示
 */

class MemorySystem {
    constructor() {
        // 当前角色ID
        this.currentCharacterId = null;
        
        // 所有角色的记忆存储 { characterId: { memories, todayTimeline, timelineHistory, chatStats } }
        this.characterMemories = {};
        
        // 艾宾浩斯遗忘曲线配置
        this.forgettingCurve = {
            intervals: [
                { minutes: 20, retention: 0.58 },
                { minutes: 60, retention: 0.44 },
                { minutes: 540, retention: 0.36 },      // 9小时
                { minutes: 1440, retention: 0.34 },     // 1天
                { minutes: 2880, retention: 0.28 },     // 2天
                { minutes: 8640, retention: 0.25 },     // 6天
                { minutes: 44640, retention: 0.21 }     // 31天
            ],
            weights: {
                important: 0.5,  // 重要记忆遗忘速度减半
                daily: 1.0       // 日常记忆正常遗忘
            }
        };
        
        // AI 挂载配置（默认）
        this.mountConfig = {
            maxMemories: 10,
            minStrength: 0.10,
            importantPriority: true,
            timeDecay: true
        };
        
        // 自动总结配置（默认）
        this.summaryConfig = {
            messageThreshold: 20,
            enabled: true
        };
        
        this.init();
    }
    
    // ==================== 角色管理 ====================
    
    /**
     * 设置当前角色
     * @param {string} characterId - 角色ID（chatId）
     */
    setCurrentCharacter(characterId) {
        if (!characterId) {
            console.warn('【记忆系统】设置当前角色失败：characterId 为空');
            return;
        }
        
        console.log('【记忆系统】切换角色:', this.currentCharacterId, '->', characterId);
        
        // 如果切换了角色，先保存当前角色的数据
        if (this.currentCharacterId && this.currentCharacterId !== characterId) {
            this.saveToStorage();
        }
        
        this.currentCharacterId = characterId;
        
        // 确保角色数据结构存在
        if (!this.characterMemories[characterId]) {
            this.characterMemories[characterId] = this.createEmptyCharacterMemory();
        }
        
        console.log('【记忆系统】当前角色已设置为:', characterId);
    }
    
    /**
     * 获取当前角色ID
     * @returns {string|null}
     */
    getCurrentCharacterId() {
        return this.currentCharacterId;
    }
    
    /**
     * 检查是否有当前角色
     * @returns {boolean}
     */
    hasCurrentCharacter() {
        return !!this.currentCharacterId;
    }
    
    /**
     * 创建空的角色记忆结构
     */
    createEmptyCharacterMemory() {
        return {
            memories: {
                important: [],
                daily: []
            },
            todayTimeline: [],
            timelineHistory: {},
            chatStats: {
                totalMessageCount: 0,
                currentMessageCount: 0,
                lastSummaryTime: null,
                summaryCount: 0
            }
        };
    }
    
    /**
     * 获取当前角色的记忆数据
     */
    getCurrentCharacterData() {
        if (!this.currentCharacterId) {
            return null;
        }
        return this.characterMemories[this.currentCharacterId];
    }
    
    /**
     * 删除角色的记忆数据
     * @param {string} characterId - 角色ID
     */
    async deleteCharacterMemory(characterId) {
        if (this.characterMemories[characterId]) {
            delete this.characterMemories[characterId];
            await this.saveToStorage();
            console.log('【记忆系统】已删除角色记忆:', characterId);
        }
    }
    
    /**
     * 获取所有有记忆的角色ID列表
     */
    getAllCharacterIds() {
        return Object.keys(this.characterMemories);
    }
    
    // ==================== 聊天统计方法 ====================
    
    /**
     * 更新聊天统计 - 增加消息计数
     * @param {number} count - 增加的消息数（默认1）
     * @param {string} characterId - 角色ID（可选，默认当前角色）
     */
    async incrementMessageCount(count = 1, characterId = null) {
        const targetId = characterId || this.currentCharacterId;
        if (!targetId) {
            console.warn('【记忆系统】更新消息计数失败：没有指定角色');
            return null;
        }
        
        // 确保角色数据存在
        if (!this.characterMemories[targetId]) {
            this.characterMemories[targetId] = this.createEmptyCharacterMemory();
        }
        
        const chatStats = this.characterMemories[targetId].chatStats;
        chatStats.totalMessageCount += count;
        chatStats.currentMessageCount += count;
        
        await this.saveToStorage();
        
        console.log('【记忆系统】消息计数更新:', {
            角色: targetId,
            总句数: chatStats.totalMessageCount,
            当前计数: chatStats.currentMessageCount,
            距离总结: this.getRemainingMessagesUntilSummary(targetId)
        });
        
        return chatStats;
    }
    
    /**
     * 获取距离下次总结还差多少条消息
     * @param {string} characterId - 角色ID（可选，默认当前角色）
     * @returns {number} 剩余消息数
     */
    getRemainingMessagesUntilSummary(characterId = null) {
        const targetId = characterId || this.currentCharacterId;
        if (!targetId || !this.characterMemories[targetId]) {
            return 0;
        }
        
        const chatStats = this.characterMemories[targetId].chatStats;
        const threshold = this.summaryConfig.messageThreshold || 20;
        const remaining = threshold - chatStats.currentMessageCount;
        return Math.max(0, remaining);
    }
    
    /**
     * 检查是否达到总结条件
     * @param {string} characterId - 角色ID（可选，默认当前角色）
     * @returns {boolean}
     */
    shouldTriggerSummary(characterId = null) {
        return this.getRemainingMessagesUntilSummary(characterId) === 0;
    }
    
    /**
     * 重置当前计数（总结完成后调用）
     * @param {string} characterId - 角色ID（可选，默认当前角色）
     */
    async resetCurrentCount(characterId = null) {
        const targetId = characterId || this.currentCharacterId;
        if (!targetId || !this.characterMemories[targetId]) {
            return null;
        }
        
        const chatStats = this.characterMemories[targetId].chatStats;
        chatStats.currentMessageCount = 0;
        chatStats.lastSummaryTime = Date.now();
        chatStats.summaryCount++;
        
        await this.saveToStorage();
        console.log('【记忆系统】计数已重置，总结次数:', chatStats.summaryCount);
        return chatStats;
    }
    
    /**
     * 获取聊天统计信息
     * @param {string} characterId - 角色ID（可选，默认当前角色）
     * @returns {Object} 统计信息
     */
    getChatStats(characterId = null) {
        const targetId = characterId || this.currentCharacterId;
        if (!targetId || !this.characterMemories[targetId]) {
            return {
                totalMessageCount: 0,
                currentMessageCount: 0,
                lastSummaryTime: null,
                summaryCount: 0,
                remainingUntilSummary: this.summaryConfig.messageThreshold || 20,
                threshold: this.summaryConfig.messageThreshold || 20,
                progress: 0
            };
        }
        
        const chatStats = this.characterMemories[targetId].chatStats;
        const threshold = this.summaryConfig.messageThreshold || 20;
        
        return {
            ...chatStats,
            remainingUntilSummary: Math.max(0, threshold - chatStats.currentMessageCount),
            threshold: threshold,
            progress: Math.min(100, Math.round((chatStats.currentMessageCount / threshold) * 100))
        };
    }

    /**
     * 获取所有未总结的消息（按日期分组）
     * @param {Array} allMessages - 所有消息列表
     * @param {number} summarizedCount - 已总结的消息数
     * @returns {Object} 按日期分组的消息
     */
    getUnsummarizedMessagesByDate(allMessages, summarizedCount) {
        const sortedMessages = [...allMessages].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        const unsummarizedMessages = sortedMessages.slice(summarizedCount);

        if (unsummarizedMessages.length === 0) {
            return {};
        }

        const messagesByDate = {};
        unsummarizedMessages.forEach(msg => {
            if (!msg.timestamp) return;

            const date = new Date(msg.timestamp);
            const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

            if (!messagesByDate[dateKey]) {
                messagesByDate[dateKey] = [];
            }
            messagesByDate[dateKey].push(msg);
        });

        return messagesByDate;
    }

    /**
     * 获取未总结消息的统计信息
     */
    getUnsummarizedStats(allMessages, summarizedCount) {
        const messagesByDate = this.getUnsummarizedMessagesByDate(allMessages, summarizedCount);
        const days = Object.keys(messagesByDate).sort();

        let totalUnsummarized = 0;
        days.forEach(day => {
            totalUnsummarized += messagesByDate[day].length;
        });

        return {
            totalUnsummarized,
            daysCount: days.length,
            days,
            messagesByDate
        };
    }

    async init() {
        console.log('【记忆系统】初始化中...');
        await this.loadFromStorage();
        console.log('【记忆系统】初始化完成，已加载角色数:', Object.keys(this.characterMemories).length);
    }
    
    // ==================== 核心算法：记忆曲线计算 ====================
    
    /**
     * 计算记忆当前强度（基于艾宾浩斯遗忘曲线）
     * @param {number} timestamp - 记忆创建时间戳
     * @param {string} type - 'important' | 'daily'
     * @returns {number} 记忆强度 0-1
     */
    calculateStrength(timestamp, type = 'daily') {
        const now = Date.now();
        const ageMinutes = (now - timestamp) / (1000 * 60);
        
        let baseRetention = this.getBaseRetention(ageMinutes);
        const weight = this.forgettingCurve.weights[type] || 1.0;
        
        if (type === 'important') {
            baseRetention = Math.min(1, baseRetention * (1 + weight));
        }
        
        return Math.max(0, Math.min(1, baseRetention));
    }
    
    /**
     * 获取基础保留率（根据艾宾浩斯曲线）
     */
    getBaseRetention(ageMinutes) {
        const intervals = this.forgettingCurve.intervals;
        
        if (ageMinutes < intervals[0].minutes) {
            return 1 - (ageMinutes / intervals[0].minutes) * (1 - intervals[0].retention);
        }
        
        for (let i = 0; i < intervals.length - 1; i++) {
            if (ageMinutes >= intervals[i].minutes && ageMinutes < intervals[i + 1].minutes) {
                const range = intervals[i + 1].minutes - intervals[i].minutes;
                const progress = (ageMinutes - intervals[i].minutes) / range;
                return intervals[i].retention - progress * (intervals[i].retention - intervals[i + 1].retention);
            }
        }
        
        const lastInterval = intervals[intervals.length - 1];
        if (ageMinutes >= lastInterval.minutes) {
            const additionalDecay = (ageMinutes - lastInterval.minutes) / 10080;
            return Math.max(0.05, lastInterval.retention - additionalDecay * 0.1);
        }
        
        return 0.21;
    }
    
    /**
     * 计算记忆的综合得分（用于排序）
     * @param {Object} memory - 记忆对象
     * @returns {number} 综合得分
     */
    calculateScore(memory) {
        const strength = this.calculateStrength(memory.timestamp, memory.type);
        
        let score = strength * 100;
        
        if (memory.type === 'important') {
            score += 30;
        }
        
        const ageHours = (Date.now() - memory.timestamp) / (1000 * 60 * 60);
        if (ageHours < 24) {
            score += (24 - ageHours) * 2;
        }
        
        return score;
    }
    
    /**
     * 筛选适合挂载的记忆（核心算法）
     * @param {number} limit - 最多返回多少条
     * @param {number} minStrength - 最小强度阈值
     * @param {string} characterId - 角色ID（可选，默认当前角色）
     * @returns {Array} 筛选后的记忆列表
     */
    selectMemoriesForMount(limit = 5, minStrength = 0.15, characterId = null) {
        const targetId = characterId || this.currentCharacterId;
        if (!targetId || !this.characterMemories[targetId]) {
            console.log('【记忆筛选】没有角色数据，返回空数组');
            return [];
        }
        
        const allMemories = this.getAllMemories(targetId);
        
        if (allMemories.length === 0) {
            console.log('【记忆筛选】角色没有记忆，返回空数组');
            return [];
        }
        
        const scoredMemories = allMemories.map(memory => ({
            ...memory,
            strength: this.calculateStrength(memory.timestamp, memory.type),
            score: this.calculateScore(memory)
        }));
        
        const validMemories = scoredMemories.filter(m => m.strength >= minStrength);
        validMemories.sort((a, b) => b.score - a.score);
        
        const importantMemories = validMemories.filter(m => m.type === 'important');
        const dailyMemories = validMemories.filter(m => m.type === 'daily');
        
        const minImportant = Math.ceil(limit * 0.4);
        const selectedImportant = importantMemories.slice(0, Math.min(minImportant, limit));
        const remainingSlots = limit - selectedImportant.length;
        const selectedDaily = dailyMemories.slice(0, remainingSlots);
        
        const selected = [...selectedImportant, ...selectedDaily];
        selected.sort((a, b) => b.score - a.score);
        
        console.log('【记忆筛选】角色:', targetId, {
            总记忆数: allMemories.length,
            有效记忆: validMemories.length,
            选中记忆: selected.length,
            重要记忆: selected.filter(m => m.type === 'important').length,
            日常记忆: selected.filter(m => m.type === 'daily').length
        });
        
        return selected;
    }
    
    // ==================== 存储管理 ====================
    
    async loadFromStorage() {
        try {
            let data = null;
            
            if (window.WCDBManager && window.WCDBManager.isAvailable) {
                data = await window.WCDBManager.getSetting('memorySystem_v3', null);
            }
            
            if (!data) {
                const saved = localStorage.getItem('memorySystem_v3');
                if (saved) {
                    data = JSON.parse(saved);
                }
            }
            
            if (data) {
                // 加载角色记忆数据
                if (data.characterMemories) {
                    this.characterMemories = data.characterMemories;
                }
                
                // 加载配置
                if (data.mountConfig) {
                    this.mountConfig = { ...this.mountConfig, ...data.mountConfig };
                }
                if (data.summaryConfig) {
                    this.summaryConfig = { ...this.summaryConfig, ...data.summaryConfig };
                }
                
                console.log('【记忆系统】从存储加载完成，角色数:', Object.keys(this.characterMemories).length);
            } else {
                // 尝试从旧版本迁移
                await this.migrateFromOldSystem();
            }
        } catch (error) {
            console.error('【记忆系统】加载失败:', error);
        }
    }
    
    /**
     * 从旧版本迁移数据
     */
    async migrateFromOldSystem() {
        try {
            console.log('【记忆系统】尝试从旧版本迁移数据...');
            
            let oldData = null;
            
            // 尝试加载 v2 版本数据
            if (window.WCDBManager && window.WCDBManager.isAvailable) {
                oldData = await window.WCDBManager.getSetting('memorySystem_v2', null);
            }
            
            if (!oldData) {
                const saved = localStorage.getItem('memorySystem_v2');
                if (saved) {
                    oldData = JSON.parse(saved);
                }
            }
            
            if (oldData && oldData.memories) {
                console.log('【记忆系统】发现 v2 版本数据，开始迁移...');
                
                // 创建一个默认角色来存储旧数据
                const defaultCharacterId = 'default';
                this.characterMemories[defaultCharacterId] = {
                    memories: oldData.memories || { important: [], daily: [] },
                    todayTimeline: oldData.todayTimeline || [],
                    timelineHistory: oldData.timelineHistory || {},
                    chatStats: oldData.chatStats || {
                        totalMessageCount: 0,
                        currentMessageCount: 0,
                        lastSummaryTime: null,
                        summaryCount: 0
                    }
                };
                
                // 加载配置
                if (oldData.mountConfig) {
                    this.mountConfig = { ...this.mountConfig, ...oldData.mountConfig };
                }
                if (oldData.summaryConfig) {
                    this.summaryConfig = { ...this.summaryConfig, ...oldData.summaryConfig };
                }
                
                // 保存为新格式
                await this.saveToStorage();
                
                console.log('【记忆系统】迁移完成，旧数据已迁移到默认角色:', defaultCharacterId);
                
                // 删除旧数据
                if (window.WCDBManager && window.WCDBManager.isAvailable) {
                    await window.WCDBManager.setSetting('memorySystem_v2', null);
                }
                localStorage.removeItem('memorySystem_v2');
            }
        } catch (error) {
            console.error('【记忆系统】迁移失败:', error);
        }
    }
    
    async saveToStorage() {
        try {
            const data = {
                characterMemories: this.characterMemories,
                mountConfig: this.mountConfig,
                summaryConfig: this.summaryConfig,
                lastUpdate: Date.now()
            };
            
            if (window.WCDBManager && window.WCDBManager.isAvailable) {
                await window.WCDBManager.setSetting('memorySystem_v3', data);
            } else {
                localStorage.setItem('memorySystem_v3', JSON.stringify(data));
            }
            
            console.log('【记忆系统】已保存到存储');
        } catch (error) {
            console.error('【记忆系统】保存失败:', error);
        }
    }
    
    // 更新配置
    async updateConfig(mountConfig, summaryConfig) {
        console.log('【记忆系统】开始更新配置...', { mountConfig, summaryConfig });
        
        if (mountConfig) {
            this.mountConfig = { ...this.mountConfig, ...mountConfig };
        }
        if (summaryConfig) {
            this.summaryConfig = { ...this.summaryConfig, ...summaryConfig };
        }
        
        await this.saveToStorage();
        console.log('【记忆系统】配置更新完成');
    }
    
    // ==================== 记忆 CRUD ====================
    
    /**
     * 添加记忆
     * @param {Object} memory - 记忆对象
     * @param {string} type - 'important' | 'daily'
     * @param {string} characterId - 角色ID（可选，默认当前角色）
     */
    async addMemory(memory, type = 'daily', characterId = null) {
        const targetId = characterId || this.currentCharacterId;
        if (!targetId) {
            console.error('【记忆系统】添加记忆失败：没有指定角色');
            return null;
        }
        
        // 确保角色数据存在
        if (!this.characterMemories[targetId]) {
            this.characterMemories[targetId] = this.createEmptyCharacterMemory();
        }
        
        const newMemory = {
            id: memory.id || Date.now().toString(),
            content: memory.content,
            summary: memory.summary || memory.content.substring(0, 50) + '...',
            timestamp: memory.timestamp || Date.now(),
            type: type,
            source: memory.source || 'manual',
            chatId: targetId,
            strength: 1.0
        };
        
        this.characterMemories[targetId].memories[type].push(newMemory);
        this.addToTodayTimeline(newMemory, targetId);
        await this.saveToStorage();
        
        console.log('【记忆系统】已添加记忆到角色:', targetId, '类型:', type);
        return newMemory;
    }
    
    /**
     * 添加到今日时间线
     */
    addToTodayTimeline(memory, characterId) {
        const charData = this.characterMemories[characterId];
        if (!charData) return;
        
        const memoryDate = new Date(memory.timestamp);
        const dateKey = `${memoryDate.getFullYear()}-${String(memoryDate.getMonth() + 1).padStart(2, '0')}-${String(memoryDate.getDate()).padStart(2, '0')}`;

        const entry = {
            id: memory.id,
            summary: memory.summary,
            timestamp: memory.timestamp,
            type: memory.type,
            timeLabel: this.getTimeLabel(memory.timestamp)
        };

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        // 清理非今天的记忆
        charData.todayTimeline = charData.todayTimeline.filter(e => {
            const entryDate = new Date(e.timestamp);
            return entryDate >= todayStart && entryDate <= todayEnd;
        });

        // 如果记忆是今天的，添加到 todayTimeline
        if (memoryDate >= todayStart && memoryDate <= todayEnd) {
            if (!charData.todayTimeline.find(e => e.id === memory.id)) {
                charData.todayTimeline.push(entry);
                charData.todayTimeline.sort((a, b) => a.timestamp - b.timestamp);
            }
        }

        // 保存到 timelineHistory
        if (!charData.timelineHistory[dateKey]) {
            charData.timelineHistory[dateKey] = [];
        }
        if (!charData.timelineHistory[dateKey].find(e => e.id === memory.id)) {
            charData.timelineHistory[dateKey].push(entry);
            charData.timelineHistory[dateKey].sort((a, b) => a.timestamp - b.timestamp);
        }
    }
    
    getTimeLabel(timestamp) {
        const hour = new Date(timestamp).getHours();
        if (hour < 6) return '凌晨';
        if (hour < 9) return '清晨';
        if (hour < 12) return '上午';
        if (hour < 14) return '中午';
        if (hour < 18) return '下午';
        if (hour < 22) return '傍晚';
        return '深夜';
    }
    
    /**
     * 删除记忆
     * @param {string} memoryId - 记忆ID
     * @param {string} type - 记忆类型
     * @param {string} characterId - 角色ID（可选，默认当前角色）
     */
    async deleteMemory(memoryId, type, characterId = null) {
        const targetId = characterId || this.currentCharacterId;
        if (!targetId || !this.characterMemories[targetId]) {
            return false;
        }
        
        const charData = this.characterMemories[targetId];
        const index = charData.memories[type].findIndex(m => m.id === memoryId);
        
        if (index > -1) {
            charData.memories[type].splice(index, 1);
            charData.todayTimeline = charData.todayTimeline.filter(e => e.id !== memoryId);
            Object.keys(charData.timelineHistory).forEach(date => {
                charData.timelineHistory[date] = charData.timelineHistory[date].filter(e => e.id !== memoryId);
            });
            await this.saveToStorage();
            return true;
        }
        return false;
    }
    
    // ==================== 查询方法 ====================
    
    /**
     * 获取所有记忆
     * @param {string} characterId - 角色ID（可选，默认当前角色）
     * @returns {Array} 记忆列表
     */
    getAllMemories(characterId = null) {
        const targetId = characterId || this.currentCharacterId;
        if (!targetId || !this.characterMemories[targetId]) {
            return [];
        }
        
        const charData = this.characterMemories[targetId];
        return [
            ...charData.memories.important.map(m => ({ ...m, type: 'important' })),
            ...charData.memories.daily.map(m => ({ ...m, type: 'daily' }))
        ];
    }
    
    /**
     * 按类型获取记忆
     * @param {string} type - 'important' | 'daily'
     * @param {string} characterId - 角色ID（可选，默认当前角色）
     */
    getMemoriesByType(type, characterId = null) {
        const targetId = characterId || this.currentCharacterId;
        if (!targetId || !this.characterMemories[targetId]) {
            return [];
        }
        
        return [...this.characterMemories[targetId].memories[type]]
            .map(m => ({
                ...m,
                strength: this.calculateStrength(m.timestamp, type)
            }))
            .sort((a, b) => a.timestamp - b.timestamp);
    }
    
    /**
     * 获取今日时间线
     * @param {string} characterId - 角色ID（可选，默认当前角色）
     */
    getTodayTimeline(characterId = null) {
        const targetId = characterId || this.currentCharacterId;
        if (!targetId || !this.characterMemories[targetId]) {
            return [];
        }
        
        const charData = this.characterMemories[targetId];
        const today = new Date();
        const todayStart = new Date(today);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);

        const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        let todayMemories = charData.todayTimeline.filter(entry => {
            const entryDate = new Date(entry.timestamp);
            return entryDate >= todayStart && entryDate <= todayEnd;
        });

        if (charData.timelineHistory[dateKey]) {
            const historyTodayMemories = charData.timelineHistory[dateKey].filter(entry => {
                return !todayMemories.find(m => m.id === entry.id);
            });
            todayMemories.push(...historyTodayMemories);
        }

        todayMemories.sort((a, b) => a.timestamp - b.timestamp);
        return todayMemories;
    }
    
    /**
     * 按日期获取时间线
     * @param {string} dateString - 日期字符串 YYYY-MM-DD
     * @param {string} characterId - 角色ID（可选，默认当前角色）
     */
    getTimelineByDate(dateString, characterId = null) {
        const targetId = characterId || this.currentCharacterId;
        if (!targetId || !this.characterMemories[targetId]) {
            return [];
        }
        
        return this.characterMemories[targetId].timelineHistory[dateString] || [];
    }
    
    /**
     * 获取可用日期列表
     * @param {string} characterId - 角色ID（可选，默认当前角色）
     */
    getAvailableDates(characterId = null) {
        const targetId = characterId || this.currentCharacterId;
        if (!targetId || !this.characterMemories[targetId]) {
            return [];
        }
        
        return Object.keys(this.characterMemories[targetId].timelineHistory).sort((a, b) => new Date(b) - new Date(a));
    }

    /**
     * 获取所有记忆按日期分组
     * @param {string} characterId - 角色ID（可选，默认当前角色）
     */
    getAllMemoriesByDate(characterId = null) {
        const targetId = characterId || this.currentCharacterId;
        if (!targetId || !this.characterMemories[targetId]) {
            return {};
        }
        
        const result = {};
        const charData = this.characterMemories[targetId];
        
        Object.keys(charData.timelineHistory).forEach(dateKey => {
            const memories = charData.timelineHistory[dateKey];
            if (memories && memories.length > 0) {
                result[dateKey] = [...memories].sort((a, b) => a.timestamp - b.timestamp);
            }
        });

        return result;
    }

    /**
     * 获取最近几天的记忆
     * @param {number} days - 天数
     * @param {string} characterId - 角色ID（可选，默认当前角色）
     */
    getRecentMemoriesByDate(days = 7, characterId = null) {
        const targetId = characterId || this.currentCharacterId;
        if (!targetId || !this.characterMemories[targetId]) {
            return [];
        }
        
        const allDates = this.getAvailableDates(targetId);
        const result = [];
        const recentDates = allDates.slice(0, days);

        recentDates.forEach(dateKey => {
            const memories = this.characterMemories[targetId].timelineHistory[dateKey];
            if (memories && memories.length > 0) {
                result.push({
                    date: dateKey,
                    memories: [...memories].sort((a, b) => a.timestamp - b.timestamp)
                });
            }
        });

        return result;
    }
    
    /**
     * 根据ID查找记忆
     * @param {string} id - 记忆ID
     * @param {string} characterId - 角色ID（可选，默认当前角色）
     */
    findMemoryById(id, characterId = null) {
        const targetId = characterId || this.currentCharacterId;
        if (!targetId || !this.characterMemories[targetId]) {
            return null;
        }
        
        const charData = this.characterMemories[targetId];
        return charData.memories.important.find(m => m.id === id) || 
               charData.memories.daily.find(m => m.id === id);
    }
    
    // ==================== AI 挂载接口 ====================
    
    /**
     * 获取用于AI挂载的记忆
     * @param {number} limit - 数量限制
     * @param {string} characterId - 角色ID（可选，默认当前角色）
     */
    getMemoriesForAIMount(limit = 5, characterId = null) {
        const targetId = characterId || this.currentCharacterId;
        return this.selectMemoriesForMount(limit, this.mountConfig.minStrength, targetId);
    }
    
    // ==================== 统计 ====================
    
    /**
     * 获取统计信息
     * @param {string} characterId - 角色ID（可选，默认当前角色）
     */
    getStats(characterId = null) {
        const targetId = characterId || this.currentCharacterId;
        if (!targetId || !this.characterMemories[targetId]) {
            return {
                important: { count: 0, avgStrength: 0 },
                daily: { count: 0, avgStrength: 0 },
                today: 0,
                totalDays: 0,
                totalMemories: 0
            };
        }
        
        const charData = this.characterMemories[targetId];
        const allMemories = this.getAllMemories(targetId);
        
        return {
            important: {
                count: charData.memories.important.length,
                avgStrength: charData.memories.important.length > 0 
                    ? charData.memories.important.reduce((sum, m) => sum + this.calculateStrength(m.timestamp, 'important'), 0) / charData.memories.important.length
                    : 0
            },
            daily: {
                count: charData.memories.daily.length,
                avgStrength: charData.memories.daily.length > 0
                    ? charData.memories.daily.reduce((sum, m) => sum + this.calculateStrength(m.timestamp, 'daily'), 0) / charData.memories.daily.length
                    : 0
            },
            today: this.getTodayTimeline(targetId).length,
            totalDays: Object.keys(charData.timelineHistory).length,
            totalMemories: allMemories.length
        };
    }
    
    // ==================== 数据导出/导入 ====================
    
    /**
     * 导出角色记忆数据
     * @param {string} characterId - 角色ID（可选，导出所有）
     */
    exportToJSON(characterId = null) {
        if (characterId) {
            // 导出单个角色
            if (!this.characterMemories[characterId]) {
                return null;
            }
            return {
                version: '3.0',
                characterId: characterId,
                ...this.characterMemories[characterId],
                exportedAt: Date.now()
            };
        } else {
            // 导出所有
            return {
                version: '3.0',
                characterMemories: this.characterMemories,
                mountConfig: this.mountConfig,
                summaryConfig: this.summaryConfig,
                forgettingCurve: this.forgettingCurve,
                exportedAt: Date.now()
            };
        }
    }
    
    /**
     * 从JSON导入数据
     * @param {Object} data - 导出的数据
     * @param {boolean} merge - 是否合并
     * @param {string} targetCharacterId - 目标角色ID（可选）
     */
    async importFromJSON(data, merge = false, targetCharacterId = null) {
        const result = {
            imported: { characters: 0, memories: 0 },
            skipped: 0,
            errors: []
        };
        
        try {
            if (!data || typeof data !== 'object') {
                throw new Error('无效的数据格式');
            }
            
            // 检查版本
            const isV3 = data.version === '3.0';
            
            if (targetCharacterId && data.characterId) {
                // 导入到指定角色
                if (!this.characterMemories[targetCharacterId] || !merge) {
                    this.characterMemories[targetCharacterId] = this.createEmptyCharacterMemory();
                }
                
                const charData = this.characterMemories[targetCharacterId];
                
                // 导入记忆
                if (data.memories) {
                    for (const type of ['important', 'daily']) {
                        if (data.memories[type] && Array.isArray(data.memories[type])) {
                            for (const memory of data.memories[type]) {
                                const exists = charData.memories[type].find(m => m.id === memory.id);
                                if (!exists) {
                                    charData.memories[type].push({
                                        ...memory,
                                        chatId: targetCharacterId
                                    });
                                    result.imported.memories++;
                                } else {
                                    result.skipped++;
                                }
                            }
                        }
                    }
                }
                
                result.imported.characters = 1;
                
            } else if (data.characterMemories) {
                // 导入多个角色
                if (!merge) {
                    this.characterMemories = {};
                }
                
                for (const [charId, charData] of Object.entries(data.characterMemories)) {
                    if (!this.characterMemories[charId] || !merge) {
                        this.characterMemories[charId] = this.createEmptyCharacterMemory();
                    }
                    
                    const target = this.characterMemories[charId];
                    
                    // 合并记忆
                    for (const type of ['important', 'daily']) {
                        if (charData.memories && charData.memories[type]) {
                            for (const memory of charData.memories[type]) {
                                const exists = target.memories[type].find(m => m.id === memory.id);
                                if (!exists) {
                                    target.memories[type].push(memory);
                                    result.imported.memories++;
                                } else {
                                    result.skipped++;
                                }
                            }
                        }
                    }
                    
                    // 合并时间线
                    if (charData.timelineHistory) {
                        for (const [date, entries] of Object.entries(charData.timelineHistory)) {
                            if (!target.timelineHistory[date]) {
                                target.timelineHistory[date] = [];
                            }
                            for (const entry of entries) {
                                const exists = target.timelineHistory[date].find(e => e.id === entry.id);
                                if (!exists) {
                                    target.timelineHistory[date].push(entry);
                                }
                            }
                        }
                    }
                    
                    result.imported.characters++;
                }
            }
            
            // 导入配置
            if (data.mountConfig && !merge) {
                this.mountConfig = { ...this.mountConfig, ...data.mountConfig };
            }
            if (data.summaryConfig && !merge) {
                this.summaryConfig = { ...this.summaryConfig, ...data.summaryConfig };
            }
            
            await this.saveToStorage();
            console.log('【记忆系统】数据导入完成:', result);
            return result;
            
        } catch (error) {
            console.error('【记忆系统】数据导入失败:', error);
            result.errors.push({ type: 'general', error: error.message });
            return result;
        }
    }
    
    /**
     * 获取数据摘要
     * @param {string} characterId - 角色ID（可选）
     */
    getDataSummary(characterId = null) {
        if (characterId) {
            const allMemories = this.getAllMemories(characterId);
            const charData = this.characterMemories[characterId];
            
            if (!charData) return null;
            
            return {
                characterId,
                totalMemories: allMemories.length,
                importantCount: charData.memories.important.length,
                dailyCount: charData.memories.daily.length,
                todayCount: this.getTodayTimeline(characterId).length,
                historyDays: Object.keys(charData.timelineHistory).length,
                lastUpdate: Math.max(...allMemories.map(m => m.timestamp), 0),
                chatStats: charData.chatStats
            };
        } else {
            const summaries = {};
            for (const charId of Object.keys(this.characterMemories)) {
                summaries[charId] = this.getDataSummary(charId);
            }
            return summaries;
        }
    }
}

window.memorySystem = new MemorySystem();
