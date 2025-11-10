/**
 * Workflow Orchestrator
 * Manages workflow execution and engine chaining
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { getEngineCore } = require('./EngineCore');
const logger = require('../utils/logger');

class WorkflowOrchestrator extends EventEmitter {
    constructor() {
        super();
        this.workflows = new Map();
        this.executions = new Map();
        this.engineCore = getEngineCore();
    }

    /**
     * Initialize orchestrator
     */
    async initialize() {
        await this.loadWorkflows();
        logger.info(`WorkflowOrchestrator initialized with ${this.workflows.size} workflows`);
    }

    /**
     * Load workflows from database
     */
    async loadWorkflows() {
        try {
            const workflows = await db('workflows')
                .where({ status: 'active' })
                .orderBy('created_at', 'desc');
            
            for (const workflow of workflows) {
                const workflowDef = {
                    ...workflow,
                    steps: typeof workflow.steps === 'string' ? JSON.parse(workflow.steps || '[]') : (workflow.steps || []),
                    config: typeof workflow.config === 'string' ? JSON.parse(workflow.config || '{}') : (workflow.config || {})
                };
                this.workflows.set(workflow.id, workflowDef);
            }
        } catch (error) {
            logger.error('Failed to load workflows:', error);
        }
    }

    /**
     * Create a new workflow
     */
    async createWorkflow(definition) {
        const workflowId = definition.id || uuidv4();
        
        // Validate workflow
        this.validateWorkflow(definition);
        
        // Store in database
        await db('workflows').insert({
            id: workflowId,
            name: definition.name,
            description: definition.description,
            steps: JSON.stringify(definition.steps),
            config: JSON.stringify(definition.config || {}),
            status: 'active',
            created_by: definition.createdBy,
            created_at: new Date(),
            updated_at: new Date()
        }).onConflict('id').merge();
        
        // Store in memory
        this.workflows.set(workflowId, definition);
        
        logger.info(`Workflow created: ${definition.name} (${workflowId})`);
        
        return workflowId;
    }

    /**
     * Execute a workflow
     */
    async executeWorkflow(workflowId, input, context = {}) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error(`Workflow not found: ${workflowId}`);
        }
        
        const executionId = uuidv4();
        const execution = {
            id: executionId,
            workflowId,
            workflow,
            input,
            context,
            status: 'running',
            currentStep: 0,
            results: [],
            startedAt: new Date()
        };
        
        this.executions.set(executionId, execution);
        
        // Emit start event
        this.emit('workflow:started', execution);
        
        try {
            // Execute workflow steps
            const result = await this.runWorkflow(execution);
            
            execution.status = 'completed';
            execution.result = result;
            execution.completedAt = new Date();
            
            // Store execution history
            await this.storeExecutionHistory(execution);
            
            this.emit('workflow:completed', execution);
            
            return result;
            
        } catch (error) {
            execution.status = 'failed';
            execution.error = error.message;
            execution.completedAt = new Date();
            
            await this.storeExecutionHistory(execution);
            
            this.emit('workflow:failed', execution);
            
            throw error;
        } finally {
            // Clean up after some time
            setTimeout(() => {
                this.executions.delete(executionId);
            }, 3600000); // 1 hour
        }
    }

    /**
     * Run workflow execution
     */
    async runWorkflow(execution) {
        const { workflow, input, context } = execution;
        let currentData = input;
        
        for (let i = 0; i < workflow.steps.length; i++) {
            const step = workflow.steps[i];
            execution.currentStep = i;
            
            // Emit step start event
            this.emit('workflow:step:started', { execution, step, index: i });
            
            try {
                // Execute step based on type
                const stepResult = await this.executeStep(step, currentData, context, execution);
                
                // Store step result
                execution.results.push({
                    step: step.name,
                    index: i,
                    result: stepResult,
                    timestamp: new Date()
                });
                
                // Handle step output
                currentData = this.processStepOutput(step, stepResult, currentData);
                
                // Check conditions
                if (step.condition && !await this.evaluateCondition(step.condition, currentData, context)) {
                    logger.debug(`Step ${step.name} skipped due to condition`);
                    continue;
                }
                
                // Handle branching
                if (step.branch) {
                    const branchResult = await this.handleBranch(step.branch, currentData, context, execution);
                    if (branchResult.jump) {
                        i = branchResult.jumpTo - 1; // -1 because loop will increment
                    }
                    if (branchResult.data) {
                        currentData = branchResult.data;
                    }
                }
                
                this.emit('workflow:step:completed', { execution, step, index: i, result: stepResult });
                
            } catch (error) {
                // Handle step error
                if (step.errorHandling === 'skip') {
                    logger.warn(`Step ${step.name} failed, skipping: ${error.message}`);
                    continue;
                } else if (step.errorHandling === 'retry') {
                    const retryResult = await this.retryStep(step, currentData, context, execution);
                    if (retryResult.success) {
                        currentData = retryResult.data;
                    } else {
                        throw new Error(`Step ${step.name} failed after retries: ${error.message}`);
                    }
                } else {
                    throw new Error(`Step ${step.name} failed: ${error.message}`);
                }
            }
        }
        
        return currentData;
    }

    /**
     * Execute a single step
     */
    async executeStep(step, data, context, execution) {
        switch (step.type) {
            case 'engine':
                return await this.executeEngineStep(step, data, context);
            
            case 'parallel':
                return await this.executeParallelStep(step, data, context, execution);
            
            case 'sequential':
                return await this.executeSequentialStep(step, data, context, execution);
            
            case 'conditional':
                return await this.executeConditionalStep(step, data, context);
            
            case 'loop':
                return await this.executeLoopStep(step, data, context, execution);
            
            case 'transform':
                return await this.executeTransformStep(step, data, context);
            
            case 'aggregate':
                return await this.executeAggregateStep(step, data, context);
            
            case 'human':
                return await this.executeHumanStep(step, data, context);
            
            default:
                throw new Error(`Unknown step type: ${step.type}`);
        }
    }

    /**
     * Execute engine step
     */
    async executeEngineStep(step, data, context) {
        const engineId = step.engine;
        const input = this.prepareEngineInput(step, data);
        
        // Execute engine
        const result = await this.engineCore.executeEngine(engineId, input, context);
        
        return result;
    }

    /**
     * Execute parallel steps
     */
    async executeParallelStep(step, data, context, execution) {
        const promises = step.engines.map(engineConfig => {
            const input = this.prepareEngineInput(engineConfig, data);
            return this.engineCore.executeEngine(engineConfig.engine, input, context);
        });
        
        const results = await Promise.all(promises);
        
        // Combine results based on configuration
        if (step.combine === 'merge') {
            return Object.assign({}, ...results);
        } else if (step.combine === 'array') {
            return results;
        } else {
            return results;
        }
    }

    /**
     * Execute sequential steps
     */
    async executeSequentialStep(step, data, context, execution) {
        let currentData = data;
        
        for (const subStep of step.steps) {
            currentData = await this.executeStep(subStep, currentData, context, execution);
        }
        
        return currentData;
    }

    /**
     * Execute conditional step
     */
    async executeConditionalStep(step, data, context) {
        const condition = await this.evaluateCondition(step.condition, data, context);
        
        if (condition) {
            if (step.then) {
                return await this.executeStep(step.then, data, context);
            }
        } else {
            if (step.else) {
                return await this.executeStep(step.else, data, context);
            }
        }
        
        return data;
    }

    /**
     * Execute loop step
     */
    async executeLoopStep(step, data, context, execution) {
        const results = [];
        const items = this.getLoopItems(step, data);
        
        for (const item of items) {
            const loopData = { ...data, _loopItem: item };
            const result = await this.executeStep(step.body, loopData, context, execution);
            results.push(result);
        }
        
        return results;
    }

    /**
     * Execute transform step
     */
    async executeTransformStep(step, data, context) {
        const transformCode = step.transform;
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const transform = new AsyncFunction('data', 'context', transformCode);
        return await transform(data, context);
    }

    /**
     * Execute aggregate step
     */
    async executeAggregateStep(step, data, context) {
        const aggregateCode = step.aggregate;
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const aggregate = new AsyncFunction('data', 'context', aggregateCode);
        return await aggregate(data, context);
    }

    /**
     * Execute human review step
     */
    async executeHumanStep(step, data, context) {
        const reviewId = uuidv4();
        
        // Create review task
        await db('human_reviews').insert({
            id: reviewId,
            workflow_id: context.workflowId,
            step_name: step.name,
            data: JSON.stringify(data),
            instructions: step.instructions,
            status: 'pending',
            created_at: new Date()
        });
        
        // Wait for review (with timeout)
        const timeout = step.timeout || 3600000; // 1 hour default
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            const review = await db('human_reviews')
                .where({ id: reviewId })
                .first();
            
            if (review.status === 'approved' || review.status === 'rejected') {
                return {
                    approved: review.status === 'approved',
                    feedback: review.feedback,
                    modifiedData: review.modified_data ? JSON.parse(review.modified_data) : data
                };
            }
            
            // Wait before checking again
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
        throw new Error('Human review timeout');
    }

    /**
     * Prepare engine input
     */
    prepareEngineInput(step, data) {
        if (step.inputMapping) {
            const mapped = {};
            for (const [key, path] of Object.entries(step.inputMapping)) {
                mapped[key] = this.getValueByPath(data, path);
            }
            return mapped;
        }
        
        if (step.input) {
            return step.input;
        }
        
        return data;
    }

    /**
     * Process step output
     */
    processStepOutput(step, result, currentData) {
        if (step.outputMapping) {
            const mapped = { ...currentData };
            for (const [path, key] of Object.entries(step.outputMapping)) {
                this.setValueByPath(mapped, path, result[key]);
            }
            return mapped;
        }
        
        if (step.outputMode === 'replace') {
            return result;
        } else if (step.outputMode === 'merge') {
            return { ...currentData, ...result };
        } else if (step.outputMode === 'append') {
            return { ...currentData, [step.name]: result };
        }
        
        return result;
    }

    /**
     * Evaluate condition
     */
    async evaluateCondition(condition, data, context) {
        if (typeof condition === 'string') {
            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            const evaluate = new AsyncFunction('data', 'context', `return ${condition}`);
            return await evaluate(data, context);
        }
        
        if (typeof condition === 'object') {
            // Handle complex conditions
            if (condition.type === 'equals') {
                return this.getValueByPath(data, condition.field) === condition.value;
            } else if (condition.type === 'contains') {
                const value = this.getValueByPath(data, condition.field);
                return value && value.includes(condition.value);
            } else if (condition.type === 'greater') {
                return this.getValueByPath(data, condition.field) > condition.value;
            } else if (condition.type === 'less') {
                return this.getValueByPath(data, condition.field) < condition.value;
            }
        }
        
        return true;
    }

    /**
     * Handle branching
     */
    async handleBranch(branch, data, context, execution) {
        for (const rule of branch.rules) {
            if (await this.evaluateCondition(rule.condition, data, context)) {
                if (rule.goto) {
                    const stepIndex = execution.workflow.steps.findIndex(s => s.name === rule.goto);
                    if (stepIndex >= 0) {
                        return { jump: true, jumpTo: stepIndex };
                    }
                }
                if (rule.return) {
                    return { data: rule.return };
                }
            }
        }
        return {};
    }

    /**
     * Retry step
     */
    async retryStep(step, data, context, execution, maxRetries = 3) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                const result = await this.executeStep(step, data, context, execution);
                return { success: true, data: result };
            } catch (error) {
                logger.warn(`Retry ${i + 1}/${maxRetries} failed for step ${step.name}: ${error.message}`);
                if (i < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
                }
            }
        }
        return { success: false };
    }

    /**
     * Get loop items
     */
    getLoopItems(step, data) {
        if (step.items) {
            return step.items;
        }
        
        if (step.itemsPath) {
            return this.getValueByPath(data, step.itemsPath) || [];
        }
        
        if (step.range) {
            const items = [];
            for (let i = step.range.start; i <= step.range.end; i += step.range.step || 1) {
                items.push(i);
            }
            return items;
        }
        
        return [];
    }

    /**
     * Get value by path
     */
    getValueByPath(obj, path) {
        return path.split('.').reduce((curr, prop) => curr?.[prop], obj);
    }

    /**
     * Set value by path
     */
    setValueByPath(obj, path, value) {
        const parts = path.split('.');
        const last = parts.pop();
        const target = parts.reduce((curr, prop) => {
            if (!curr[prop]) curr[prop] = {};
            return curr[prop];
        }, obj);
        target[last] = value;
    }

    /**
     * Validate workflow
     */
    validateWorkflow(workflow) {
        if (!workflow.name) {
            throw new Error('Workflow must have a name');
        }
        
        if (!workflow.steps || workflow.steps.length === 0) {
            throw new Error('Workflow must have at least one step');
        }
        
        // Validate each step
        for (const step of workflow.steps) {
            if (!step.type) {
                throw new Error(`Step ${step.name || 'unnamed'} must have a type`);
            }
        }
    }

    /**
     * Store execution history
     */
    async storeExecutionHistory(execution) {
        await db('workflow_executions').insert({
            id: execution.id,
            workflow_id: execution.workflowId,
            input: JSON.stringify(execution.input),
            output: JSON.stringify(execution.result),
            context: JSON.stringify(execution.context),
            status: execution.status,
            error: execution.error,
            results: JSON.stringify(execution.results),
            started_at: execution.startedAt,
            completed_at: execution.completedAt
        });
    }

    /**
     * List workflows
     */
    async listWorkflows(filters = {}) {
        const query = db('workflows');
        
        if (filters.status) {
            query.where('status', filters.status);
        }
        
        if (filters.createdBy) {
            query.where('created_by', filters.createdBy);
        }
        
        return await query.orderBy('created_at', 'desc');
    }

    /**
     * Get workflow statistics
     */
    async getStatistics() {
        const stats = await db('workflow_executions')
            .select(
                db.raw('COUNT(*) as total'),
                db.raw('COUNT(CASE WHEN status = \'completed\' THEN 1 END) as completed'),
                db.raw('COUNT(CASE WHEN status = \'failed\' THEN 1 END) as failed'),
                db.raw('AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration')
            )
            .first();
        
        return {
            workflows: this.workflows.size,
            executions: {
                total: parseInt(stats.total),
                completed: parseInt(stats.completed),
                failed: parseInt(stats.failed),
                running: this.executions.size,
                avgDuration: parseFloat(stats.avg_duration) || 0
            }
        };
    }
}

// Singleton instance
let instance = null;

module.exports = {
    getWorkflowOrchestrator: () => {
        if (!instance) {
            instance = new WorkflowOrchestrator();
        }
        return instance;
    },
    WorkflowOrchestrator
};