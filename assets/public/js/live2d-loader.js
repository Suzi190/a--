/**
 * Live2D Model Loader
 * 简化版Live2D模型加载器
 */

class Live2DLoader {
    constructor(canvasId, modelPath) {
        this.canvas = document.getElementById(canvasId);
        this.modelPath = modelPath;
        this.gl = null;
        this.model = null;
        this.motion = null;
        this.frameId = null;
        
        this.init();
    }
    
    init() {
        if (!