/**
 * WCDB 数据迁移工具
 * 从 SQLite 迁移数据到 WCDB
 */

const WCDBMigration = {
    isMigrating: false,
    
    /**
     * 检查是否需要迁移
     */
    async checkNeedMigration() {
        try {
            // 检查是否已经迁移过
            const migrated = await localforage.getItem('__wcdb_migration_completed');
            if (migrated) {
                console.log('【WCDB迁移】已经迁移过，跳过');
                return false;
            }
            
            // 检查 SQLite 是否有数据
            const sqliteHasData = await this.checkSQLiteHasData();
            if (!sqliteHasData) {
                console.log('【WCDB迁移】SQLite 没有数据，不需要迁移');
                await localforage.setItem('__wcdb_migration_completed', true);
                return false;
            }
            
            // 检查 WCDB 是否可用
            if (!window.WCDBManager || !window.WCDBManager.isAvailable) {
                console.log('【WCDB迁移】WCDB 不可用，无法迁移');
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('【WCDB迁移】检查迁移需求失败:', error);
            return false;
        }
    },
    
    /**
     * 检查 SQLite 是否有数据
     */
    async checkSQLiteHasData() {
        try {
            // 检查 SQLiteManager 是否存在且有数据
            if (!window.SQLiteManager || !window.SQLiteManager.isAvailable) {
                return false;
            }
            
            const chatList = await window.SQLiteManager.getChatList();
            return chatList && chatList.length > 0;
        } catch (error) {
            console.error('【WCDB迁移】检查 SQLite 数据失败:', error);
            return false;
        }
    },
    
    /**
     * 执行数据迁移
     */
    async migrate() {
        if (this.isMigrating) {
            console.log('【WCDB迁移】迁移正在进行中，跳过');
            return { success: false, message: '迁移正在进行中' };
        }
        
        this.isMigrating = true;
        
        try {
            console.log('【WCDB迁移】开始数据迁移...');
            
            const results = {
                chatList: 0,
                messages: 0,
                settings: false,
                profile: false,
                worldBooks: 0,
                callRecords: 0,
                honorWall: false,
                chatBadges: false,
                widgetData: 0,
                appState: 0,
                diaryData: false,
                diaryCoverSettings: false,
                myDiaryContents: false,
                diaryButtonIcons: 0,
                memoData: 0,
                healthData: 0,
                studyDeskData: false,
                relationshipData: 0
            };
            
            // 1. 迁移聊天列表
            try {
                const chatList = await window.SQLiteManager.getChatList();
                if (chatList && chatList.length > 0) {
                    await window.WCDBManager.saveChatList(chatList);
                    results.chatList = chatList.length;
                    console.log(`【WCDB迁移】聊天列表迁移完成: ${chatList.length} 个聊天`);
                }
            } catch (error) {
                console.error('【WCDB迁移】聊天列表迁移失败:', error);
            }
            
            // 2. 迁移消息
            try {
                const chatList = await window.SQLiteManager.getChatList();
                let totalMessages = 0;
                
                for (const chat of chatList) {
                    const messages = await window.SQLiteManager.getAllMessagesForBackup(chat.id);
                    if (messages && messages.length > 0) {
                        // 分批保存，避免内存问题
                        const batchSize = 100;
                        for (let i = 0; i < messages.length; i += batchSize) {
                            const batch = messages.slice(i, i + batchSize);
                            await window.WCDBManager.saveMessages(batch);
                        }
                        totalMessages += messages.length;
                        console.log(`【WCDB迁移】聊天 ${chat.id} 消息迁移完成: ${messages.length} 条`);
                    }
                }
                results.messages = totalMessages;
                console.log(`【WCDB迁移】消息迁移完成: 共 ${totalMessages} 条`);
            } catch (error) {
                console.error('【WCDB迁移】消息迁移失败:', error);
            }
            
            // 3. 迁移设置
            try {
                const settings = await window.SQLiteManager.getSetting('appSettings', null);
                if (settings) {
                    await window.WCDBManager.setSetting('appSettings', settings);
                    results.settings = true;
                    console.log('【WCDB迁移】应用设置迁移完成');
                }
            } catch (error) {
                console.error('【WCDB迁移】应用设置迁移失败:', error);
            }
            
            // 4. 迁移个人资料
            try {
                const profile = await window.SQLiteManager.getPersonalProfile();
                if (profile) {
                    await window.WCDBManager.savePersonalProfile(profile);
                    results.profile = true;
                    console.log('【WCDB迁移】个人资料迁移完成');
                }
            } catch (error) {
                console.error('【WCDB迁移】个人资料迁移失败:', error);
            }
            
            // 5. 迁移世界书
            try {
                const worldBooks = await window.SQLiteManager.getWorldBooks();
                if (worldBooks && worldBooks.length > 0) {
                    await window.WCDBManager.saveWorldBooks(worldBooks);
                    results.worldBooks = worldBooks.length;
                    console.log(`【WCDB迁移】世界书迁移完成: ${worldBooks.length} 本`);
                }
            } catch (error) {
                console.error('【WCDB迁移】世界书迁移失败:', error);
            }
            
            // 6. 迁移通话记录
            try {
                const callRecords = await window.SQLiteManager.getCallRecords();
                if (callRecords && callRecords.length > 0) {
                    await window.WCDBManager.saveCallRecords(callRecords);
                    results.callRecords = callRecords.length;
                    console.log(`【WCDB迁移】通话记录迁移完成: ${callRecords.length} 条`);
                }
            } catch (error) {
                console.error('【WCDB迁移】通话记录迁移失败:', error);
            }
            
            // 7. 迁移荣誉墙
            try {
                const honorWall = await window.SQLiteManager.getHonorWall();
                if (honorWall) {
                    await window.WCDBManager.saveHonorWall(honorWall);
                    results.honorWall = true;
                    console.log('【WCDB迁移】荣誉墙迁移完成');
                }
            } catch (error) {
                console.error('【WCDB迁移】荣誉墙迁移失败:', error);
            }
            
            // 8. 迁移聊天徽章
            try {
                const chatBadges = await window.SQLiteManager.getChatBadges();
                if (chatBadges) {
                    await window.WCDBManager.saveChatBadges(chatBadges);
                    results.chatBadges = true;
                    console.log('【WCDB迁移】聊天徽章迁移完成');
                }
            } catch (error) {
                console.error('【WCDB迁移】聊天徽章迁移失败:', error);
            }
            
            // 9. 迁移日记数据
            try {
                const diaryData = await window.SQLiteManager.getDiaryData();
                if (diaryData && diaryData.length > 0) {
                    await window.WCDBManager.saveDiaryData(diaryData);
                    results.diaryData = true;
                    console.log('【WCDB迁移】日记数据迁移完成');
                }
            } catch (error) {
                console.error('【WCDB迁移】日记数据迁移失败:', error);
            }
            
            // 10. 迁移日记封面设置
            try {
                const diaryCoverSettings = await window.SQLiteManager.getDiaryCoverSettings();
                if (diaryCoverSettings && Object.keys(diaryCoverSettings).length > 0) {
                    await window.WCDBManager.saveDiaryCoverSettings(diaryCoverSettings);
                    results.diaryCoverSettings = true;
                    console.log('【WCDB迁移】日记封面设置迁移完成');
                }
            } catch (error) {
                console.error('【WCDB迁移】日记封面设置迁移失败:', error);
            }
            
            // 11. 迁移我的日记内容
            try {
                const myDiaryContents = await window.SQLiteManager.getMyDiaryContents();
                if (myDiaryContents && Object.keys(myDiaryContents).length > 0) {
                    await window.WCDBManager.saveMyDiaryContents(myDiaryContents);
                    results.myDiaryContents = true;
                    console.log('【WCDB迁移】我的日记内容迁移完成');
                }
            } catch (error) {
                console.error('【WCDB迁移】我的日记内容迁移失败:', error);
            }
            
            // 12. 迁移学习课桌数据
            try {
                const studyDeskData = await window.SQLiteManager.getStudyDeskData();
                if (studyDeskData && Object.keys(studyDeskData).length > 0) {
                    await window.WCDBManager.saveStudyDeskData(studyDeskData);
                    results.studyDeskData = true;
                    console.log('【WCDB迁移】学习课桌数据迁移完成');
                }
            } catch (error) {
                console.error('【WCDB迁移】学习课桌数据迁移失败:', error);
            }
            
            // 标记迁移完成
            await localforage.setItem('__wcdb_migration_completed', true);
            await localforage.setItem('__wcdb_migration_time', new Date().toISOString());
            await localforage.setItem('__wcdb_migration_results', results);
            
            console.log('【WCDB迁移】数据迁移完成:', results);
            
            return {
                success: true,
                message: '数据迁移完成',
                results: results
            };
            
        } catch (error) {
            console.error('【WCDB迁移】数据迁移失败:', error);
            return {
                success: false,
                message: '数据迁移失败: ' + error.message,
                error: error
            };
        } finally {
            this.isMigrating = false;
        }
    },
    
    /**
     * 获取迁移状态
     */
    async getMigrationStatus() {
        try {
            const completed = await localforage.getItem('__wcdb_migration_completed');
            const time = await localforage.getItem('__wcdb_migration_time');
            const results = await localforage.getItem('__wcdb_migration_results');
            
            return {
                completed: !!completed,
                time: time,
                results: results
            };
        } catch (error) {
            console.error('【WCDB迁移】获取迁移状态失败:', error);
            return {
                completed: false,
                time: null,
                results: null
            };
        }
    },
    
    /**
     * 重置迁移状态（用于测试或重新迁移）
     */
    async resetMigrationStatus() {
        try {
            await localforage.removeItem('__wcdb_migration_completed');
            await localforage.removeItem('__wcdb_migration_time');
            await localforage.removeItem('__wcdb_migration_results');
            console.log('【WCDB迁移】迁移状态已重置');
            return true;
        } catch (error) {
            console.error('【WCDB迁移】重置迁移状态失败:', error);
            return false;
        }
    }
};

// 导出到全局
window.WCDBMigration = WCDBMigration;
