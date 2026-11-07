// 角色装扮编辑器
class CharacterEditor {
    constructor() {
        this.canvas = document.getElementById('previewCanvas');
        this.container = new PIXI.Container();
        
        // 视口变换参数
        this.viewport = {
            x: 0,
            y: 0,
            scale: 1,
            minScale: 0.5,
            maxScale: 3
        };
        
        // 触摸/鼠标状态
        this.gesture = {
            isDragging: false,
            isPinching: false,
            lastX: 0,
            lastY: 0,
            startDistance: 0,
            startScale: 1
        };
        
        this.app = new PIXI.Application({
            view: this.canvas,
            width: window.innerWidth - 200,
            height: window.innerHeight,
            backgroundAlpha: 0,
            antialias: true,
            resolution: window.devicePixelRatio || 1
        });
        
        // 添加容器到舞台
        this.app.stage.addChild(this.container);
        
        // 图层数据
        this.layers = [];
        this.selectedLayer = null;
        this.layerSprites = {};
        
        // 初始化
        this.init();
    }
    
    async init() {
        // 加载所有图层
        await this.loadLayers();
        
        // 创建图层列表UI
        this.createLayerList();
        
        // 绑定事件
        this.bindEvents();
        this.bindViewportEvents();
        
        // 窗口大小改变
        window.addEventListener('resize', () => this.onResize());
        
        // 初始居中
        this.centerViewport();
    }
    
    async loadLayers() {
        // 使用共享配置
        const layerOrder = window.CharacterConfig.layerOrder;
        
        for (let i = 0; i < layerOrder.length; i++) {
            const name = layerOrder[i];
            try {
                const texture = await this.loadTexture(`assets/character/${name}`);
                const sprite = new PIXI.Sprite(texture);
                sprite.anchor.set(0.5);
                sprite.x = 0;
                sprite.y = 50;
                
                // 基础缩放
                const baseScale = Math.min(
                    this.app.screen.width / texture.width,
                    this.app.screen.height / texture.height
                ) * 1.2;
                sprite.scale.set(baseScale);
                
                this.container.addChild(sprite);
                
                this.layers.push({
                    name: name,
                    sprite: sprite,
                    visible: true,
                    originalIndex: i
                });
                
                this.layerSprites[name] = sprite;
            } catch (e) {
                console.error(`加载失败: ${name}`);
            }
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
    
    centerViewport() {
        // 初始居中
        this.viewport.x = this.app.screen.width / 2;
        this.viewport.y = this.app.screen.height / 2;
        this.updateViewport();
    }
    
    updateViewport() {
        this.container.x = this.viewport.x;
        this.container.y = this.viewport.y;
        this.container.scale.set(this.viewport.scale);
    }
    
    bindViewportEvents() {
        const view = this.app.view;
        
        // 鼠标/触摸事件
        view.addEventListener('mousedown', (e) => this.onPointerDown(e));
        view.addEventListener('mousemove', (e) => this.onPointerMove(e));
        view.addEventListener('mouseup', () => this.onPointerUp());
        view.addEventListener('mouseleave', () => this.onPointerUp());
        
        view.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
        view.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        view.addEventListener('touchend', () => this.onPointerUp());
        
        // 滚轮缩放
        view.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    }
    
    onPointerDown(e) {
        this.gesture.isDragging = true;
        this.gesture.lastX = e.clientX;
        this.gesture.lastY = e.clientY;
    }
    
    onPointerMove(e) {
        if (!this.gesture.isDragging || this.gesture.isPinching) return;
        
        const dx = e.clientX - this.gesture.lastX;
        const dy = e.clientY - this.gesture.lastY;
        
        this.viewport.x += dx;
        this.viewport.y += dy;
        this.updateViewport();
        
        this.gesture.lastX = e.clientX;
        this.gesture.lastY = e.clientY;
    }
    
    onTouchStart(e) {
        if (e.touches.length === 1) {
            this.gesture.isDragging = true;
            this.gesture.lastX = e.touches[0].clientX;
            this.gesture.lastY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
            this.gesture.isPinching = true;
            this.gesture.isDragging = false;
            
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            this.gesture.startDistance = Math.sqrt(dx * dx + dy * dy);
            this.gesture.startScale = this.viewport.scale;
        }
    }
    
    onTouchMove(e) {
        e.preventDefault();
        
        if (e.touches.length === 1 && this.gesture.isDragging) {
            const dx = e.touches[0].clientX - this.gesture.lastX;
            const dy = e.touches[0].clientY - this.gesture.lastY;
            
            this.viewport.x += dx;
            this.viewport.y += dy;
            this.updateViewport();
            
            this.gesture.lastX = e.touches[0].clientX;
            this.gesture.lastY = e.touches[0].clientY;
        } else if (e.touches.length === 2 && this.gesture.isPinching) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            const scale = (distance / this.gesture.startDistance) * this.gesture.startScale;
            this.viewport.scale = Math.max(this.viewport.minScale, 
                Math.min(this.viewport.maxScale, scale));
            this.updateViewport();
        }
    }
    
    onPointerUp() {
        this.gesture.isDragging = false;
        this.gesture.isPinching = false;
    }
    
    onWheel(e) {
        e.preventDefault();
        
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = this.viewport.scale * delta;
        
        this.viewport.scale = Math.max(this.viewport.minScale,
            Math.min(this.viewport.maxScale, newScale));
        this.updateViewport();
    }
    
    createLayerList() {
        const list = document.getElementById('layerList');
        list.innerHTML = '';
        
        [...this.layers].reverse().forEach((layer) => {
            const item = document.createElement('div');
            item.className = 'layer-item';
            item.dataset.name = layer.name;
            item.draggable = true;
            
            item.innerHTML = `
                <span class="layer-name">${layer.name.replace('.png', '')}</span>
                <button class="layer-visibility" onclick="event.stopPropagation(); editor.toggleVisibility('${layer.name}')">
                    ${layer.visible ? '👁️' : '🚫'}
                </button>
            `;
            
            item.addEventListener('click', () => this.selectLayer(layer.name));
            item.addEventListener('dragstart', (e) => this.onDragStart(e, layer.name));
            item.addEventListener('dragover', (e) => this.onDragOver(e));
            item.addEventListener('drop', (e) => this.onDrop(e, layer.name));
            
            list.appendChild(item);
        });
    }
    
    selectLayer(name) {
        document.querySelectorAll('.layer-item').forEach(item => {
            item.classList.remove('selected');
        });
        document.querySelector(`[data-name="${name}"]`)?.classList.add('selected');
        
        this.selectedLayer = name;
        const sprite = this.layerSprites[name];
        
        // 更新参数面板（相对于基础值的偏移）
        document.getElementById('posX').value = sprite.x;
        document.getElementById('posY').value = sprite.y - 50;
        document.getElementById('scale').value = sprite.scale.x / 
            (Math.min(this.app.screen.width / sprite.texture.width, 
                     this.app.screen.height / sprite.texture.height) * 1.2);
        document.getElementById('rotation').value = sprite.rotation * (180 / Math.PI);
        
        this.updateParameterValues();
    }
    
    bindEvents() {
        ['posX', 'posY', 'scale', 'rotation'].forEach(id => {
            const slider = document.getElementById(id);
            slider.addEventListener('input', () => this.onParameterChange(id));
        });
    }
    
    onParameterChange(param) {
        if (!this.selectedLayer) return;
        
        const sprite = this.layerSprites[this.selectedLayer];
        const value = parseFloat(document.getElementById(param).value);
        const baseScale = Math.min(
            this.app.screen.width / sprite.texture.width,
            this.app.screen.height / sprite.texture.height
        ) * 1.2;
        
        switch(param) {
            case 'posX':
                sprite.x = value;
                break;
            case 'posY':
                sprite.y = 50 + value;
                break;
            case 'scale':
                sprite.scale.set(baseScale * value);
                break;
            case 'rotation':
                sprite.rotation = value * (Math.PI / 180);
                break;
        }
        
        this.updateParameterValues();
        this.autoSave(); // 参数改变也自动保存
    }
    
    updateParameterValues() {
        document.getElementById('posXValue').textContent = document.getElementById('posX').value;
        document.getElementById('posYValue').textContent = document.getElementById('posY').value;
        document.getElementById('scaleValue').textContent = document.getElementById('scale').value;
        document.getElementById('rotationValue').textContent = document.getElementById('rotation').value + '°';
    }
    
    toggleVisibility(name) {
        const layer = this.layers.find(l => l.name === name);
        if (layer) {
            layer.visible = !layer.visible;
            layer.sprite.visible = layer.visible;
            this.createLayerList();
            this.autoSave(); // 显示/隐藏也自动保存
        }
    }
    
    async autoSave() {
        const baseScale = Math.min(
            this.app.screen.width / this.layers[0].sprite.texture.width,
            this.app.screen.height / this.layers[0].sprite.texture.height
        ) * 1.2;
        
        const config = this.layers.map(layer => {
            const sprite = layer.sprite;
            // 保存相对偏移，而不是绝对坐标
            return {
                name: layer.name,
                x: sprite.x, // 已经是相对中心的位置
                y: sprite.y - 50, // 减去基础偏移
                scale: sprite.scale.x / baseScale, // 保存相对缩放比例
                rotation: sprite.rotation,
                visible: layer.visible,
                order: this.layers.indexOf(layer)
            };
        });
        
        // 使用 IndexedDB 保存
        try {
            await window.characterDB.saveConfig(config);
            console.log('自动保存到 IndexedDB 成功！', config);
        } catch (error) {
            console.error('保存失败:', error);
            // 降级到 localStorage
            localStorage.setItem('characterConfig', JSON.stringify(config));
        }
    }
    
    onDragStart(e, name) {
        e.dataTransfer.setData('text/plain', name);
        e.target.classList.add('dragging');
    }
    
    onDragOver(e) {
        e.preventDefault();
    }
    
    onDrop(e, targetName) {
        e.preventDefault();
        const sourceName = e.dataTransfer.getData('text/plain');
        
        if (sourceName === targetName) return;
        
        const sourceIndex = this.layers.findIndex(l => l.name === sourceName);
        const targetIndex = this.layers.findIndex(l => l.name === targetName);
        
        if (sourceIndex !== -1 && targetIndex !== -1) {
            // 插入而不是交换
            const [movedLayer] = this.layers.splice(sourceIndex, 1);
            this.layers.splice(targetIndex, 0, movedLayer);
            
            // 更新PixiJS显示顺序
            this.layers.forEach((layer, index) => {
                this.container.setChildIndex(layer.sprite, index);
            });
            
            this.createLayerList();
            this.autoSave(); // 自动保存
        }
        
        document.querySelector('.dragging')?.classList.remove('dragging');
    }
    
    onResize() {
        this.app.renderer.resize(
            window.innerWidth - (window.innerWidth > 768 ? 200 : 0),
            window.innerHeight
        );
        this.centerViewport();
    }
}

// 全局函数
function resetAll() {
    if (confirm('确定要重置所有修改吗？')) {
        location.reload();
    }
}

function saveConfig() {
    const config = editor.layers.map(layer => ({
        name: layer.name,
        x: layer.sprite.x,
        y: layer.sprite.y,
        scale: layer.sprite.scale.x,
        rotation: layer.sprite.rotation,
        visible: layer.visible
    }));
    
    localStorage.setItem('characterConfig', JSON.stringify(config));
    alert('配置已保存！');
}

// 初始化
const editor = new CharacterEditor();
