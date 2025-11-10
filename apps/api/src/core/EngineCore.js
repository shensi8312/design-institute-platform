/**
 * EngineCore - Universal Engine Management System
 * Core infrastructure for dynamic engine registration, execution, and lifecycle management
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const logger = require('../utils/logger');

// Redis is optional - use if available
let redis = null;
try {
    redis = require('../config/redis');
} catch (error) {
    logger.warn('Redis not configured, caching disabled');
}

class EngineCore extends EventEmitter {
    constructor() {
        super();
        this.engines = new Map();
        this.instances = new Map();
        this.executionQueue = [];
        this.maxConcurrent = 10;
        this.currentExecutions = 0;
    }

    /**
     * Initialize the engine core
     */
    async initialize() {
        logger.info('Initializing EngineCore...');
        
        // Load registered engines from database
        await this.loadEngines();
        
        // Start execution queue processor
        this.startQueueProcessor();
        
        // Setup event handlers
        this.setupEventHandlers();
        
        logger.info(`EngineCore initialized with ${this.engines.size} engines`);
    }

    /**
     * Load engines from database
     */
    async loadEngines() {
        try {
            const engines = await db('engines')
                .where({ status: 'active' })
                .orderBy('created_at', 'desc');
            
            for (const engine of engines) {
                const engineDef = {
                    ...engine,
                    schema: typeof engine.schema === 'string' ? JSON.parse(engine.schema) : engine.schema,
                    config: typeof engine.config === 'string' ? JSON.parse(engine.config) : engine.config,
                    tags: typeof engine.tags === 'string' ? JSON.parse(engine.tags) : engine.tags
                };
                this.engines.set(engine.id, engineDef);
            }
        } catch (error) {
            logger.error('Failed to load engines:', error);
        }
    }

    /**
     * Register a new engine
     */
    async registerEngine(engineDefinition) {
        const engineId = engineDefinition.metadata?.id || engineDefinition.id || uuidv4();
        
        // Validate engine definition
        this.validateEngineDefinition(engineDefinition);
        
        // Compile engine if needed
        const compiled = await this.compileEngine(engineDefinition);
        
        // If there's a processFunction, convert it to code string
        let code = engineDefinition.code;
        if (engineDefinition.processFunction && typeof engineDefinition.processFunction === 'function') {
            // Store the function as a string for persistence
            code = engineDefinition.processFunction.toString();
            // Also keep the function for immediate use
            compiled.processFunction = engineDefinition.processFunction;
        }
        
        // Store in database
        await db('engines').insert({
            id: engineId,
            name: engineDefinition.metadata.name,
            version: engineDefinition.metadata.version,
            domain: engineDefinition.metadata.domain,
            author: engineDefinition.metadata.author,
            description: engineDefinition.metadata.description,
            icon: engineDefinition.metadata.icon,
            tags: JSON.stringify(engineDefinition.metadata.tags || []),
            schema: JSON.stringify(engineDefinition.schema),
            config: JSON.stringify(engineDefinition.config || {}),
            code: code,
            status: 'active',
            created_at: new Date(),
            updated_at: new Date()
        }).onConflict('id').merge();
        
        // Store in memory
        this.engines.set(engineId, compiled);
        
        // Emit registration event
        this.emit('engine:registered', { engineId, engine: compiled });
        
        logger.info(`Engine registered: ${engineDefinition.metadata.name} (${engineId})`);
        
        return engineId;
    }

    /**
     * Execute an engine
     */
    async executeEngine(engineId, input, context = {}) {
        const engine = this.engines.get(engineId);
        if (!engine) {
            throw new Error(`Engine not found: ${engineId}`);
        }
        
        const executionId = uuidv4();
        const execution = {
            id: executionId,
            engineId,
            input,
            context,
            status: 'pending',
            createdAt: new Date()
        };
        
        // Add to execution queue
        this.executionQueue.push(execution);
        
        // Process queue
        await this.processQueue();
        
        // Store execution reference
        this.instances.set(executionId, execution);
        
        // Wait for execution to complete
        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
                const exec = this.instances.get(executionId);
                if (!exec) {
                    clearInterval(checkInterval);
                    reject(new Error('Execution not found'));
                    return;
                }
                if (exec.status === 'completed') {
                    clearInterval(checkInterval);
                    resolve(exec.result);
                } else if (exec.status === 'failed') {
                    clearInterval(checkInterval);
                    reject(new Error(exec.error));
                }
            }, 100);
            
            // Timeout after configured time
            setTimeout(() => {
                clearInterval(checkInterval);
                reject(new Error('Execution timeout'));
            }, engine.config?.timeout || 30000);
        });
    }

    /**
     * Process execution queue
     */
    async processQueue() {
        while (this.executionQueue.length > 0 && this.currentExecutions < this.maxConcurrent) {
            const execution = this.executionQueue.shift();
            this.currentExecutions++;
            
            // Execute in background
            this.runEngine(execution).finally(() => {
                this.currentExecutions--;
                this.processQueue();
            });
        }
    }

    /**
     * Run a single engine execution
     */
    async runEngine(execution) {
        const engine = this.engines.get(execution.engineId);
        
        try {
            // Create engine instance
            const instance = this.createEngineInstance(engine, execution.context);
            
            // Validate input
            const validation = await instance.validate(execution.input);
            if (!validation.valid) {
                throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
            }
            
            // Execute engine
            execution.status = 'running';
            this.emit('engine:execution:started', execution);
            
            const result = await instance.process(execution.input);
            
            // Store result
            execution.status = 'completed';
            execution.result = result;
            execution.completedAt = new Date();
            
            // Cache result if configured
            if (engine.config.cache) {
                await this.cacheResult(execution.engineId, execution.input, result);
            }
            
            // Store execution history
            await this.storeExecutionHistory(execution);
            
            this.emit('engine:execution:completed', execution);
            
        } catch (error) {
            execution.status = 'failed';
            execution.error = error.message;
            execution.completedAt = new Date();
            
            logger.error(`Engine execution failed: ${execution.engineId}`, error);
            this.emit('engine:execution:failed', execution);
        }
    }

    /**
     * Create engine instance
     */
    createEngineInstance(engine, context) {
        // Dynamic engine instance creation
        const EngineClass = this.compileEngineClass(engine);
        return new EngineClass(context);
    }

    /**
     * Compile engine class from definition
     */
    compileEngineClass(engine) {
        // Create dynamic class from engine definition
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        
        // Create a simple wrapper class
        class DynamicEngine {
            constructor(context) {
                this.context = context;
                this.config = engine.config;
                this.schema = engine.schema;
            }
            
            async validate(input) {
                // Validation logic from engine definition
                const errors = [];
                const required = this.schema.inputs;
                
                for (const [key, def] of Object.entries(required)) {
                    if (def.required && !input[key]) {
                        errors.push(`Missing required field: ${key}`);
                    }
                }
                
                return { valid: errors.length === 0, errors };
            }
            
            async process(input) {
                // Execute engine code
                if (engine.processFunction && typeof engine.processFunction === 'function') {
                    // Direct function execution
                    try {
                        return await engine.processFunction(input, this.context);
                    } catch (error) {
                        throw new Error(`Engine function execution failed: ${error.message}`);
                    }
                } else if (engine.code) {
                    // Code string execution
                    try {
                        // Create a function from the code string
                        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
                        const engineFunction = new AsyncFunction('input', 'context', engine.code);
                        return await engineFunction(input, this.context);
                    } catch (error) {
                        throw new Error(`Engine code execution failed: ${error.message}`);
                    }
                }
                return input;
            }
        }
        
        return DynamicEngine;
    }

    /**
     * Validate engine definition
     */
    validateEngineDefinition(definition) {
        const required = ['metadata', 'schema'];
        for (const field of required) {
            if (!definition[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
        
        if (!definition.metadata.name) {
            throw new Error('Engine must have a name');
        }
        
        if (!definition.schema.inputs || !definition.schema.outputs) {
            throw new Error('Engine must define inputs and outputs');
        }
    }

    /**
     * Compile engine definition
     */
    async compileEngine(definition) {
        // Add default configurations
        const compiled = {
            ...definition,
            config: {
                timeout: 30000,
                retries: 3,
                cache: true,
                ...definition.config
            }
        };
        
        return compiled;
    }

    /**
     * Cache execution result
     */
    async cacheResult(engineId, input, result) {
        if (!redis) return;
        try {
            const key = `engine:${engineId}:${JSON.stringify(input)}`;
            await redis.setex(key, 3600, JSON.stringify(result));
        } catch (error) {
            logger.warn('Failed to cache result:', error.message);
        }
    }

    /**
     * Get cached result
     */
    async getCachedResult(engineId, input) {
        if (!redis) return null;
        try {
            const key = `engine:${engineId}:${JSON.stringify(input)}`;
            const cached = await redis.get(key);
            return cached ? JSON.parse(cached) : null;
        } catch (error) {
            logger.warn('Failed to get cached result:', error.message);
            return null;
        }
    }

    /**
     * Store execution history
     */
    async storeExecutionHistory(execution) {
        await db('engine_executions').insert({
            id: execution.id,
            engine_id: execution.engineId,
            input: JSON.stringify(execution.input),
            output: JSON.stringify(execution.result),
            context: JSON.stringify(execution.context),
            status: execution.status,
            error: execution.error,
            started_at: execution.createdAt,
            completed_at: execution.completedAt
        });
    }

    /**
     * Get execution by ID
     */
    getExecution(executionId) {
        // Find in queue or completed executions
        return this.executionQueue.find(e => e.id === executionId) || 
               this.instances.get(executionId);
    }

    /**
     * List all engines
     */
    async listEngines(filters = {}) {
        const query = db('engines');
        
        if (filters.domain) {
            query.where('domain', filters.domain);
        }
        
        if (filters.tags) {
            query.whereRaw('tags::jsonb @> ?', [JSON.stringify(filters.tags)]);
        }
        
        if (filters.status) {
            query.where('status', filters.status);
        }
        
        return await query.orderBy('created_at', 'desc');
    }

    /**
     * Update engine
     */
    async updateEngine(engineId, updates) {
        await db('engines')
            .where({ id: engineId })
            .update({
                ...updates,
                updated_at: new Date()
            });
        
        // Reload engine
        await this.reloadEngine(engineId);
    }

    /**
     * Reload engine from database
     */
    async reloadEngine(engineId) {
        const engine = await db('engines')
            .where({ id: engineId })
            .first();
        
        if (engine) {
            const engineDef = {
                ...engine,
                schema: JSON.parse(engine.schema || '{}'),
                config: JSON.parse(engine.config || '{}')
            };
            this.engines.set(engineId, engineDef);
        }
    }

    /**
     * Delete engine
     */
    async deleteEngine(engineId) {
        await db('engines')
            .where({ id: engineId })
            .update({ status: 'deleted', deleted_at: new Date() });
        
        this.engines.delete(engineId);
    }

    /**
     * Setup event handlers
     */
    setupEventHandlers() {
        this.on('engine:registered', ({ engineId, engine }) => {
            logger.info(`Engine registered: ${engine.metadata.name}`);
        });
        
        this.on('engine:execution:started', (execution) => {
            logger.debug(`Execution started: ${execution.id}`);
        });
        
        this.on('engine:execution:completed', (execution) => {
            logger.debug(`Execution completed: ${execution.id}`);
        });
        
        this.on('engine:execution:failed', (execution) => {
            logger.error(`Execution failed: ${execution.id} - ${execution.error}`);
        });
    }

    /**
     * Start queue processor
     */
    startQueueProcessor() {
        setInterval(() => {
            if (this.executionQueue.length > 0) {
                this.processQueue();
            }
        }, 1000);
    }

    /**
     * Get engine statistics
     */
    async getStatistics() {
        const totalEngines = this.engines.size;
        const executions = await db('engine_executions')
            .select(
                db.raw('COUNT(*) as total'),
                db.raw('COUNT(CASE WHEN status = \'completed\' THEN 1 END) as completed'),
                db.raw('COUNT(CASE WHEN status = \'failed\' THEN 1 END) as failed')
            )
            .first();
        
        return {
            engines: {
                total: totalEngines,
                active: Array.from(this.engines.values()).filter(e => e.status === 'active').length
            },
            executions: {
                total: parseInt(executions.total),
                completed: parseInt(executions.completed),
                failed: parseInt(executions.failed),
                pending: this.executionQueue.length,
                running: this.currentExecutions
            }
        };
    }
}

// Singleton instance
let instance = null;

module.exports = {
    getEngineCore: () => {
        if (!instance) {
            instance = new EngineCore();
        }
        return instance;
    },
    EngineCore
};