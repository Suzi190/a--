// 角色头像管理器 - 健壮的头像保存和加载方案
class AvatarManager {
    constructor() {
        // 数据库配置
        this.DB_NAME = 'AvatarDB';
        this.DB_VERSION = 1;
        this.STORE_NAME = 'avatars';
        
        // 内存缓存
        this._cache = new Map();
        this._loadingPromises = new Map();
        
        // 默认头像
        this.DEFAULTS = {
            avatar1: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=cartoon%20avatar%20of%20a%20boy%2C%20cute%2C%20simple%20style&image_size=square',
            avatar2: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=cartoon%20avatar%20of%20a%20girl%2C%20cute%2C%20simple%20style&image_size=square'
        };
        
        // 初始化数据库
        this._dbPromise = this._initDB();
    }
    
    // 初始化 IndexedDB
    async _initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
            
            request.onerror = () => {
                console.error('[AvatarManager] 数据库打开失败:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                console.log('[AvatarManager] 数据库初始化成功');
                resolve(request.result);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    console.log('[AvatarManager] 创建对象存储:', this.STORE_NAME);
                }
            };
        });
    }
    
    // 获取数据库实例
    async _getDB() {
        if (!this._dbPromise) {
            this._dbPromise = this._initDB();
        }
        return this._dbPromise;
    }
    
    // 标准化头像ID
    _normalizeId(id) {
        // 支持 'avatar1', 'avatar2', 'main_avatar', 'couple_avatar1' 等格式
        if (id.startsWith('avatar')) {
            return id;
        }
        return `avatar_${id}`;
    }
    
    // 验证头像数据
    _validateAvatarData(data) {
        if (!data) {
            return { valid: false, error: '数据为空' };
        }
        
        if (typeof data === 'string') {
            // 检查是否是有效的 data URL 或 http URL
            if (data.startsWith('data:image/')) {
                return { valid: true, type: 'dataurl', data };
            }
            if (data.startsWith('http://') || data.startsWith('https://')) {
                return { valid: true, type: 'url', data };
            }
            return { valid: false, error: '无效的字符串格式' };
        }
        
        if (data instanceof Blob) {
            return { valid: true, type: 'blob', data };
        }
        
        if (data instanceof ArrayBuffer) {
            return { valid: true, type: 'arraybuffer', data };
        }
        
        return { valid: false, error: '未知的数据类型: ' + typeof data };
    }
    
    // 将数据转换为统一格式（data URL）
    async _normalizeToDataURL(data) {
        const validation = this._validateAvatarData(data);
        
        if (!validation.valid) {
            throw new Error(`数据验证失败: ${validation.error}`);
        }
        
        switch (validation.type) {
            case 'dataurl':
                return validation.data;
            case 'url':
                // 如果是网络URL，尝试获取并转换
                try {
                    const response = await fetch(validation.data);
                    const blob = await response.blob();
                    return this._blobToDataURL(blob);
                } catch (e) {
                    // 如果获取失败，返回原URL
                    return validation.data;
                }
            case 'blob':
                return this._blobToDataURL(validation.data);
            case 'arraybuffer':
                const blob = new Blob([validation.data]);
                return this._blobToDataURL(blob);
            default:
                throw new Error('不支持的数据类型');
        }
    }
    
    // Blob 转 Data URL
    _blobToDataURL(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
        });
    }
    
    // 保存头像
    async save(id, data) {
        const normalizedId = this._normalizeId(id);
        
        try {
            // 验证数据
            const validation = this._validateAvatarData(data);
            if (!validation.valid) {
                throw new Error(`数据验证失败: ${validation.error}`);
            }
            
            // 标准化为 data URL
            const normalizedData = await this._normalizeToDataURL(data);
            
            // 保存到 IndexedDB
            const db = await this._getDB();
            await this._saveToDB(db, normalizedId, normalizedData);
            
            // 更新内存缓存
            this._cache.set(normalizedId, {
                data: normalizedData,
                timestamp: Date.now(),
                source: 'indexeddb'
            });
            
            console.log(`[AvatarManager] 头像 ${normalizedId} 保存成功，数据长度: ${normalizedData.length}`);
            return { success: true, id: normalizedId };
            
        } catch (error) {
            console.error(`[AvatarManager] 保存头像 ${normalizedId} 失败:`, error);
            
            // 降级到内存缓存
            this._cache.set(normalizedId, {
                data: data,
                timestamp: Date.now(),
                source: 'memory_only'
            });
            
            return { success: false, id: normalizedId, error: error.message, fallback: 'memory' };
        }
    }
    
    // 保存到 IndexedDB
    _saveToDB(db, id, data) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);
            
            const request = store.put({
                id: id,
                data: data,
                timestamp: Date.now(),
                version: 1
            });
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    
    // 加载头像
    async load(id, options = {}) {
        const normalizedId = this._normalizeId(id);
        const { useCache = true, fallbackToDefault = true } = options;
        
        // 检查是否有正在进行的加载请求
        if (this._loadingPromises.has(normalizedId)) {
            return this._loadingPromises.get(normalizedId);
        }
        
        const loadPromise = this._doLoad(normalizedId, useCache, fallbackToDefault);
        this._loadingPromises.set(normalizedId, loadPromise);
        
        try {
            const result = await loadPromise;
            return result;
        } finally {
            this._loadingPromises.delete(normalizedId);
        }
    }
    
    // 实际加载逻辑
    async _doLoad(id, useCache, fallbackToDefault) {
        // 1. 检查内存缓存
        if (useCache && this._cache.has(id)) {
            const cached = this._cache.get(id);
            // 检查缓存是否过期（24小时）
            const isExpired = Date.now() - cached.timestamp > 24 * 60 * 60 * 1000;
            
            if (!isExpired || cached.source === 'memory_only') {
                console.log(`[AvatarManager] 头像 ${id} 从内存缓存加载`);
                return {
                    success: true,
                    data: cached.data,
                    source: 'cache',
                    id: id
                };
            }
        }
        
        // 2. 从 IndexedDB 加载
        try {
            const db = await this._getDB();
            const record = await this._loadFromDB(db, id);
            
            if (record && record.data) {
                // 验证数据
                const validation = this._validateAvatarData(record.data);
                
                if (validation.valid) {
                    // 更新缓存
                    this._cache.set(id, {
                        data: record.data,
                        timestamp: Date.now(),
                        source: 'indexeddb'
                    });
                    
                    console.log(`[AvatarManager] 头像 ${id} 从 IndexedDB 加载成功`);
                    return {
                        success: true,
                        data: record.data,
                        source: 'indexeddb',
                        id: id
                    };
                } else {
                    console.warn(`[AvatarManager] 头像 ${id} 数据无效: ${validation.error}`);
                }
            }
        } catch (error) {
            console.error(`[AvatarManager] 从 IndexedDB 加载头像 ${id} 失败:`, error);
        }
        
        // 3. 使用默认头像
        if (fallbackToDefault) {
            const defaultKey = id.includes('2') ? 'avatar2' : 'avatar1';
            const defaultData = this.DEFAULTS[defaultKey];
            
            console.log(`[AvatarManager] 头像 ${id} 使用默认头像`);
            return {
                success: true,
                data: defaultData,
                source: 'default',
                id: id
            };
        }
        
        return {
            success: false,
            data: null,
            source: 'none',
            id: id,
            error: '头像不存在'
        };
    }
    
    // 从 IndexedDB 加载
    _loadFromDB(db, id) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.STORE_NAME], 'readonly');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.get(id);
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            request.onerror = () => reject(request.error);
        });
    }
    
    // 批量加载头像
    async loadMultiple(ids) {
        const results = await Promise.all(
            ids.map(id => this.load(id).catch(err => ({
                success: false,
                id: id,
                error: err.message
            })))
        );
        
        const map = {};
        results.forEach(result => {
            map[result.id] = result;
        });
        
        return map;
    }
    
    // 删除头像
    async delete(id) {
        const normalizedId = this._normalizeId(id);
        
        try {
            const db = await this._getDB();
            await this._deleteFromDB(db, normalizedId);
            
            // 清除缓存
            this._cache.delete(normalizedId);
            
            console.log(`[AvatarManager] 头像 ${normalizedId} 已删除`);
            return { success: true, id: normalizedId };
        } catch (error) {
            console.error(`[AvatarManager] 删除头像 ${normalizedId} 失败:`, error);
            return { success: false, id: normalizedId, error: error.message };
        }
    }
    
    // 从 IndexedDB 删除
    _deleteFromDB(db, id) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.delete(id);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    
    // 清空所有头像
    async clearAll() {
        try {
            const db = await this._getDB();
            
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([this.STORE_NAME], 'readwrite');
                const store = transaction.objectStore(this.STORE_NAME);
                const request = store.clear();
                
                request.onsuccess = () => {
                    this._cache.clear();
                    console.log('[AvatarManager] 所有头像已清空');
                    resolve({ success: true });
                };
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('[AvatarManager] 清空头像失败:', error);
            return { success: false, error: error.message };
        }
    }
    
    // 获取所有头像列表
    async listAll() {
        try {
            const db = await this._getDB();
            
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([this.STORE_NAME], 'readonly');
                const store = transaction.objectStore(this.STORE_NAME);
                const request = store.getAllKeys();
                
                request.onsuccess = () => {
                    resolve(request.result);
                };
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('[AvatarManager] 获取头像列表失败:', error);
            return [];
        }
    }
    
    // 预加载头像到缓存
    async preload(ids) {
        console.log('[AvatarManager] 开始预加载头像:', ids);
        const results = await this.loadMultiple(ids);
        
        const successCount = Object.values(results).filter(r => r.success).length;
        console.log(`[AvatarManager] 预加载完成: ${successCount}/${ids.length}`);
        
        return results;
    }
    
    // 处理文件上传
    async handleFileUpload(file, id) {
        if (!file) {
            throw new Error('文件为空');
        }
        
        if (!file.type.startsWith('image/')) {
            throw new Error('只允许上传图片文件');
        }
        
        // 限制文件大小（5MB）
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            throw new Error('图片大小不能超过 5MB');
        }
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const data = e.target.result;
                    const result = await this.save(id, data);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('文件读取失败'));
            reader.readAsDataURL(file);
        });
    }
    
    // 更新DOM中的头像显示
    async updateDOM(id, elementSelector) {
        const result = await this.load(id);
        
        if (!result.success) {
            console.warn(`[AvatarManager] 无法更新DOM，头像 ${id} 加载失败`);
            return false;
        }
        
        const elements = document.querySelectorAll(elementSelector);
        elements.forEach(el => {
            if (el.tagName === 'IMG') {
                el.src = result.data;
            } else {
                el.style.backgroundImage = `url(${result.data})`;
            }
        });
        
        return elements.length > 0;
    }
    
    // 导出头像数据（用于备份）
    async exportData(id) {
        const result = await this.load(id, { fallbackToDefault: false });
        
        if (!result.success) {
            return null;
        }
        
        return {
            id: id,
            data: result.data,
            source: result.source,
            exportedAt: Date.now()
        };
    }
    
    // 导入头像数据（用于恢复）
    async importData(avatarData) {
        if (!avatarData || !avatarData.id || !avatarData.data) {
            throw new Error('无效的导入数据');
        }
        
        return await this.save(avatarData.id, avatarData.data);
    }
}

// 创建全局实例
window.avatarManager = new AvatarManager();

// 兼容性封装 - 保持与旧代码兼容
window.MainScreenAvatars = {
    KEYS: {
        AVATAR1: 'avatar1',
        AVATAR2: 'avatar2'
    },
    
    DEFAULTS: {
        AVATAR1: window.avatarManager.DEFAULTS.avatar1,
        AVATAR2: window.avatarManager.DEFAULTS.avatar2
    },
    
    _cache: {
        avatar1: null,
        avatar2: null
    },
    
    // 保存头像（兼容旧接口）
    async save(avatarType, data) {
        const id = avatarType === 'avatar1' ? 'avatar1' : 'avatar2';
        const result = await window.avatarManager.save(id, data);
        
        if (result.success) {
            this._cache[avatarType] = data;
        }
        
        return result.success;
    },
    
    // 加载头像（兼容旧接口）
    async load(avatarType) {
        const id = avatarType === 'avatar1' ? 'avatar1' : 'avatar2';
        const result = await window.avatarManager.load(id);
        
        if (result.success) {
            this._cache[avatarType] = result.data;
            return result.data;
        }
        
        return this.DEFAULTS[avatarType === 'avatar1' ? 'AVATAR1' : 'AVATAR2'];
    },
    
    // 加载所有头像（兼容旧接口）
    async loadAll() {
        console.log('[MainScreenAvatars] 开始加载所有头像...');
        
        // 首先尝试从新存储加载
        let results = await window.avatarManager.loadMultiple(['avatar1', 'avatar2']);
        
        console.log('[MainScreenAvatars] 加载结果:', {
            avatar1: { success: results.avatar1?.success, source: results.avatar1?.source },
            avatar2: { success: results.avatar2?.success, source: results.avatar2?.source }
        });
        
        // 如果新存储中没有数据，尝试从旧存储迁移
        const needMigrate = !results.avatar1?.success || !results.avatar2?.success ||
                           results.avatar1?.source === 'default' || results.avatar2?.source === 'default';
        
        if (needMigrate && window.migrateAvatarDataFromOldStorage) {
            console.log('[MainScreenAvatars] 新存储中没有头像数据，尝试从旧存储迁移...');
            await window.migrateAvatarDataFromOldStorage();
            
            // 重新加载
            results = await window.avatarManager.loadMultiple(['avatar1', 'avatar2']);
            console.log('[MainScreenAvatars] 迁移后重新加载结果:', {
                avatar1: { success: results.avatar1?.success, source: results.avatar1?.source },
                avatar2: { success: results.avatar2?.success, source: results.avatar2?.source }
            });
        }
        
        this._cache.avatar1 = results.avatar1?.data || this.DEFAULTS.AVATAR1;
        this._cache.avatar2 = results.avatar2?.data || this.DEFAULTS.AVATAR2;
        
        console.log('[MainScreenAvatars] 缓存已更新:', {
            avatar1: this._cache.avatar1 ? (this._cache.avatar1.length > 50 ? this._cache.avatar1.substring(0, 50) + '...' : this._cache.avatar1) : 'null',
            avatar2: this._cache.avatar2 ? (this._cache.avatar2.length > 50 ? this._cache.avatar2.substring(0, 50) + '...' : this._cache.avatar2) : 'null'
        });
        
        // 同步到 relationshipData
        if (typeof relationshipData !== 'undefined') {
            relationshipData.avatar1 = this._cache.avatar1;
            relationshipData.avatar2 = this._cache.avatar2;
            console.log('[MainScreenAvatars] 已同步到 relationshipData');
        }
        
        // 【关键】加载完成后立即更新显示
        this.updateDisplay();
        
        return {
            avatar1: this._cache.avatar1,
            avatar2: this._cache.avatar2
        };
    },
    
    // 更新显示（兼容旧接口）
    updateDisplay() {
        const avatarElements = document.querySelectorAll('.avatar img');
        console.log('[MainScreenAvatars] 更新显示，找到头像元素:', avatarElements.length);
        
        if (avatarElements.length < 2) {
            console.warn('[MainScreenAvatars] 找不到足够的头像元素');
            return;
        }
        
        const avatar1 = this._cache.avatar1 || this.DEFAULTS.AVATAR1;
        const avatar2 = this._cache.avatar2 || this.DEFAULTS.AVATAR2;
        
        console.log('[MainScreenAvatars] 头像数据:', {
            avatar1: avatar1 ? (avatar1.length > 50 ? avatar1.substring(0, 50) + '...' : avatar1) : 'null',
            avatar2: avatar2 ? (avatar2.length > 50 ? avatar2.substring(0, 50) + '...' : avatar2) : 'null',
            avatar1Length: avatar1?.length,
            avatar2Length: avatar2?.length
        });
        
        avatarElements[0].src = avatar1;
        avatarElements[1].src = avatar2;
        
        console.log('[MainScreenAvatars] 显示已更新');
    },
    
    // 处理文件上传（兼容旧接口）
    async handleUpload(file, avatarType) {
        const id = avatarType === 'avatar1' ? 'avatar1' : 'avatar2';
        console.log(`[MainScreenAvatars] 开始上传 ${avatarType}...`);
        
        try {
            const result = await window.avatarManager.handleFileUpload(file, id);
            console.log(`[MainScreenAvatars] 上传结果:`, result);
            
            if (result.success) {
                // 重新加载以获取标准化后的数据
                const loadResult = await window.avatarManager.load(id);
                console.log(`[MainScreenAvatars] 加载结果:`, { success: loadResult.success, source: loadResult.source });
                
                this._cache[avatarType] = loadResult.data;
                
                // 同步到 relationshipData
                if (typeof relationshipData !== 'undefined') {
                    relationshipData[avatarType] = loadResult.data;
                    console.log(`[MainScreenAvatars] 已同步 ${avatarType} 到 relationshipData`);
                }
                
                this.updateDisplay();
                return true;
            } else {
                console.error(`[MainScreenAvatars] 上传 ${avatarType} 失败:`, result.error);
            }
        } catch (error) {
            console.error(`[MainScreenAvatars] 上传 ${avatarType} 失败:`, error);
        }
        
        return false;
    }
};

// 数据迁移 - 从旧存储迁移头像数据
async function migrateFromOldStorage() {
    try {
        console.log('[AvatarManager] 检查是否需要从旧存储迁移数据...');
        
        // 旧存储的键名
        const oldKeys = {
            avatar1: 'mainscreen_avatar_left_v2',
            avatar2: 'mainscreen_avatar_right_v2'
        };
        
        // 尝试打开旧的数据库 (images)
        const oldDB = await new Promise((resolve, reject) => {
            const request = indexedDB.open('ImageDB', 1);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            request.onupgradeneeded = () => resolve(null);
        }).catch(() => null);
        
        if (!oldDB) {
            console.log('[AvatarManager] 旧数据库不存在或无法打开，无需迁移');
            return;
        }
        
        // 检查是否需要迁移
        const currentAvatar1 = await window.avatarManager.load('avatar1', { fallbackToDefault: false });
        const currentAvatar2 = await window.avatarManager.load('avatar2', { fallbackToDefault: false });
        
        // 如果新存储中已有数据，跳过迁移
        if (currentAvatar1.success && currentAvatar1.source !== 'default' &&
            currentAvatar2.success && currentAvatar2.source !== 'default') {
            console.log('[AvatarManager] 新存储中已有数据，跳过迁移');
            oldDB.close();
            return;
        }
        
        // 从旧存储读取数据
        const migrateAvatar = async (avatarType, oldKey) => {
            try {
                const transaction = oldDB.transaction(['images'], 'readonly');
                const store = transaction.objectStore('images');
                const request = store.get(oldKey);
                
                const data = await new Promise((resolve, reject) => {
                    request.onsuccess = () => resolve(request.result?.data);
                    request.onerror = () => reject(request.error);
                });
                
                if (data) {
                    console.log(`[AvatarManager] 从旧存储迁移 ${avatarType}，数据长度:`, 
                        typeof data === 'string' ? data.length : 'unknown');
                    await window.avatarManager.save(avatarType, data);
                    return true;
                }
                return false;
            } catch (e) {
                console.error(`[AvatarManager] 迁移 ${avatarType} 失败:`, e);
                return false;
            }
        };
        
        // 迁移两个头像
        const results = await Promise.all([
            migrateAvatar('avatar1', oldKeys.avatar1),
            migrateAvatar('avatar2', oldKeys.avatar2)
        ]);
        
        if (results[0] || results[1]) {
            console.log('[AvatarManager] 数据迁移完成');
        } else {
            console.log('[AvatarManager] 旧存储中没有找到头像数据');
        }
        
        oldDB.close();
    } catch (error) {
        console.error('[AvatarManager] 数据迁移失败:', error);
    }
}

// 导出迁移函数，允许外部调用
window.migrateAvatarDataFromOldStorage = migrateFromOldStorage;

// 页面加载完成后执行迁移（如果数据还未迁移）
document.addEventListener('DOMContentLoaded', () => {
    // 延迟执行，确保其他初始化完成
    setTimeout(async () => {
        // 检查新存储中是否已有数据
        const avatar1 = await window.avatarManager.load('avatar1', { fallbackToDefault: false });
        const avatar2 = await window.avatarManager.load('avatar2', { fallbackToDefault: false });
        
        // 如果新存储中没有数据，尝试从旧存储迁移
        if (!avatar1.success || !avatar2.success) {
            console.log('[AvatarManager] 新存储中没有头像数据，尝试从旧存储迁移...');
            await migrateFromOldStorage();
            
            // 迁移完成后，如果 MainScreenAvatars 已经加载过数据，重新加载
            if (window.MainScreenAvatars && window.MainScreenAvatars._cache.avatar1) {
                console.log('[AvatarManager] 数据已迁移，重新加载头像...');
                await window.MainScreenAvatars.loadAll();
            }
        }
    }, 500);
});

console.log('[AvatarManager] 模块加载完成');
