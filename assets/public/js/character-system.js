// PixiJS 角色系统 - 支持图层叠加和简单动画
class CharacterSystem {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.container = this.canvas.parentElement;
        
        // 初始化 PixiJS
        this.app = new PIXI.Application({
            view: this.canvas,
            width: this.container.clientWidth,
            height: this.container.clientHeight,
            backgroundAlpha: 0,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true
        });
        
        // 角色容器
        this.characterContainer = new PIXI.Container();
        this.app.stage.addChild(this.characterContainer);
        
        // 使用共享配置
        this.layerOrder = window.CharacterConfig.layerOrder;
        
        // 存储所有图层
        this.layers = {};
        
        // 动画状态
        this.animationState = {
            blinkTimer: 0,
            isBlinking: false,
            breathScale: 1,
            breathTimer: 0
        };
        
        // 绑定事件
        this.bindEvents();
        
        // 加载角色
        this.loadCharacter();
    }
    
    bindEvents() {
        // 窗口大小改变
        window.addEventListener('resize', () => {
            this.app.renderer.resize(
                this.container.clientWidth,
                this.container.clientHeight
            );
            this.centerCharacter();
        });
        
        // 鼠标移动 - 暂时禁用眼睛跟随（太奇怪了哈哈）
        // this.canvas.addEventListener('mousemove', (e) => {
        //     const rect = this.canvas.getBoundingClientRect();
        //     const x = e.clientX - rect.left;
        //     const y = e.clientY - rect.top;
        //     this.updateEyeTracking(x, y);
        // });
        
        // 点击互动
        this.canvas.addEventListener('click', () => {
            this.onClick();
        });
    }
    
    async loadCharacter() {
        try {
            console.log('开始加载角色...');
            
            // 读取保存的配置（优先使用 IndexedDB）
            let config = null;
            try {
                config = await window.characterDB.loadConfig();
                console.log('从 IndexedDB 读取的配置:', config);
            } catch (error) {
                console.log('IndexedDB 读取失败，尝试 localStorage');
                const savedConfig = localStorage.getItem('characterConfig');
                config = savedConfig ? JSON.parse(savedConfig) : null;
            }
            
            // 如果有保存的配置，按配置的顺序加载
            const layerOrder = config ? 
                config.sort((a, b) => a.order - b.order).map(c => c.name) : 
                this.layerOrder;
            console.log('图层顺序:', layerOrder);
            
            // 加载所有图层
            for (const layerName of layerOrder) {
                const texture = await this.loadTexture(`assets/character/${layerName}`);
                const sprite = new PIXI.Sprite(texture);
                sprite.name = layerName;
                
                // 设置锚点为中心
                sprite.anchor.set(0.5);
                
                // 查找保存的配置
                const layerConfig = config ? config.find(c => c.name === layerName) : null;
                
                if (layerConfig) {
                    // 使用保存的配置
                    // 注意：layerConfig.x 是相对偏移，需要加上屏幕中心
                    sprite.x = this.app.screen.width / 2 + (layerConfig.x || 0);
                    sprite.y = this.app.screen.height / 2 + 50 + (layerConfig.y || 0);
                    sprite.scale.set(layerConfig.scale || 1);
                    sprite.rotation = layerConfig.rotation || 0;
                    sprite.visible = layerConfig.visible !== false; // 默认true
                } else {
                    // 使用默认配置
                    sprite.x = this.app.screen.width / 2;
                    sprite.y = this.app.screen.height / 2 + 50;
                    const screenMin = Math.min(this.app.screen.width, this.app.screen.height);
                    const textureMin = Math.min(texture.width, texture.height);
                    const scale = (screenMin / textureMin) * 1.05;
                    sprite.scale.set(scale);
                }
                
                // 保存引用
                this.layers[layerName] = sprite;
                this.characterContainer.addChild(sprite);
                
                console.log(`✓ 加载: ${layerName}`);
            }
            
            console.log('角色加载完成！');
            
            // 开始动画循环
            this.startAnimation();
            
        } catch (error) {
            console.error('加载角色失败:', error);
        }
    }
    
    loadTexture(url) {
        return new Promise((resolve, reject) => {
            const texture = PIXI.Texture.from(url);
            if (texture.baseTexture.valid) {
                resolve(texture);
            } else {
                texture.baseTexture.on('loaded', () => resolve(texture));
                texture.baseTexture.on('error', reject);
            }
        });
    }
    
    centerCharacter() {
        // 重新居中所有图层（上移40px，现在是+50）
        for (const layerName in this.layers) {
            const sprite = this.layers[layerName];
            sprite.x = this.app.screen.width / 2;
            sprite.y = this.app.screen.height / 2 + 50;
        }
    }
    
    updateEyeTracking(mouseX, mouseY) {
        // 计算眼睛看向鼠标的方向
        const centerX = this.app.screen.width / 2;
        const centerY = this.app.screen.height / 2;
        
        const dx = mouseX - centerX;
        const dy = mouseY - centerY;
        
        // 限制移动范围
        const maxOffset = 10;
        const angle = Math.atan2(dy, dx);
        const distance = Math.min(maxOffset, Math.sqrt(dx * dx + dy * dy) / 20);
        
        const offsetX = Math.cos(angle) * distance;
        const offsetY = Math.sin(angle) * distance;
        
        // 移动眼珠
        if (this.layers['眼珠子.png']) {
            const baseX = this.app.screen.width / 2;
            const baseY = this.app.screen.height / 2;
            this.layers['眼珠子.png'].x = baseX + offsetX;
            this.layers['眼珠子.png'].y = baseY + offsetY;
        }
    }
    
    onClick() {
        // 点击效果 - 缩放一下
        for (const layerName in this.layers) {
            const sprite = this.layers[layerName];
            const originalScale = sprite.scale.x;
            
            // 缩小
            sprite.scale.set(originalScale * 0.95);
            
            // 恢复
            setTimeout(() => {
                sprite.scale.set(originalScale);
            }, 150);
        }
        
        // 点击互动效果（去掉toast提示）
    }
    
    startAnimation() {
        this.app.ticker.add(() => {
            this.updateBlink();
            this.updateBreath();
            this.updateHairSway();
        });
    }
    
    updateBlink() {
        // 暂时禁用眨眼，先做头发飘动
    }
    
    updateHairSway() {
        // 头发飘动动画 - 简化版（整体轻微摆动）
        this.animationState.hairTimer = (this.animationState.breathTimer || 0) * 0.5;
        
        // 基础位置
        const baseY = this.app.screen.height / 2 + 50;
        const breathOffset = Math.sin(this.animationState.breathTimer) * 2;
        
        // 所有头发图层一起轻微摆动（幅度很小，像微风吹拂）
        const hairLayers = [
            '后面发片.png',
            '发型阴影.png', 
            '左边发片.png',
            '右边发片.png'
        ];
        
        // 计算一个统一的轻微摆动
        const swayOffset = Math.sin(this.animationState.hairTimer) * 1.5;
        
        for (const layerName of hairLayers) {
            if (this.layers[layerName]) {
                // 只轻微移动Y轴（模拟头发整体轻微飘动）
                this.layers[layerName].y = baseY + breathOffset * 0.6 + swayOffset;
                // X轴几乎不动（避免发根移动的感觉）
                this.layers[layerName].x = this.app.screen.width / 2 + swayOffset * 0.2;
                // 极轻微的旋转
                this.layers[layerName].rotation = swayOffset * 0.005;
            }
        }
    }
    
    updateBreath() {
        // 更缓慢的呼吸
        this.animationState.breathTimer += 0.03;
        
        // 呼吸起伏 - 胸部带动上半身
        const breathOffset = Math.sin(this.animationState.breathTimer) * 2;
        
        // 第1组：躯干、浴巾（呼吸的核心，起伏最大）
        const torsoLayers = ['躯干.png', '浴巾.png'];
        for (const layerName of torsoLayers) {
            if (this.layers[layerName]) {
                this.layers[layerName].y = (this.app.screen.height / 2 + 50) + breathOffset;
            }
        }
        
        // 第2组：脖子（跟随躯干）
        if (this.layers['脖子.png']) {
            this.layers['脖子.png'].y = (this.app.screen.height / 2 + 50) + breathOffset * 0.8;
        }
        
        // 第3组：头部所有图层（脸、头发、五官）
        const headLayers = [
            '耳朵底色.png', '耳朵.png', '脸皮.png', '脸红.png',
            '眉毛.png', '图层21.png', '眼白.png', '眼珠子.png',
            '双眼皮.png', '上眼皮.png', '上眼眶.png', '下眼眶.png',
            '上睫毛.png', '下睫毛.png', '下眼睑阴影.png',
            '嘴唇整体.png', '嘴唇线.png', '唇勾.png',
            '嘴唇阴影.png', '下嘴唇阴影.png',
            '鼻孔.png', '鼻头阴影.png', '鼻子阴影.png',
            '发型阴影.png', '后面发片.png', '右边发片.png', '左边发片.png'
        ];
        for (const layerName of headLayers) {
            if (this.layers[layerName]) {
                this.layers[layerName].y = (this.app.screen.height / 2 + 50) + breathOffset * 0.6;
            }
        }
        
        // 第4组：手臂（轻微跟随）
        if (this.layers['手臂.png']) {
            this.layers['手臂.png'].y = (this.app.screen.height / 2 + 50) + breathOffset * 0.3;
        }
        
        // 第5组：大腿（几乎不动）
        if (this.layers['大腿.png']) {
            this.layers['大腿.png'].y = (this.app.screen.height / 2 + 50) + breathOffset * 0.1;
        }
    }
    
    // 捏脸功能 - 更换部件
    changeLayer(layerName, newTextureUrl) {
        if (this.layers[layerName]) {
            const oldSprite = this.layers[layerName];
            const newTexture = PIXI.Texture.from(newTextureUrl);
            oldSprite.texture = newTexture;
        }
    }
    
    // 捏脸功能 - 调整颜色
    setLayerColor(layerName, color) {
        if (this.layers[layerName]) {
            this.layers[layerName].tint = color;
        }
    }
    
    // 捏脸功能 - 调整位置
    setLayerPosition(layerName, x, y) {
        if (this.layers[layerName]) {
            this.layers[layerName].x = x;
            this.layers[layerName].y = y;
        }
    }
    
    // 捏脸功能 - 调整大小
    setLayerScale(layerName, scale) {
        if (this.layers[layerName]) {
            this.layers[layerName].scale.set(scale);
        }
    }
}

// 导出
window.CharacterSystem = CharacterSystem;
