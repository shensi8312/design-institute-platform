/**
 * OCCT.js STEP文件加载器
 * 使用OpenCascade WebAssembly直接加载STEP文件
 */

export class OCCTStepLoader {
  constructor() {
    this.occt = null;
    this.initialized = false;
  }

  /**
   * 初始化OCCT引擎
   */
  async init(onProgress) {
    if (this.initialized) return;

    try {
      onProgress?.({ stage: 'loading_wasm', progress: 0, message: '正在加载OpenCascade WASM...' });

      // 使用occt-import-js (基于opencascade.js)
      // CDN地址: https://cdn.jsdelivr.net/npm/occt-import-js@0.0.12/dist/occt-import-js.js
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/occt-import-js@0.0.12/dist/occt-import-js.js';

      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });

      onProgress?.({ stage: 'initializing', progress: 50, message: '正在初始化OCCT引擎...' });

      // 初始化occt-import-js
      this.occt = await window.occtimportjs();

      this.initialized = true;
      onProgress?.({ stage: 'ready', progress: 100, message: 'OCCT引擎就绪' });

      return true;
    } catch (error) {
      console.error('OCCT初始化失败:', error);
      throw new Error('OCCT引擎初始化失败: ' + error.message);
    }
  }

  /**
   * 从URL加载STEP文件
   */
  async loadStepFromUrl(url, onProgress) {
    if (!this.initialized) {
      throw new Error('OCCT引擎未初始化，请先调用init()');
    }

    try {
      onProgress?.({ stage: 'downloading', progress: 0, message: '正在下载STEP文件...' });

      // 下载STEP文件
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const fileData = new Uint8Array(arrayBuffer);

      onProgress?.({ stage: 'parsing', progress: 50, message: '正在解析STEP文件...' });

      // 使用OCCT解析STEP
      const result = await this.occt.ReadStepFile(fileData, null);

      if (!result.success) {
        throw new Error('STEP文件解析失败');
      }

      onProgress?.({ stage: 'converting', progress: 75, message: '正在转换为网格...' });

      // 转换为Three.js可用的网格数据
      const meshData = this.convertToThreeJS(result);

      onProgress?.({ stage: 'complete', progress: 100, message: '加载完成' });

      return meshData;
    } catch (error) {
      console.error('STEP加载失败:', error);
      throw error;
    }
  }

  /**
   * 从文件对象加载STEP
   */
  async loadStepFromFile(file, onProgress) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          const fileData = new Uint8Array(arrayBuffer);

          onProgress?.({ stage: 'parsing', progress: 30, message: '正在解析STEP文件...' });

          const result = await this.occt.ReadStepFile(fileData, null);

          if (!result.success) {
            throw new Error('STEP文件解析失败');
          }

          onProgress?.({ stage: 'converting', progress: 70, message: '正在转换为网格...' });

          const meshData = this.convertToThreeJS(result);

          onProgress?.({ stage: 'complete', progress: 100, message: '加载完成' });

          resolve(meshData);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error('文件读取失败'));

      onProgress?.({ stage: 'reading', progress: 0, message: '正在读取文件...' });
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * 将OCCT结果转换为Three.js网格数据
   */
  convertToThreeJS(occtResult) {
    const meshes = [];

    // 遍历OCCT返回的所有形状
    for (const shape of occtResult.meshes) {
      const geometry = {
        positions: new Float32Array(shape.attributes.position.array),
        normals: new Float32Array(shape.attributes.normal.array),
        indices: shape.index ? new Uint32Array(shape.index.array) : null,
        colors: shape.attributes.color ? new Float32Array(shape.attributes.color.array) : null
      };

      const mesh = {
        name: shape.name || 'Unnamed',
        geometry,
        color: shape.color || [0.8, 0.8, 0.9], // RGB 0-1
        transformation: shape.transformation || [
          1, 0, 0, 0,
          0, 1, 0, 0,
          0, 0, 1, 0,
          0, 0, 0, 1
        ]
      };

      meshes.push(mesh);
    }

    return {
      meshes,
      boundingBox: occtResult.boundingBox || null,
      metadata: {
        partCount: meshes.length,
        faceCount: occtResult.faceCount || 0,
        edgeCount: occtResult.edgeCount || 0
      }
    };
  }

  /**
   * 批量加载多个STEP文件
   */
  async loadMultipleSteps(urls, onProgress) {
    const results = [];

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];

      onProgress?.({
        stage: 'batch_loading',
        progress: (i / urls.length) * 100,
        current: i + 1,
        total: urls.length,
        message: `正在加载 ${i + 1}/${urls.length}: ${url}`
      });

      try {
        const meshData = await this.loadStepFromUrl(url, null);
        results.push({
          url,
          success: true,
          data: meshData
        });
      } catch (error) {
        console.error(`加载失败 ${url}:`, error);
        results.push({
          url,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * 导出为STL格式
   */
  async exportToSTL(meshData) {
    // TODO: 实现STL导出
    throw new Error('STL导出功能尚未实现');
  }

  /**
   * 清理资源
   */
  dispose() {
    if (this.occt) {
      // occt-import-js没有显式的dispose方法
      this.occt = null;
    }
    this.initialized = false;
  }
}

/**
 * 单例模式，全局共享一个OCCT实例
 */
let globalLoader = null;

export async function getOCCTLoader() {
  if (!globalLoader) {
    globalLoader = new OCCTStepLoader();
    await globalLoader.init((progress) => {
      console.log('[OCCT初始化]', progress.message, `${progress.progress}%`);
    });
  }
  return globalLoader;
}
