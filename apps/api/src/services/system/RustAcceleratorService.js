/**
 * Rust加速器服务包装器
 * 提供向量搜索、文本处理和图计算的高性能实现
 */

const { spawn } = require('child_process');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

class RustAcceleratorService {
    constructor() {
        this.rustProcess = null;
        this.port = process.env.RUST_ACCELERATOR_PORT || 8091;
        this.isRunning = false;
        this.startupTimeout = 30000; // 30秒启动超时
        
        // 性能统计
        this.stats = {
            vectorSearches: 0,
            textProcessed: 0,
            graphComputations: 0,
            totalSpeedupRatio: 0
        };
    }

    /**
     * 启动Rust加速服务
     */
    async start() {
        if (this.isRunning) {
            console.log('[RustAccelerator] 服务已在运行');
            return true;
        }

        const rustBinaryPath = this.getRustBinaryPath();
        
        if (!fs.existsSync(rustBinaryPath)) {
            console.warn('[RustAccelerator] Rust二进制文件不存在，需要先编译');
            await this.compile();
        }

        return new Promise((resolve, reject) => {
            console.log('[RustAccelerator] 启动Rust加速服务...');
            
            this.rustProcess = spawn(rustBinaryPath, [
                '--port', this.port.toString(),
                '--threads', process.env.RUST_THREADS || '4',
                '--cache-size', process.env.RUST_CACHE_SIZE || '1000'
            ], {
                env: {
                    ...process.env,
                    RUST_LOG: 'info',
                    RUST_BACKTRACE: '1'
                }
            });

            this.rustProcess.stdout.on('data', (data) => {
                const message = data.toString();
                console.log('[RustAccelerator]', message);
                
                if (message.includes('Server started')) {
                    this.isRunning = true;
                    resolve(true);
                }
            });

            this.rustProcess.stderr.on('data', (data) => {
                console.error('[RustAccelerator Error]', data.toString());
            });

            this.rustProcess.on('close', (code) => {
                console.log(`[RustAccelerator] 进程退出，代码: ${code}`);
                this.isRunning = false;
            });

            // 启动超时
            setTimeout(() => {
                if (!this.isRunning) {
                    reject(new Error('Rust加速器启动超时'));
                }
            }, this.startupTimeout);
        });
    }

    /**
     * 编译Rust代码
     */
    async compile() {
        console.log('[RustAccelerator] 开始编译Rust代码...');
        
        return new Promise((resolve, reject) => {
            const cargoPath = path.join(__dirname, '../../rust_acceleration');
            
            const compileProcess = spawn('cargo', ['build', '--release'], {
                cwd: cargoPath,
                stdio: 'inherit'
            });

            compileProcess.on('close', (code) => {
                if (code === 0) {
                    console.log('[RustAccelerator] 编译成功');
                    resolve();
                } else {
                    reject(new Error(`编译失败，退出代码: ${code}`));
                }
            });

            compileProcess.on('error', (err) => {
                console.error('[RustAccelerator] 编译错误:', err);
                reject(err);
            });
        });
    }

    /**
     * 获取Rust二进制文件路径
     */
    getRustBinaryPath() {
        const basePath = path.join(__dirname, '../../rust_acceleration/target/release');
        const binaryName = process.platform === 'win32' ? 'rag_accelerator.exe' : 'rag_accelerator';
        return path.join(basePath, binaryName);
    }

    /**
     * 检查服务是否可用
     */
    async checkHealth() {
        try {
            const response = await axios.get(`http://localhost:${this.port}/health`, {
                timeout: 5000
            });
            return response.data.status === 'healthy';
        } catch (error) {
            return false;
        }
    }

    /**
     * 向量搜索（使用SIMD加速）
     */
    async vectorSearch(query, vectors, k = 10) {
        const startTime = Date.now();
        
        try {
            // 尝试使用Rust加速
            if (this.isRunning) {
                const response = await axios.post(
                    `http://localhost:${this.port}/vector/search`,
                    {
                        query: query,
                        vectors: vectors,
                        k: k,
                        metric: 'cosine'
                    },
                    {
                        timeout: 10000,
                        maxContentLength: Infinity,
                        maxBodyLength: Infinity
                    }
                );
                
                const rustTime = Date.now() - startTime;
                this.stats.vectorSearches++;
                
                console.log(`[RustAccelerator] 向量搜索完成，耗时: ${rustTime}ms`);
                
                return {
                    results: response.data.results,
                    time: rustTime,
                    accelerated: true
                };
            }
        } catch (error) {
            console.warn('[RustAccelerator] 向量搜索失败，回退到JavaScript实现:', error.message);
        }

        // 回退到JavaScript实现
        const jsStartTime = Date.now();
        const results = this.jsVectorSearch(query, vectors, k);
        const jsTime = Date.now() - jsStartTime;
        
        return {
            results: results,
            time: jsTime,
            accelerated: false
        };
    }

    /**
     * JavaScript向量搜索实现（备用）
     */
    jsVectorSearch(query, vectors, k) {
        const similarities = vectors.map((vector, idx) => {
            const similarity = this.cosineSimilarity(query, vector);
            return { index: idx, score: similarity };
        });

        similarities.sort((a, b) => b.score - a.score);
        return similarities.slice(0, k);
    }

    /**
     * 余弦相似度计算
     */
    cosineSimilarity(a, b) {
        if (a.length !== b.length) return 0;
        
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        
        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);
        
        if (normA === 0 || normB === 0) return 0;
        
        return dotProduct / (normA * normB);
    }

    /**
     * 批量文本处理（并行分词、实体提取）
     */
    async batchProcessText(texts, options = {}) {
        const startTime = Date.now();
        
        try {
            if (this.isRunning) {
                const response = await axios.post(
                    `http://localhost:${this.port}/text/batch_process`,
                    {
                        texts: texts,
                        extract_entities: options.extractEntities || true,
                        tokenize: options.tokenize || true,
                        language: options.language || 'zh'
                    },
                    {
                        timeout: 30000
                    }
                );
                
                const rustTime = Date.now() - startTime;
                this.stats.textProcessed += texts.length;
                
                console.log(`[RustAccelerator] 处理 ${texts.length} 个文本，耗时: ${rustTime}ms`);
                
                return {
                    results: response.data.results,
                    time: rustTime,
                    accelerated: true
                };
            }
        } catch (error) {
            console.warn('[RustAccelerator] 文本处理失败，回退到JavaScript实现:', error.message);
        }

        // 回退到JavaScript实现
        const jsStartTime = Date.now();
        const results = texts.map(text => this.jsProcessText(text, options));
        const jsTime = Date.now() - jsStartTime;
        
        return {
            results: results,
            time: jsTime,
            accelerated: false
        };
    }

    /**
     * JavaScript文本处理实现（备用）
     */
    jsProcessText(text, options) {
        const result = {
            tokens: [],
            entities: []
        };

        // 简单分词
        if (options.tokenize) {
            result.tokens = text.split(/\s+/);
        }

        // 简单实体提取
        if (options.extractEntities) {
            // 建筑规范
            const codePattern = /GB\s?\d{5}(-\d{4})?/g;
            const codes = text.match(codePattern) || [];
            
            // 尺寸
            const dimensionPattern = /\d+×\d+(×\d+)?mm/g;
            const dimensions = text.match(dimensionPattern) || [];
            
            result.entities = [
                ...codes.map(c => ({ type: 'BuildingCode', value: c })),
                ...dimensions.map(d => ({ type: 'Dimension', value: d }))
            ];
        }

        return result;
    }

    /**
     * 图计算（PageRank、社区发现）
     */
    async graphCompute(nodes, edges, algorithm = 'pagerank', options = {}) {
        const startTime = Date.now();
        
        try {
            if (this.isRunning) {
                const response = await axios.post(
                    `http://localhost:${this.port}/graph/${algorithm}`,
                    {
                        nodes: nodes,
                        edges: edges,
                        ...options
                    },
                    {
                        timeout: 60000
                    }
                );
                
                const rustTime = Date.now() - startTime;
                this.stats.graphComputations++;
                
                console.log(`[RustAccelerator] 图计算(${algorithm})完成，耗时: ${rustTime}ms`);
                
                return {
                    results: response.data.results,
                    time: rustTime,
                    accelerated: true
                };
            }
        } catch (error) {
            console.warn('[RustAccelerator] 图计算失败:', error.message);
        }

        // 对于图计算，如果Rust不可用，返回错误
        throw new Error('图计算需要Rust加速器');
    }

    /**
     * 获取加速统计信息
     */
    getStats() {
        return {
            ...this.stats,
            isRunning: this.isRunning,
            port: this.port
        };
    }

    /**
     * 停止Rust加速服务
     */
    async stop() {
        if (this.rustProcess) {
            console.log('[RustAccelerator] 停止服务...');
            this.rustProcess.kill('SIGTERM');
            
            // 等待进程结束
            await new Promise(resolve => {
                setTimeout(resolve, 1000);
            });
            
            this.rustProcess = null;
            this.isRunning = false;
        }
    }

    /**
     * 重启服务
     */
    async restart() {
        await this.stop();
        await this.start();
    }
}

// 单例模式
let instance = null;

module.exports = {
    getInstance: () => {
        if (!instance) {
            instance = new RustAcceleratorService();
        }
        return instance;
    },
    RustAcceleratorService
};