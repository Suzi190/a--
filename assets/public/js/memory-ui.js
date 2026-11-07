/**
 * 记忆宫殿 3.0 UI - 角色独立记忆系统
 * 简约黑白磨砂 iOS 风格
 */

class MemoryUI {
    constructor() {
        this.currentView = 'today';
        this.selectedDate = new Date().toDateString();
        this.isInitialized = false;
        this.selectedMemoryType = 'daily';
        this.currentCharacterId = null;
        this.currentCharacterName = '';
    }
    
    init() {
        if (this.isInitialized) {
            console.log('【MemoryUI】已经初始化，跳过');
            return;
        }
        console.log('【MemoryUI】开始初始化...');
        this.createStyles();
        this.createHTML();
        this.bindEvents();
        this.isInitialized = true;
        console.log('【MemoryUI】初始化完成');
    }
    
    /**
     * 设置当前角色
     * @param {string} characterId - 角色ID
     * @param {string} characterName - 角色名称
     */
    setCurrentCharacter(characterId, characterName = '') {
        this.currentCharacterId = characterId;
        this.currentCharacterName = characterName || characterId;
        
        // 同步设置记忆系统的当前角色
        if (window.memorySystem) {
            window.memorySystem.setCurrentCharacter(characterId);
        }
        
        console.log('【MemoryUI】当前角色已设置:', characterId, characterName);
    }
    
    /**
     * 获取当前角色ID
     */
    getCurrentCharacterId() {
        // 优先使用 UI 中设置的，否则尝试从记忆系统获取
        return this.currentCharacterId || 
               (window.memorySystem ? window.memorySystem.getCurrentCharacterId() : null) ||
               (typeof window !== 'undefined' && window.currentChatId ? window.currentChatId : null);
    }
    
    createStyles() {
        const styles = `
            <style id="memory-ui-styles">
                /* 记忆系统主容器 - iOS 磨砂风格（白色版） */
                .memory-system-container {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: #f5f5f7;
                    z-index: 10000;
                    display: none;
                    flex-direction: column;
                    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
                    color: #1d1d1f;
                }
                
                .memory-system-container.active {
                    display: flex;
                }
                
                /* 顶部白色卡片 */
                .memory-top-card {
                    height: 30px;
                    background: #fff;
                    flex-shrink: 0;
                }
                
                /* 头部 - 磨砂玻璃效果（白色版） */
                .memory-header {
                    background: rgba(255, 255, 255, 0.85);
                    backdrop-filter: blur(20px) saturate(180%);
                    -webkit-backdrop-filter: blur(20px) saturate(180%);
                    border-bottom: 0.5px solid rgba(0, 0, 0, 0.08);
                    padding: 16px 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    position: relative;
                    z-index: 10;
                }
                
                .memory-header h1 {
                    margin: 0;
                    font-size: 18px;
                    font-weight: 600;
                    letter-spacing: -0.3px;
                    color: #1d1d1f;
                }
                
                .memory-character-name {
                    font-size: 12px;
                    color: rgba(0, 0, 0, 0.4);
                    margin-top: 2px;
                }
                
                .memory-close-btn {
                    background: rgba(0, 0, 0, 0.06);
                    border: none;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    font-size: 20px;
                    color: #1d1d1f;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                }
                
                .memory-close-btn:hover {
                    background: rgba(0, 0, 0, 0.1);
                }
                
                .memory-settings-btn {
                    background: rgba(0, 0, 0, 0.06);
                    border: none;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    font-size: 16px;
                    color: #1d1d1f;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                }
                
                .memory-settings-btn:hover {
                    background: rgba(0, 0, 0, 0.1);
                }
                
                /* 统计面板 - 简约卡片（白色版） */
                .memory-stats {
                    display: flex;
                    padding: 20px;
                    gap: 12px;
                    background: #f5f5f7;
                }
                
                .memory-stat-item {
                    flex: 1;
                    background: #fff;
                    border-radius: 16px;
                    padding: 16px;
                    text-align: center;
                    border: 0.5px solid rgba(0, 0, 0, 0.06);
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
                    transition: transform 0.2s ease;
                }
                
                .memory-stat-item:hover {
                    transform: scale(1.02);
                }
                
                .memory-stat-value {
                    font-size: 28px;
                    font-weight: 700;
                    color: #1d1d1f;
                    margin-bottom: 4px;
                    letter-spacing: -0.5px;
                }
                
                .memory-stat-label {
                    font-size: 11px;
                    color: rgba(0, 0, 0, 0.4);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                /* 聊天统计容器 */
                .chat-stats-container {
                    display: flex;
                    padding: 0 20px 16px;
                    gap: 12px;
                    background: #f5f5f7;
                }
                
                .chat-stat-card {
                    flex: 1;
                    background: #fff;
                    border-radius: 16px;
                    padding: 16px;
                    border: 0.5px solid rgba(0, 0, 0, 0.06);
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    position: relative;
                    overflow: hidden;
                    transition: transform 0.2s ease;
                }
                
                .chat-stat-card:hover {
                    transform: scale(1.02);
                }
                
                .chat-stat-card:last-child {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 8px;
                }
                
                .chat-stat-icon {
                    font-size: 24px;
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(0, 0, 0, 0.04);
                    border-radius: 12px;
                }
                
                .chat-stat-info {
                    flex: 1;
                }
                
                .chat-stat-value {
                    font-size: 24px;
                    font-weight: 700;
                    color: #1d1d1f;
                    letter-spacing: -0.5px;
                    line-height: 1.2;
                }
                
                .chat-stat-label {
                    font-size: 12px;
                    color: rgba(0, 0, 0, 0.4);
                    margin-top: 2px;
                }
                
                .chat-stat-progress {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 3px;
                    background: rgba(0, 0, 0, 0.06);
                }
                
                .chat-stat-progress-bar {
                    height: 100%;
                    background: #1d1d1f;
                    border-radius: 0 2px 2px 0;
                    transition: width 0.3s ease;
                }
                
                /* 操作按钮 */
                .memory-actions {
                    display: flex;
                    padding: 0 20px 16px;
                    gap: 12px;
                    background: #f5f5f7;
                }
                
                .memory-action-btn {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 12px 20px;
                    border-radius: 12px;
                    border: none;
                    background: #fff;
                    color: #1d1d1f;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
                    transition: all 0.2s ease;
                }
                
                .memory-action-btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
                }
                
                .memory-action-btn.primary {
                    background: #1d1d1f;
                    color: #fff;
                }
                
                .memory-action-btn.primary:hover {
                    background: #000;
                }
                
                .action-icon {
                    font-size: 16px;
                    font-weight: 700;
                }
                
                /* 记忆类型选择器 */
                .memory-type-selector {
                    display: flex;
                    gap: 12px;
                    margin-top: 12px;
                }
                
                .memory-type-btn {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 12px 16px;
                    border-radius: 10px;
                    border: 1px solid rgba(0, 0, 0, 0.1);
                    background: #fff;
                    color: #1d1d1f;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                
                .memory-type-btn:hover {
                    background: rgba(0, 0, 0, 0.04);
                }
                
                .memory-type-btn.active {
                    background: #1d1d1f;
                    color: #fff;
                    border-color: #1d1d1f;
                }
                
                .type-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: rgba(0, 0, 0, 0.3);
                }
                
                .type-dot.important {
                    background: #1d1d1f;
                }
                
                .memory-type-btn.active .type-dot.important {
                    background: #fff;
                }
                
                /* 记忆文本输入框 */
                .memory-textarea {
                    width: 100%;
                    min-height: 120px;
                    padding: 12px;
                    border-radius: 10px;
                    border: 1px solid rgba(0, 0, 0, 0.1);
                    background: #f5f5f7;
                    font-size: 15px;
                    line-height: 1.5;
                    resize: vertical;
                    outline: none;
                    margin-top: 8px;
                    font-family: inherit;
                }
                
                .memory-textarea:focus {
                    border-color: #1d1d1f;
                    background: #fff;
                }
                
                /* 导航 - iOS 分段控制器风格（白色版） */
                .memory-nav {
                    display: flex;
                    padding: 12px 20px;
                    gap: 8px;
                    background: #f5f5f7;
                    overflow-x: auto;
                    scrollbar-width: none;
                }
                
                .memory-nav::-webkit-scrollbar {
                    display: none;
                }
                
                .memory-nav-item {
                    padding: 10px 20px;
                    border-radius: 8px;
                    border: none;
                    background: rgba(0, 0, 0, 0.04);
                    color: rgba(0, 0, 0, 0.5);
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    white-space: nowrap;
                    transition: all 0.2s ease;
                    position: relative;
                }
                
                .memory-nav-item:hover {
                    background: rgba(0, 0, 0, 0.08);
                    color: rgba(0, 0, 0, 0.7);
                }
                
                .memory-nav-item.active {
                    background: #1d1d1f;
                    color: #fff;
                }
                
                .memory-nav-item .badge {
                    position: absolute;
                    top: -4px;
                    right: -4px;
                    background: #ff3b30;
                    color: #fff;
                    font-size: 10px;
                    font-weight: 600;
                    padding: 2px 6px;
                    border-radius: 10px;
                    min-width: 18px;
                }
                
                /* 内容区域（白色版） */
                .memory-content {
                    flex: 1;
                    overflow-y: auto;
                    -webkit-overflow-scrolling: touch;
                    padding: 0 20px 100px;
                    background: #f5f5f7;
                }
                
                /* 时间线容器（白色版） */
                .timeline-container {
                    max-width: 600px;
                    margin: 0 auto;
                }
                
                .timeline-date-header {
                    text-align: center;
                    padding: 24px 0;
                }
                
                .timeline-date-header h2 {
                    margin: 0;
                    font-size: 32px;
                    font-weight: 700;
                    color: #1d1d1f;
                    letter-spacing: -0.5px;
                }
                
                .timeline-date-header p {
                    margin: 8px 0 0 0;
                    font-size: 14px;
                    color: rgba(0, 0, 0, 0.4);
                }
                
                /* 时间线 - 简约风格（白色版） */
                .timeline {
                    position: relative;
                    padding-left: 32px;
                }
                
                .timeline::before {
                    content: '';
                    position: absolute;
                    left: 11px;
                    top: 0;
                    bottom: 0;
                    width: 1px;
                    background: rgba(0, 0, 0, 0.08);
                }
                
                .timeline-item {
                    position: relative;
                    margin-bottom: 20px;
                    animation: fadeIn 0.4s ease;
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                
                .timeline-dot {
                    position: absolute;
                    left: -26px;
                    top: 16px;
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background: rgba(0, 0, 0, 0.2);
                    border: 2px solid #f5f5f7;
                }
                
                .timeline-dot.important {
                    background: #1d1d1f;
                    box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.08);
                }
                
                .timeline-content {
                    background: #fff;
                    border-radius: 16px;
                    padding: 16px;
                    border: 0.5px solid rgba(0, 0, 0, 0.06);
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                
                .timeline-content:hover {
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
                    transform: translateY(-1px);
                }
                
                .timeline-time {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 8px;
                }
                
                .timeline-time-text {
                    font-size: 13px;
                    color: rgba(0, 0, 0, 0.4);
                    font-weight: 500;
                }
                
                .timeline-label {
                    font-size: 11px;
                    color: rgba(0, 0, 0, 0.4);
                    background: rgba(0, 0, 0, 0.04);
                    padding: 3px 8px;
                    border-radius: 6px;
                }
                
                .timeline-text {
                    font-size: 15px;
                    color: #1d1d1f;
                    line-height: 1.5;
                    font-weight: 400;
                }
                
                .timeline-type {
                    margin-top: 12px;
                    font-size: 11px;
                    color: rgba(0, 0, 0, 0.4);
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                
                .timeline-type-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: rgba(0, 0, 0, 0.2);
                }
                
                .timeline-type-dot.important {
                    background: #1d1d1f;
                }
                
                /* 记忆卡片网格（白色版） */
                .memory-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 16px;
                    max-width: 1200px;
                    margin: 0 auto;
                }
                
                .memory-card {
                    background: #fff;
                    border-radius: 16px;
                    padding: 16px;
                    border: 0.5px solid rgba(0, 0, 0, 0.06);
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                
                .memory-card:hover {
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
                    transform: translateY(-2px);
                }
                
                .memory-card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                }
                
                .memory-card-time {
                    font-size: 12px;
                    color: rgba(0, 0, 0, 0.4);
                }
                
                .memory-card-strength {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .strength-value {
                    font-size: 12px;
                    color: rgba(0, 0, 0, 0.5);
                    font-weight: 500;
                }
                
                .strength-bar {
                    width: 40px;
                    height: 3px;
                    background: rgba(0, 0, 0, 0.08);
                    border-radius: 2px;
                    overflow: hidden;
                }
                
                .strength-fill {
                    height: 100%;
                    background: linear-gradient(90deg, rgba(0,0,0,0.4), #1d1d1f);
                    border-radius: 2px;
                    transition: width 0.3s ease;
                }
                
                .memory-card-content {
                    font-size: 15px;
                    color: #1d1d1f;
                    line-height: 1.5;
                    margin-bottom: 12px;
                    display: -webkit-box;
                    -webkit-line-clamp: 3;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
                
                .memory-card-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .memory-card-summary {
                    font-size: 12px;
                    color: rgba(0, 0, 0, 0.4);
                }
                
                .memory-card-type {
                    font-size: 11px;
                    color: rgba(0, 0, 0, 0.5);
                    background: rgba(0, 0, 0, 0.04);
                    padding: 4px 10px;
                    border-radius: 6px;
                }
                
                /* 【新增】重要记忆卡片样式 */
                .memory-card.important {
                    border-color: rgba(0, 0, 0, 0.15);
                    background: linear-gradient(135deg, #fff 0%, #fafafa 100%);
                }
                
                .memory-card.important .memory-card-type {
                    background: #1d1d1f;
                    color: #fff;
                }
                
                /* 日期选择器（白色版） */
                .date-selector {
                    background: #fff;
                    border-radius: 16px;
                    padding: 16px;
                    margin-bottom: 20px;
                    border: 0.5px solid rgba(0, 0, 0, 0.06);
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
                }
                
                .date-selector-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 12px;
                }
                
                .date-selector-label {
                    font-size: 13px;
                    color: rgba(0, 0, 0, 0.5);
                    font-weight: 500;
                }
                
                .date-selector input[type="date"] {
                    background: rgba(0, 0, 0, 0.04);
                    border: 0.5px solid rgba(0, 0, 0, 0.08);
                    border-radius: 8px;
                    padding: 8px 12px;
                    font-size: 14px;
                    color: #1d1d1f;
                    outline: none;
                }
                
                .date-quick-links {
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                }
                
                .date-quick-link {
                    padding: 8px 16px;
                    border-radius: 8px;
                    border: none;
                    background: rgba(0, 0, 0, 0.04);
                    color: rgba(0, 0, 0, 0.5);
                    font-size: 13px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                
                .date-quick-link:hover,
                .date-quick-link.active {
                    background: #1d1d1f;
                    color: #fff;
                }
                
                /* 空状态（白色版） */
                .memory-empty {
                    text-align: center;
                    padding: 80px 20px;
                    color: rgba(0, 0, 0, 0.25);
                }
                
                .memory-empty-icon {
                    font-size: 48px;
                    margin-bottom: 16px;
                    opacity: 0.5;
                }
                
                .memory-empty h3 {
                    font-size: 18px;
                    margin-bottom: 8px;
                    font-weight: 600;
                    color: rgba(0, 0, 0, 0.5);
                }
                
                .memory-empty p {
                    font-size: 14px;
                    color: rgba(0, 0, 0, 0.3);
                }
                
                /* 迁移按钮 - 悬浮按钮（白色版） */
                .memory-migrate-btn {
                    position: fixed;
                    bottom: 24px;
                    right: 24px;
                    width: 56px;
                    height: 56px;
                    border-radius: 50%;
                    border: none;
                    background: #1d1d1f;
                    color: #fff;
                    font-size: 24px;
                    cursor: pointer;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 100;
                }
                
                .memory-migrate-btn:hover {
                    transform: scale(1.1);
                    box-shadow: 0 6px 30px rgba(0, 0, 0, 0.3);
                }
                
                .memory-migrate-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none;
                }
                
                /* 迁移弹窗（白色版） */
                .migrate-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(10px);
                    z-index: 10001;
                    display: none;
                    align-items: center;
                    justify-content: center;
                }
                
                .migrate-modal.active {
                    display: flex;
                }
                
                .migrate-modal-content {
                    background: #fff;
                    border-radius: 20px;
                    padding: 32px;
                    max-width: 360px;
                    width: 85%;
                    text-align: center;
                    border: 0.5px solid rgba(0, 0, 0, 0.06);
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
                    position: relative;
                    overflow: visible;
                }
                
                .migrate-modal h3 {
                    margin: 0 0 8px 0;
                    font-size: 20px;
                    font-weight: 600;
                    color: #1d1d1f;
                }
                
                .migrate-modal-subtitle {
                    font-size: 14px;
                    color: rgba(0, 0, 0, 0.5);
                    margin-bottom: 24px;
                }
                
                .migrate-progress {
                    margin: 24px 0;
                }
                
                .migrate-progress-bar {
                    height: 4px;
                    background: rgba(0, 0, 0, 0.08);
                    border-radius: 2px;
                    overflow: hidden;
                    margin-bottom: 12px;
                }
                
                .migrate-progress-fill {
                    height: 100%;
                    background: #1d1d1f;
                    border-radius: 2px;
                    transition: width 0.3s ease;
                }
                
                .migrate-progress-text {
                    font-size: 13px;
                    color: rgba(0, 0, 0, 0.5);
                }
                
                .migrate-stats {
                    display: flex;
                    justify-content: center;
                    gap: 40px;
                    margin-top: 24px;
                    padding-top: 24px;
                    border-top: 0.5px solid rgba(0, 0, 0, 0.08);
                }
                
                .migrate-stat {
                    text-align: center;
                }
                
                .migrate-stat-value {
                    font-size: 28px;
                    font-weight: 700;
                    color: #1d1d1f;
                }
                
                .migrate-stat-label {
                    font-size: 11px;
                    color: rgba(0, 0, 0, 0.4);
                    margin-top: 4px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                /* 设置弹窗样式 */
                .settings-modal-content {
                    text-align: left;
                    max-width: 400px;
                }
                
                .settings-section {
                    margin-bottom: 24px;
                    position: relative;
                }
                
                .settings-label {
                    font-size: 15px;
                    font-weight: 600;
                    color: #1d1d1f;
                    margin-bottom: 4px;
                }
                
                .settings-desc {
                    font-size: 13px;
                    color: rgba(0, 0, 0, 0.4);
                    margin-bottom: 12px;
                }
                
                .settings-input-group {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    margin-top: 12px;
                    min-height: 40px;
                    position: relative;
                }
                
                .settings-slider {
                    flex: 1;
                    height: 8px;
                    -webkit-appearance: none;
                    appearance: none;
                    background: rgba(0, 0, 0, 0.15);
                    border-radius: 4px;
                    outline: none;
                    cursor: pointer;
                    display: inline-block;
                    width: 100%;
                    min-width: 200px;
                    vertical-align: middle;
                    position: relative;
                }
                
                .settings-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 20px;
                    height: 20px;
                    background: #1d1d1f;
                    border-radius: 50%;
                    cursor: pointer;
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
                    margin-top: -6px;
                    border: 2px solid #fff;
                    position: relative;
                }
                
                .settings-slider::-webkit-slider-runnable-track {
                    height: 8px;
                    background: rgba(0, 0, 0, 0.15);
                    border-radius: 4px;
                }
                
                .settings-slider::-moz-range-thumb {
                    width: 20px;
                    height: 20px;
                    background: #1d1d1f;
                    border-radius: 50%;
                    cursor: pointer;
                    border: 2px solid #fff;
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
                }
                
                .settings-slider::-moz-range-track {
                    height: 8px;
                    background: rgba(0, 0, 0, 0.15);
                    border-radius: 4px;
                }
                
                /* IE/Edge 滑动条样式 */
                .settings-slider::-ms-thumb {
                    width: 20px;
                    height: 20px;
                    background: #1d1d1f;
                    border-radius: 50%;
                    cursor: pointer;
                    border: 2px solid #fff;
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
                }
                
                .settings-slider::-ms-track {
                    height: 8px;
                    background: rgba(0, 0, 0, 0.15);
                    border-radius: 4px;
                    border: none;
                    color: transparent;
                }
                
                .settings-slider::-ms-fill-lower {
                    background: #1d1d1f;
                    border-radius: 4px;
                }
                
                .settings-slider::-ms-fill-upper {
                    background: rgba(0, 0, 0, 0.15);
                    border-radius: 4px;
                }
                
                .settings-value {
                    font-size: 17px;
                    font-weight: 600;
                    color: #1d1d1f;
                    min-width: 30px;
                    text-align: right;
                    display: inline-block;
                    vertical-align: middle;
                }
                
                .settings-actions {
                    display: flex;
                    gap: 12px;
                    margin-top: 32px;
                    padding-top: 24px;
                    border-top: 0.5px solid rgba(0, 0, 0, 0.08);
                }
                
                .settings-btn {
                    flex: 1;
                    padding: 12px 20px;
                    border-radius: 10px;
                    border: none;
                    font-size: 15px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                
                .settings-btn-secondary {
                    background: rgba(0, 0, 0, 0.04);
                    color: #1d1d1f;
                }
                
                .settings-btn-secondary:hover {
                    background: rgba(0, 0, 0, 0.08);
                }
                
                .settings-btn-primary {
                    background: #1d1d1f;
                    color: #fff;
                }
                
                .settings-btn-primary:hover {
                    background: #000;
                }
                
                /* 【新增】时间卡片网格 */
                .memory-card-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
                    gap: 12px;
                    padding: 20px;
                    max-width: 600px;
                    margin: 0 auto;
                }
                
                /* 【新增】时间卡片样式 */
                .memory-time-card {
                    background: #fff;
                    border-radius: 16px;
                    padding: 20px 12px;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    border: 0.5px solid rgba(0, 0, 0, 0.06);
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 80px;
                }
                
                .memory-time-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
                }
                
                .memory-time-card.important {
                    border-color: rgba(0, 0, 0, 0.15);
                }
                
                .memory-time-card-inner {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                }
                
                .memory-time-text {
                    font-size: 20px;
                    font-weight: 600;
                    color: #1d1d1f;
                    letter-spacing: -0.5px;
                }
                
                .memory-time-label {
                    font-size: 11px;
                    color: rgba(0, 0, 0, 0.4);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                .memory-time-card-dot {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: rgba(0, 0, 0, 0.2);
                }
                
                .memory-time-card-dot.important {
                    background: #1d1d1f;
                }
                
                /* 【新增】记忆详情弹窗 */
                .memory-detail-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(10px);
                    z-index: 10001;
                    display: none;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }
                
                .memory-detail-modal.active {
                    display: flex;
                }
                
                .memory-detail-content {
                    background: #fff;
                    border-radius: 20px;
                    padding: 24px;
                    max-width: 400px;
                    width: 100%;
                    max-height: 80vh;
                    overflow-y: auto;
                    border: 0.5px solid rgba(0, 0, 0, 0.06);
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
                }
                
                .memory-detail-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                    padding-bottom: 16px;
                    border-bottom: 0.5px solid rgba(0, 0, 0, 0.08);
                }
                
                .memory-detail-time {
                    font-size: 13px;
                    color: rgba(0, 0, 0, 0.5);
                }
                
                .memory-detail-type {
                    font-size: 11px;
                    color: rgba(0, 0, 0, 0.5);
                    background: rgba(0, 0, 0, 0.04);
                    padding: 4px 10px;
                    border-radius: 6px;
                }
                
                .memory-detail-type.important {
                    background: #1d1d1f;
                    color: #fff;
                }
                
                .memory-detail-summary {
                    font-size: 15px;
                    font-weight: 600;
                    color: #1d1d1f;
                    margin-bottom: 12px;
                    line-height: 1.4;
                }
                
                .memory-detail-body {
                    font-size: 14px;
                    color: rgba(0, 0, 0, 0.7);
                    line-height: 1.6;
                    white-space: pre-wrap;
                }
                
                .memory-detail-close {
                    background: rgba(0, 0, 0, 0.06);
                    border: none;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    font-size: 18px;
                    color: #1d1d1f;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                }
                
                .memory-detail-close:hover {
                    background: rgba(0, 0, 0, 0.1);
                }
            </style>
        `;
        
        if (!document.getElementById('memory-ui-styles')) {
            document.head.insertAdjacentHTML('beforeend', styles);
            console.log('【MemoryUI】样式已创建');
        } else {
            console.log('【MemoryUI】样式已存在，跳过');
        }
    }
    
    createHTML() {
        const html = `
            <div id="memorySystemContainer" class="memory-system-container">
                <div class="memory-top-card"></div>
                <div class="memory-header">
                    <div>
                        <h1>记忆</h1>
                        <div class="memory-character-name" id="memoryCharacterName">当前角色</div>
                    </div>
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <button class="memory-settings-btn" onclick="memoryUI.showSettingsModal()" title="设置">
                            ⚙
                        </button>
                        <button class="memory-close-btn" onclick="memoryUI.close()">×</button>
                    </div>
                </div>
                
                <div class="memory-stats">
                    <div class="memory-stat-item">
                        <div class="memory-stat-value" id="statImportant">0</div>
                        <div class="memory-stat-label">重要</div>
                    </div>
                    <div class="memory-stat-item">
                        <div class="memory-stat-value" id="statDaily">0</div>
                        <div class="memory-stat-label">日常</div>
                    </div>
                    <div class="memory-stat-item">
                        <div class="memory-stat-value" id="statToday">0</div>
                        <div class="memory-stat-label">今日</div>
                    </div>
                    <div class="memory-stat-item">
                        <div class="memory-stat-value" id="statTotal">0</div>
                        <div class="memory-stat-label">总计</div>
                    </div>
                </div>
                
                <!-- 聊天统计信息和操作按钮 -->
                <div class="chat-stats-container">
                    <div class="chat-stat-card">
                        <div class="chat-stat-info">
                            <div class="chat-stat-value" id="chatStatTotal">0</div>
                            <div class="chat-stat-label">总聊天句数</div>
                        </div>
                    </div>
                    <div class="chat-stat-card">
                        <div class="chat-stat-info">
                            <div class="chat-stat-value" id="chatStatRemaining">0</div>
                            <div class="chat-stat-label">距离下次总结</div>
                        </div>
                        <div class="chat-stat-progress">
                            <div class="chat-stat-progress-bar" id="chatStatProgressBar"></div>
                        </div>
                    </div>
                </div>
                
                <!-- 操作按钮 -->
                <div class="memory-actions">
                    <button class="memory-action-btn" onclick="memoryUI.showAddMemoryModal()">
                        <span class="action-icon">+</span>
                        <span class="action-text">加入记忆</span>
                    </button>
                    <button class="memory-action-btn primary" onclick="memoryUI.triggerImmediateSummary()">
                        <span class="action-icon">✓</span>
                        <span class="action-text">立即总结</span>
                    </button>
                </div>
                
                <div class="memory-nav">
                    <button class="memory-nav-item active" data-view="today">今日</button>
                    <button class="memory-nav-item" data-view="important">
                        重要
                        <span class="badge" id="badgeImportant" style="display:none">0</span>
                    </button>
                    <button class="memory-nav-item" data-view="daily">
                        日常
                        <span class="badge" id="badgeDaily" style="display:none">0</span>
                    </button>
                    <button class="memory-nav-item" data-view="history">历史</button>
                </div>
                
                <div class="memory-content" id="memoryContent"></div>
                
                <button class="memory-migrate-btn" id="migrateBtn" onclick="memoryUI.triggerBatchSummary()" title="批量总结记忆">
                    ↻
                </button>
            </div>
            
            <div id="migrateModal" class="migrate-modal">
                <div class="migrate-modal-content">
                    <h3>导入记忆备份</h3>
                    <p class="migrate-modal-subtitle">选择备份文件导入记忆</p>
                    <input type="file" id="importFileInput" accept=".json" style="display:none" onchange="memoryUI.handleImportFile(event)">
                    <button class="memory-action-btn" onclick="document.getElementById('importFileInput').click()" style="margin: 16px 0; width: 100%;">
                        <span class="action-icon">📁</span>
                        <span class="action-text">选择备份文件</span>
                    </button>
                    <p class="migrate-modal-subtitle" id="importStatus" style="display:none;"></p>
                    
                    <div class="migrate-progress">
                        <div class="migrate-progress-bar">
                            <div class="migrate-progress-fill" id="migrateProgressFill" style="width: 0%"></div>
                        </div>
                        <div class="migrate-progress-text" id="migrateProgressText">准备中...</div>
                    </div>
                    
                    <div class="migrate-stats">
                        <div class="migrate-stat">
                            <div class="migrate-stat-value" id="migrateImportant">0</div>
                            <div class="migrate-stat-label">重要</div>
                        </div>
                        <div class="migrate-stat">
                            <div class="migrate-stat-value" id="migrateDaily">0</div>
                            <div class="migrate-stat-label">日常</div>
                        </div>
                        <div class="migrate-stat">
                            <div class="migrate-stat-value" id="migrateFailed">0</div>
                            <div class="migrate-stat-label">失败</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 设置弹窗 -->
            <div id="settingsModal" class="migrate-modal">
                <div class="migrate-modal-content settings-modal-content">
                    <h3>记忆设置</h3>
                    
                    <div class="settings-section">
                        <div class="settings-label">AI 挂载记忆数量</div>
                        <div class="settings-desc">每次对话挂载多少条记忆给 AI</div>
                        <div class="settings-input-group">
                            <input type="range" id="mountCountSlider" min="3" max="20" value="10" class="settings-slider">
                            <span class="settings-value" id="mountCountValue">10</span>
                        </div>
                    </div>
                    
                    <div class="settings-section">
                        <div class="settings-label">自动总结频率</div>
                        <div class="settings-desc">多少条消息后自动总结记忆</div>
                        <div class="settings-input-group">
                            <input type="range" id="summaryFreqSlider" min="5" max="100" value="20" class="settings-slider">
                            <span class="settings-value" id="summaryFreqValue">20</span>
                        </div>
                    </div>
                    
                    <div class="settings-actions">
                        <button class="settings-btn settings-btn-secondary" onclick="memoryUI.hideSettingsModal()">取消</button>
                        <button class="settings-btn settings-btn-primary" onclick="memoryUI.saveSettings()">保存</button>
                    </div>
                </div>
            </div>
            
            <!-- 加入记忆弹窗 -->
            <div id="addMemoryModal" class="migrate-modal">
                <div class="migrate-modal-content settings-modal-content">
                    <h3>加入记忆</h3>
                    
                    <div class="settings-section">
                        <div class="settings-label">记忆内容</div>
                        <div class="settings-desc">输入要保存的记忆内容</div>
                        <textarea id="addMemoryContent" class="memory-textarea" placeholder="输入记忆内容..."></textarea>
                    </div>
                    
                    <div class="settings-section">
                        <div class="settings-label">记忆类型</div>
                        <div class="settings-desc">选择记忆的分类</div>
                        <div class="memory-type-selector">
                            <button class="memory-type-btn" data-type="important" onclick="memoryUI.selectMemoryType('important')">
                                <span class="type-dot important"></span>
                                <span>重要记忆</span>
                            </button>
                            <button class="memory-type-btn active" data-type="daily" onclick="memoryUI.selectMemoryType('daily')">
                                <span class="type-dot daily"></span>
                                <span>日常记忆</span>
                            </button>
                        </div>
                    </div>
                    
                    <div class="settings-actions">
                        <button class="settings-btn settings-btn-secondary" onclick="memoryUI.hideAddMemoryModal()">取消</button>
                        <button class="settings-btn settings-btn-primary" onclick="memoryUI.saveNewMemory()">保存</button>
                    </div>
                </div>
            </div>
            
            <!-- 【新增】记忆详情弹窗 -->
            <div id="memoryDetailModal" class="memory-detail-modal" onclick="memoryUI.hideMemoryDetail(event)">
                <div class="memory-detail-content" onclick="event.stopPropagation()">
                    <div class="memory-detail-header">
                        <div>
                            <div class="memory-detail-time" id="detailTime"></div>
                            <span class="memory-detail-type" id="detailType"></span>
                        </div>
                        <button class="memory-detail-close" onclick="memoryUI.closeMemoryDetail()">×</button>
                    </div>
                    <div class="memory-detail-summary" id="detailSummary"></div>
                    <div class="memory-detail-body" id="detailContent"></div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', html);
        console.log('【MemoryUI】HTML已创建');
    }
    
    bindEvents() {
        document.querySelectorAll('.memory-nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.switchView(view);
            });
        });
        
        // 绑定设置弹窗事件
        const settingsBtn = document.querySelector('.memory-settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('【MemoryUI】设置按钮被点击');
                this.showSettingsModal();
            });
        }
        
        // 绑定保存按钮事件
        const saveBtn = document.querySelector('.settings-btn-primary');
        if (saveBtn) {
            saveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('【MemoryUI】保存按钮被点击');
                this.saveSettings();
            });
        }
        
        // 绑定取消按钮事件
        const cancelBtn = document.querySelector('.settings-btn-secondary');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('【MemoryUI】取消按钮被点击');
                this.hideSettingsModal();
            });
        }
        
        console.log('【MemoryUI】事件已绑定');
    }
    
    open(characterId = null, characterName = '') {
        console.log('【MemoryUI】打开记忆宫殿...');
        
        // 设置当前角色
        const targetId = characterId || this.getCurrentCharacterId();
        if (targetId) {
            this.setCurrentCharacter(targetId, characterName);
        }
        
        // 更新角色名称显示
        const nameEl = document.getElementById('memoryCharacterName');
        if (nameEl) {
            const name = characterName || this.currentCharacterName || targetId || '未选择角色';
            nameEl.textContent = name === '未选择角色' ? '请先选择一个聊天' : `与 ${name} 的记忆`;
        }
        
        this.init();
        
        const container = document.getElementById('memorySystemContainer');
        if (!container) {
            console.error('【MemoryUI】找不到 memorySystemContainer 元素');
            return;
        }
        
        container.classList.add('active');
        this.updateStats();
        this.switchView('today');
        console.log('【MemoryUI】记忆宫殿已打开，角色:', targetId);
    }
    
    close() {
        document.getElementById('memorySystemContainer').classList.remove('active');
    }
    
    switchView(view) {
        this.currentView = view;
        
        document.querySelectorAll('.memory-nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === view);
        });
        
        const content = document.getElementById('memoryContent');
        content.innerHTML = '';
        
        switch(view) {
            case 'today':
                this.renderTodayTimeline(content);
                break;
            case 'important':
                this.renderMemoryGrid(content, 'important');
                break;
            case 'daily':
                this.renderMemoryGrid(content, 'daily');
                break;
            case 'history':
                this.renderHistorySelector(content);
                break;
        }
    }
    
    renderTodayTimeline(container) {
        const characterId = this.getCurrentCharacterId();
        
        if (!characterId || !window.memorySystem) {
            container.innerHTML = `
                <div class="memory-empty">
                    <div class="memory-empty-icon">—</div>
                    <h3>请先选择角色</h3>
                    <p>选择一个聊天后查看记忆</p>
                </div>
            `;
            return;
        }
        
        const todayMemories = window.memorySystem.getTodayTimeline(characterId);

        if (todayMemories.length === 0) {
            container.innerHTML = `
                <div class="memory-empty">
                    <div class="memory-empty-icon">—</div>
                    <h3>暂无记忆</h3>
                    <p>去创造新的回忆</p>
                </div>
            `;
            return;
        }

        let html = '<div class="timeline-container">';

        const today = new Date();
        const dateStr = `${today.getMonth() + 1}月${today.getDate()}日`;

        html += `
            <div class="timeline-date-section" style="margin-bottom: 24px;">
                <div class="timeline-date-header">
                    <h2>${dateStr}</h2>
                    <p>今天 · ${todayMemories.length} 个记忆</p>
                </div>
                <div class="memory-card-grid">
        `;

        todayMemories.forEach((item, index) => {
            const time = new Date(item.timestamp);
            const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;

            html += `
                <div class="memory-time-card ${item.type}" style="animation: fadeIn 0.4s ease ${index * 0.05}s both" onclick="memoryUI.showMemoryDetail('${item.id}')">
                    <div class="memory-time-card-inner">
                        <span class="memory-time-text">${timeStr}</span>
                        <span class="memory-time-label">${item.timeLabel}</span>
                    </div>
                    <div class="memory-time-card-dot ${item.type}"></div>
                </div>
            `;
        });

        html += '</div></div>';
        html += '</div>';
        container.innerHTML = html;
    }
    
    renderMemoryGrid(container, type) {
        const characterId = this.getCurrentCharacterId();
        
        if (!characterId || !window.memorySystem) {
            container.innerHTML = `
                <div class="memory-empty">
                    <div class="memory-empty-icon">—</div>
                    <h3>请先选择角色</h3>
                    <p>选择一个聊天后查看记忆</p>
                </div>
            `;
            return;
        }
        
        const memories = window.memorySystem.getMemoriesByType(type, characterId);
        
        if (memories.length === 0) {
            container.innerHTML = `
                <div class="memory-empty">
                    <div class="memory-empty-icon">—</div>
                    <h3>暂无${type === 'important' ? '重要' : '日常'}记忆</h3>
                    <p>记忆会自动分类</p>
                </div>
            `;
            return;
        }
        
        let html = '<div class="memory-grid">';
        
        memories.forEach((memory, index) => {
            const strength = window.memorySystem.calculateStrength(memory.timestamp, type);
            const strengthPercent = Math.round(strength * 100);
            const time = new Date(memory.timestamp);
            const timeStr = `${time.getMonth() + 1}月${time.getDate()}日 ${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
            
            html += `
                <div class="memory-card ${type}" style="animation: fadeIn 0.4s ease ${index * 0.03}s both" onclick="memoryUI.showMemoryDetail('${memory.id}')">
                    <div class="memory-card-header">
                        <span class="memory-card-time">${timeStr}</span>
                        <div class="memory-card-strength">
                            <span class="strength-value">${strengthPercent}%</span>
                            <div class="strength-bar">
                                <div class="strength-fill" style="width: ${strengthPercent}%"></div>
                            </div>
                        </div>
                    </div>
                    <div class="memory-card-content">${memory.content}</div>
                    <div class="memory-card-footer">
                        <span class="memory-card-summary">${memory.summary}</span>
                        <span class="memory-card-type">${type === 'important' ? '重要' : '日常'}</span>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    }
    
    renderHistorySelector(container) {
        const characterId = this.getCurrentCharacterId();
        
        if (!characterId || !window.memorySystem) {
            container.innerHTML = `
                <div class="memory-empty">
                    <div class="memory-empty-icon">—</div>
                    <h3>请先选择角色</h3>
                    <p>选择一个聊天后查看记忆</p>
                </div>
            `;
            return;
        }
        
        const dates = window.memorySystem.getAvailableDates(characterId);
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        let html = `
            <div class="date-selector">
                <div class="date-selector-header">
                    <span class="date-selector-label">选择日期</span>
                    <input type="date" id="historyDatePicker" value="${todayStr}">
                </div>
                <div class="date-quick-links">
                    <button class="date-quick-link active" data-date="${todayStr}">今天</button>
                    <button class="date-quick-link" data-date="yesterday">昨天</button>
                    <button class="date-quick-link" data-date="last7">近7天</button>
                </div>
            </div>
            <div id="historyTimelineContainer"></div>
        `;

        container.innerHTML = html;

        const datePicker = document.getElementById('historyDatePicker');
        if (datePicker) {
            datePicker.addEventListener('change', (e) => {
                this.selectedDate = e.target.value;
                this.updateDateQuickLinks(this.selectedDate);
                this.renderHistoryTimeline(this.selectedDate);
            });
        }

        container.querySelectorAll('.date-quick-link').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dateType = e.target.dataset.date;
                if (dateType === 'yesterday') {
                    this.selectYesterday();
                } else if (dateType === 'last7') {
                    this.selectLast7Days();
                } else {
                    this.selectDate(dateType, e.target);
                }
            });
        });

        this.renderHistoryTimeline(todayStr);
    }

    updateDateQuickLinks(selectedDate) {
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

        document.querySelectorAll('.date-quick-link').forEach(link => {
            link.classList.remove('active');
            const dateType = link.dataset.date;
            if (dateType === selectedDate) {
                link.classList.add('active');
            } else if (dateType === 'yesterday' && selectedDate === yesterdayStr) {
                link.classList.add('active');
            }
        });
    }
    
    renderHistoryTimeline(dateString) {
        const container = document.getElementById('historyTimelineContainer');
        const characterId = this.getCurrentCharacterId();
        
        if (!characterId || !window.memorySystem) {
            container.innerHTML = `
                <div class="memory-empty">
                    <div class="memory-empty-icon">—</div>
                    <h3>请先选择角色</h3>
                </div>
            `;
            return;
        }
        
        const timeline = window.memorySystem.getTimelineByDate(dateString, characterId);
        
        if (timeline.length === 0) {
            container.innerHTML = `
                <div class="memory-empty">
                    <div class="memory-empty-icon">—</div>
                    <h3>该日无记录</h3>
                    <p>选择其他日期</p>
                </div>
            `;
            return;
        }
        
        const date = new Date(dateString);
        const dateStr = `${date.getMonth() + 1}月${date.getDate()}日`;
        const weekStr = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
        
        let html = `
            <div class="timeline-container">
                <div class="timeline-date-header">
                    <h2>${dateStr}</h2>
                    <p>${weekStr} · ${timeline.length} 个记忆</p>
                </div>
                <div class="timeline">
        `;
        
        timeline.forEach((item, index) => {
            const time = new Date(item.timestamp);
            const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
            
            html += `
                <div class="timeline-item" style="animation-delay: ${index * 0.05}s">
                    <div class="timeline-dot ${item.type}"></div>
                    <div class="timeline-content" onclick="memoryUI.showMemoryDetail('${item.id}')">
                        <div class="timeline-time">
                            <span class="timeline-time-text">${timeStr}</span>
                            <span class="timeline-label">${item.timeLabel}</span>
                        </div>
                        <div class="timeline-text">${item.summary}</div>
                        <div class="timeline-type">
                            <span class="timeline-type-dot ${item.type}"></span>
                            ${item.type === 'important' ? '重要记忆' : '日常记忆'}
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div></div>';
        container.innerHTML = html;
    }
    
    selectDate(dateString, targetBtn) {
        this.selectedDate = dateString;
        document.querySelectorAll('.date-quick-link').forEach(link => link.classList.remove('active'));
        if (targetBtn) {
            targetBtn.classList.add('active');
        }
        const datePicker = document.getElementById('historyDatePicker');
        if (datePicker) {
            datePicker.value = dateString;
        }
        this.renderHistoryTimeline(dateString);
    }

    selectYesterday() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
        document.getElementById('historyDatePicker').value = yesterdayStr;
        this.renderHistoryTimeline(yesterdayStr);
    }
    
    selectLast7Days() {
        const characterId = this.getCurrentCharacterId();
        if (!characterId || !window.memorySystem) return;
        
        const dates = window.memorySystem.getAvailableDates(characterId).slice(0, 7);
        if (dates.length > 0) {
            document.getElementById('historyDatePicker').value = new Date(dates[0]).toISOString().split('T')[0];
            this.renderHistoryTimeline(dates[0]);
        }
    }
    
    showMemoryDetail(memoryId) {
        const characterId = this.getCurrentCharacterId();
        if (!characterId || !window.memorySystem) return;
        
        const memory = window.memorySystem.findMemoryById(memoryId, characterId);
        if (!memory) return;
        console.log('查看记忆:', memory);
        
        const modal = document.getElementById('memoryDetailModal');
        const timeEl = document.getElementById('detailTime');
        const typeEl = document.getElementById('detailType');
        const summaryEl = document.getElementById('detailSummary');
        const contentEl = document.getElementById('detailContent');
        
        if (!modal || !timeEl || !typeEl || !summaryEl || !contentEl) return;
        
        const time = new Date(memory.timestamp);
        const timeStr = `${time.getFullYear()}年${time.getMonth() + 1}月${time.getDate()}日 ${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
        
        timeEl.textContent = timeStr;
        typeEl.textContent = memory.type === 'important' ? '重要记忆' : '日常记忆';
        typeEl.className = 'memory-detail-type ' + memory.type;
        summaryEl.textContent = memory.summary || '无摘要';
        contentEl.textContent = memory.content || '无详细内容';
        
        modal.classList.add('active');
    }
    
    hideMemoryDetail(event) {
        if (event.target.id === 'memoryDetailModal') {
            this.closeMemoryDetail();
        }
    }
    
    closeMemoryDetail() {
        const modal = document.getElementById('memoryDetailModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }
    
    updateStats() {
        const characterId = this.getCurrentCharacterId();
        
        if (!characterId || !window.memorySystem) {
            // 显示空状态
            document.getElementById('statImportant').textContent = '0';
            document.getElementById('statDaily').textContent = '0';
            document.getElementById('statToday').textContent = '0';
            document.getElementById('statTotal').textContent = '0';
            return;
        }
        
        const stats = window.memorySystem.getStats(characterId);
        
        document.getElementById('statImportant').textContent = stats.important.count;
        document.getElementById('statDaily').textContent = stats.daily.count;
        document.getElementById('statToday').textContent = stats.today;
        document.getElementById('statTotal').textContent = stats.totalMemories;
        
        const badgeImportant = document.getElementById('badgeImportant');
        const badgeDaily = document.getElementById('badgeDaily');
        
        if (stats.important.count > 0) {
            badgeImportant.textContent = stats.important.count;
            badgeImportant.style.display = 'block';
        } else {
            badgeImportant.style.display = 'none';
        }
        
        if (stats.daily.count > 0) {
            badgeDaily.textContent = stats.daily.count;
            badgeDaily.style.display = 'block';
        } else {
            badgeDaily.style.display = 'none';
        }
        
        this.updateChatStats();
    }
    
    updateChatStats() {
        const characterId = this.getCurrentCharacterId();
        
        if (!characterId || !window.memorySystem) {
            document.getElementById('chatStatTotal').textContent = '0';
            document.getElementById('chatStatRemaining').textContent = '0';
            document.getElementById('chatStatProgressBar').style.width = '0%';
            return;
        }
        
        const chatStats = window.memorySystem.getChatStats(characterId);
        
        const totalEl = document.getElementById('chatStatTotal');
        if (totalEl) {
            totalEl.textContent = chatStats.totalMessageCount.toLocaleString();
        }
        
        const remainingEl = document.getElementById('chatStatRemaining');
        if (remainingEl) {
            remainingEl.textContent = chatStats.remainingUntilSummary;
        }
        
        const progressBar = document.getElementById('chatStatProgressBar');
        if (progressBar) {
            progressBar.style.width = chatStats.progress + '%';
        }
    }
    
    showMigrateModal() {
        document.getElementById('migrateModal').classList.add('active');
        this.startMigration();
    }

    /**
     * 触发批量总结记忆
     */
    async triggerBatchSummary() {
        console.log('【记忆UI】触发批量总结...');

        const characterId = this.getCurrentCharacterId();
        if (!characterId) {
            this.showToast('请先选择一个聊天');
            return;
        }

        if (window.batchSummarizeAllMemories) {
            try {
                await window.batchSummarizeAllMemories();
            } catch (error) {
                console.error('批量总结失败:', error);
                this.showToast('批量总结失败: ' + error.message);
            }
        } else {
            console.error('batchSummarizeAllMemories 函数不可用');
            this.showToast('批量总结功能不可用，请刷新页面后重试');
        }
    }

    showImportModal() {
        document.getElementById('migrateModal').classList.add('active');
        const statusEl = document.getElementById('importStatus');
        if (statusEl) {
            statusEl.style.display = 'none';
            statusEl.textContent = '';
        }
        const progressContainer = document.querySelector('.migrate-progress');
        if (progressContainer) {
            progressContainer.style.display = 'none';
        }
        const statsContainer = document.querySelector('.migrate-stats');
        if (statsContainer) {
            statsContainer.style.display = 'none';
        }
    }
    
    async handleImportFile(event) {
        const characterId = this.getCurrentCharacterId();
        if (!characterId) {
            this.showToast('请先选择一个聊天');
            return;
        }
        
        const file = event.target.files[0];
        if (!file) return;
        
        const statusEl = document.getElementById('importStatus');
        statusEl.style.display = 'block';
        statusEl.textContent = '正在读取文件...';
        
        try {
            const content = await file.text();
            const backupData = JSON.parse(content);
            
            console.log('【导入备份】文件读取成功:', backupData);
            statusEl.textContent = '正在解析记忆数据...';
            
            const memories = this.extractMemoriesFromBackup(backupData);
            console.log('【导入备份】提取到记忆:', memories.length, '条');
            
            if (memories.length === 0) {
                statusEl.textContent = '未找到记忆数据';
                return;
            }
            
            statusEl.textContent = `找到 ${memories.length} 条记忆，准备导入...`;
            
            const progressContainer = document.querySelector('.migrate-progress');
            if (progressContainer) {
                progressContainer.style.display = 'block';
            }
            const statsContainer = document.querySelector('.migrate-stats');
            if (statsContainer) {
                statsContainer.style.display = 'flex';
            }
            
            await this.importMemories(memories);
            
        } catch (error) {
            console.error('【导入备份】失败:', error);
            statusEl.textContent = '导入失败: ' + error.message;
        }
    }
    
    extractMemoriesFromBackup(backupData) {
        const memories = [];
        
        if (backupData.wechatChatList && Array.isArray(backupData.wechatChatList)) {
            for (const chat of backupData.wechatChatList) {
                if (chat.memories && Array.isArray(chat.memories)) {
                    for (const memory of chat.memories) {
                        memories.push({
                            ...memory,
                            chatId: chat.id,
                            chatName: chat.name || chat.remark || '未知',
                            source: 'chat'
                        });
                    }
                }
                
                if (chat.longTermMemories && Array.isArray(chat.longTermMemories)) {
                    for (const memory of chat.longTermMemories) {
                        memories.push({
                            ...memory,
                            chatId: chat.id,
                            chatName: chat.name || '群聊',
                            source: 'group',
                            isGroup: true
                        });
                    }
                }
            }
        }
        
        if (backupData.memories && Array.isArray(backupData.memories)) {
            for (const memory of backupData.memories) {
                memories.push({
                    ...memory,
                    chatId: 'global',
                    chatName: '全局记忆',
                    source: 'global'
                });
            }
        }
        
        memories.sort((a, b) => {
            const timeA = a.timestamp || a.startTime || 0;
            const timeB = b.timestamp || b.startTime || 0;
            return timeA - timeB;
        });
        
        return memories;
    }
    
    async importMemories(memories) {
        const characterId = this.getCurrentCharacterId();
        
        const statusEl = document.getElementById('importStatus');
        const progressBar = document.querySelector('.migrate-progress-bar');
        const statImportant = document.getElementById('statImportant');
        const statDaily = document.getElementById('statDaily');
        const statFailed = document.getElementById('statFailed');
        
        let importantCount = 0;
        let dailyCount = 0;
        let failedCount = 0;
        
        const apiSettings = await this.getAPISettingsForImport();
        if (!apiSettings.apiKey) {
            throw new Error('请先配置 API 密钥');
        }
        
        for (let i = 0; i < memories.length; i++) {
            const memory = memories[i];
            const percent = Math.round((i / memories.length) * 100);
            if (progressBar) {
                progressBar.style.width = percent + '%';
            }
            statusEl.textContent = `正在导入 ${i + 1}/${memories.length}...`;
            
            try {
                const type = await this.classifyMemoryWithAI(memory, apiSettings);
                
                await window.memorySystem.addMemory({
                    id: memory.id?.toString() || Date.now().toString(),
                    content: memory.content || memory.summary || '',
                    summary: memory.summary || (memory.content ? memory.content.substring(0, 50) + '...' : ''),
                    timestamp: memory.timestamp || memory.startTime || Date.now(),
                    chatId: characterId,
                    source: memory.source || 'import'
                }, type, characterId);
                
                if (type === 'important') {
                    importantCount++;
                } else {
                    dailyCount++;
                }
                
                if (statImportant) statImportant.textContent = importantCount;
                if (statDaily) statDaily.textContent = dailyCount;
                
            } catch (error) {
                console.error('【导入备份】单条记忆导入失败:', error);
                failedCount++;
                if (statFailed) statFailed.textContent = failedCount;
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        statusEl.textContent = `导入完成！重要: ${importantCount}, 日常: ${dailyCount}, 失败: ${failedCount}`;
        
        this.updateStats();
        this.switchView(this.currentView);
        
        setTimeout(() => {
            this.hideMigrateModal();
        }, 2000);
    }
    
    async getAPISettingsForImport() {
        try {
            if (window.loadAppSettings) {
                const settings = await window.loadAppSettings({});
                const useSecondaryApi = settings.api?.secondary?.enabled && settings.api?.secondary?.apiKey;
                
                return {
                    apiKey: useSecondaryApi ? settings.api?.secondary?.apiKey : settings.api?.apiKey,
                    baseUrl: useSecondaryApi 
                        ? (settings.api?.secondary?.baseUrl || 'https://api.openai.com/v1')
                        : (settings.api?.baseUrl || 'https://api.openai.com/v1'),
                    model: useSecondaryApi
                        ? (settings.api?.secondary?.model || 'gpt-4o-mini')
                        : (settings.api?.model || 'gpt-4o')
                };
            }
        } catch (e) {
            console.error('【导入备份】获取API设置失败:', e);
        }
        return {};
    }
    
    async classifyMemoryWithAI(memory, apiSettings) {
        const content = memory.content || memory.summary || '';
        if (!content) return 'daily';
        
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
                            content: '你是一个记忆分类助手。请判断这段记忆是"重要"还是"日常"。重要记忆：关键事件、深层情感、重要决定、特殊时刻。日常记忆：普通对话、日常琐事、一般交流。只回答"重要"或"日常"。'
                        },
                        {
                            role: 'user',
                            content: `请分类这段记忆：\n\n${content.substring(0, 500)}`
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 10
                })
            });
            
            if (!response.ok) {
                throw new Error(`API请求失败: ${response.status}`);
            }
            
            const data = await response.json();
            const result = data.choices[0].message.content.trim();
            
            if (result.includes('重要')) {
                return 'important';
            }
            return 'daily';
            
        } catch (error) {
            console.error('【导入备份】AI分类失败:', error);
            return 'daily';
        }
    }
    
    hideMigrateModal() {
        document.getElementById('migrateModal').classList.remove('active');
    }
    
    async startMigration() {
        const btn = document.getElementById('migrateBtn');
        btn.disabled = true;
        
        try {
            await window.memoryMigrator.startMigration(
                (progress) => this.updateMigrateProgress(progress),
                (result) => this.onMigrateComplete(result)
            );
        } catch (error) {
            alert('迁移失败: ' + error.message);
            this.hideMigrateModal();
        } finally {
            btn.disabled = false;
        }
    }
    
    updateMigrateProgress(progress) {
        let percent = 0;
        let text = '';
        
        if (progress.stage === 'classifying') {
            percent = Math.round((progress.processed / progress.total) * 80);
            if (progress.totalBatches > 1) {
                text = `分类中 批次 ${progress.batchProgress || '1/1'} (${progress.processed}/${progress.total})`;
            } else {
                text = `分类中 ${progress.processed}/${progress.total}`;
            }
        } else if (progress.stage === 'waiting') {
            percent = Math.round((progress.processed / progress.total) * 80);
            text = progress.message || '等待中...';
        } else if (progress.stage === 'importing') {
            percent = 90;
            text = '导入中...';
        } else if (progress.stage === 'cleaning') {
            percent = 100;
            text = '清理中...';
        } else {
            percent = Math.round((progress.processed / progress.total) * 100);
            text = `${progress.processed}/${progress.total}`;
        }
        
        document.getElementById('migrateProgressFill').style.width = percent + '%';
        document.getElementById('migrateProgressText').textContent = text;
        
        document.getElementById('migrateImportant').textContent = progress.important || 0;
        document.getElementById('migrateDaily').textContent = progress.daily || 0;
        document.getElementById('migrateFailed').textContent = progress.failed || 0;
    }
    
    onMigrateComplete(result) {
        if (result.success) {
            setTimeout(() => {
                this.hideMigrateModal();
                this.updateStats();
                this.switchView(this.currentView);
            }, 800);
        } else {
            alert('迁移失败: ' + result.message);
            this.hideMigrateModal();
        }
    }
    
    // ==================== 设置功能 ====================
    
    showSettingsModal() {
        console.log('【记忆设置】打开设置弹窗...');
        
        const modal = document.getElementById('settingsModal');
        if (!modal) {
            console.error('【记忆设置】找不到设置弹窗');
            return;
        }
        
        if (!window.memorySystem) {
            console.error('【记忆设置】memorySystem 未初始化');
            return;
        }
        
        const mountCount = window.memorySystem.mountConfig.maxMemories;
        const summaryFreq = window.memorySystem.summaryConfig.messageThreshold;
        
        console.log('【记忆设置】当前配置:', { mountCount, summaryFreq });
        
        const mountSlider = document.getElementById('mountCountSlider');
        const mountValue = document.getElementById('mountCountValue');
        const freqSlider = document.getElementById('summaryFreqSlider');
        const freqValue = document.getElementById('summaryFreqValue');
        
        if (mountSlider) {
            mountSlider.value = mountCount;
            if (mountValue) mountValue.textContent = mountCount;
        }
        
        if (freqSlider) {
            freqSlider.value = summaryFreq;
            if (freqValue) freqValue.textContent = summaryFreq;
        }
        
        if (mountSlider) {
            mountSlider.oninput = (e) => {
                mountValue.textContent = e.target.value;
            };
        }
        if (freqSlider) {
            freqSlider.oninput = (e) => {
                freqValue.textContent = e.target.value;
            };
        }
        
        modal.classList.add('active');
    }
    
    hideSettingsModal() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }
    
    async saveSettings() {
        console.log('【记忆设置】开始保存设置...');
        
        const mountSlider = document.getElementById('mountCountSlider');
        const freqSlider = document.getElementById('summaryFreqSlider');
        
        if (!mountSlider || !freqSlider) {
            console.error('【记忆设置】找不到滑块元素');
            return;
        }
        
        const mountCount = parseInt(mountSlider.value);
        const summaryFreq = parseInt(freqSlider.value);
        
        try {
            await window.memorySystem.updateConfig(
                { maxMemories: mountCount },
                { messageThreshold: summaryFreq }
            );
            console.log('【记忆设置】配置更新成功');
        } catch (error) {
            console.error('【记忆设置】配置更新失败:', error);
            this.showToast('设置保存失败: ' + error.message);
            return;
        }
        
        this.updateChatStats();
        this.hideSettingsModal();
        this.showToast('设置已保存');
        console.log('【记忆设置】设置已保存并更新UI');
    }
    
    // ==================== 加入记忆功能 ====================
    
    showAddMemoryModal() {
        const characterId = this.getCurrentCharacterId();
        if (!characterId) {
            this.showToast('请先选择一个聊天');
            return;
        }
        
        const modal = document.getElementById('addMemoryModal');
        if (!modal) return;
        
        const contentInput = document.getElementById('addMemoryContent');
        if (contentInput) contentInput.value = '';
        
        this.selectedMemoryType = 'daily';
        document.querySelectorAll('.memory-type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === 'daily');
        });
        
        modal.classList.add('active');
    }
    
    hideAddMemoryModal() {
        const modal = document.getElementById('addMemoryModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }
    
    selectMemoryType(type) {
        this.selectedMemoryType = type;
        document.querySelectorAll('.memory-type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });
    }
    
    async saveNewMemory() {
        const characterId = this.getCurrentCharacterId();
        if (!characterId) {
            this.showToast('请先选择一个聊天');
            return;
        }
        
        const contentInput = document.getElementById('addMemoryContent');
        const content = contentInput ? contentInput.value.trim() : '';
        
        if (!content) {
            this.showToast('请输入记忆内容');
            return;
        }
        
        const type = this.selectedMemoryType || 'daily';
        
        try {
            const summary = content.length > 50 ? content.substring(0, 50) + '...' : content;
            
            await window.memorySystem.addMemory({
                content: content,
                summary: summary,
                timestamp: Date.now(),
                source: 'manual'
            }, type, characterId);
            
            this.hideAddMemoryModal();
            this.showToast('记忆已保存');
            
            this.updateStats();
            this.switchView(this.currentView);
            
        } catch (error) {
            console.error('保存记忆失败:', error);
            this.showToast('保存失败: ' + error.message);
        }
    }
    
    // ==================== 立即总结功能 ====================
    
    async triggerImmediateSummary() {
        console.log('【记忆系统】触发立即总结...');
        
        const characterId = this.getCurrentCharacterId();
        if (!characterId) {
            this.showToast('请先选择一个聊天');
            return;
        }
        
        const chatStats = window.memorySystem.getChatStats(characterId);
        if (chatStats.currentMessageCount === 0) {
            this.showToast('没有新消息需要总结');
            return;
        }
        
        this.showToast('正在总结记忆...');
        
        try {
            if (window.checkAndAutoSummarizeMemory) {
                await window.checkAndAutoSummarizeMemory();
                this.showToast('总结完成');
                this.updateChatStats();
            } else {
                this.showToast('总结功能不可用');
            }
        } catch (error) {
            console.error('立即总结失败:', error);
            this.showToast('总结失败: ' + error.message);
        }
    }
    
    showToast(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: #fff;
            padding: 12px 24px;
            border-radius: 20px;
            font-size: 14px;
            z-index: 10002;
            animation: fadeIn 0.3s ease;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 1500);
    }
}

console.log('【MemoryUI】开始初始化...');
window.memoryUI = new MemoryUI();
console.log('【MemoryUI】初始化完成');
