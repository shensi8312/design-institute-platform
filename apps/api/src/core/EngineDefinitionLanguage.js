/**
 * Engine Definition Language (EDL)
 * Standard interface and schema for all engines
 */

const Joi = require('joi');

// Engine metadata schema
const metadataSchema = Joi.object({
    id: Joi.string().optional(),
    name: Joi.string().required(),
    version: Joi.string().pattern(/^\d+\.\d+\.\d+$/).required(),
    domain: Joi.string().required(),
    author: Joi.string().required(),
    description: Joi.string().required(),
    icon: Joi.string().optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    license: Joi.string().optional(),
    homepage: Joi.string().uri().optional()
});

// Input/Output field schema
const fieldSchema = Joi.object({
    type: Joi.string().valid(
        'string', 'number', 'boolean', 'array', 'object', 
        'date', 'file', 'image', 'json', 'xml'
    ).required(),
    required: Joi.boolean().default(false),
    description: Joi.string().required(),
    example: Joi.any().optional(),
    default: Joi.any().optional(),
    validation: Joi.object({
        min: Joi.number().optional(),
        max: Joi.number().optional(),
        pattern: Joi.string().optional(),
        enum: Joi.array().optional(),
        custom: Joi.string().optional() // Custom validation function as string
    }).optional()
});

// Engine schema definition
const schemaDefinition = Joi.object({
    inputs: Joi.object().pattern(Joi.string(), fieldSchema).required(),
    outputs: Joi.object().pattern(Joi.string(), fieldSchema).required(),
    errors: Joi.object().pattern(
        Joi.string(),
        Joi.object({
            code: Joi.string().required(),
            message: Joi.string().required(),
            retryable: Joi.boolean().default(false)
        })
    ).optional()
});

// Engine configuration schema
const configSchema = Joi.object({
    timeout: Joi.number().min(0).default(30000),
    retries: Joi.number().min(0).default(3),
    cache: Joi.boolean().default(true),
    cacheTTL: Joi.number().min(0).default(3600),
    rateLimit: Joi.object({
        enabled: Joi.boolean().default(false),
        maxRequests: Joi.number().min(1).default(100),
        windowMs: Joi.number().min(1000).default(60000)
    }).optional(),
    dependencies: Joi.array().items(Joi.string()).optional(),
    environment: Joi.object().pattern(Joi.string(), Joi.string()).optional()
});

// Complete engine definition schema
const engineDefinitionSchema = Joi.object({
    metadata: metadataSchema.required(),
    schema: schemaDefinition.required(),
    config: configSchema.optional(),
    code: Joi.string().optional(),
    methods: Joi.object({
        initialize: Joi.string().optional(),
        validate: Joi.string().optional(),
        process: Joi.string().required(),
        destroy: Joi.string().optional(),
        healthCheck: Joi.string().optional()
    }).optional(),
    hooks: Joi.object({
        beforeProcess: Joi.string().optional(),
        afterProcess: Joi.string().optional(),
        onError: Joi.string().optional(),
        onSuccess: Joi.string().optional()
    }).optional(),
    tests: Joi.array().items(
        Joi.object({
            name: Joi.string().required(),
            input: Joi.object().required(),
            expectedOutput: Joi.object().required(),
            description: Joi.string().optional()
        })
    ).optional()
});

/**
 * Base Engine Interface
 */
class IUniversalEngine {
    constructor(definition) {
        this.definition = definition;
        this.metadata = definition.metadata;
        this.schema = definition.schema;
        this.config = definition.config || {};
        this.initialized = false;
    }

    /**
     * Initialize the engine
     */
    async initialize() {
        if (this.initialized) return;
        
        // Run custom initialization if provided
        if (this.definition.methods?.initialize) {
            await this.runMethod('initialize');
        }
        
        this.initialized = true;
    }

    /**
     * Validate input against schema
     */
    async validate(input) {
        const errors = [];
        const warnings = [];
        
        // Check required fields
        for (const [key, field] of Object.entries(this.schema.inputs)) {
            if (field.required && !(key in input)) {
                errors.push(`Missing required field: ${key}`);
            }
            
            // Type validation
            if (key in input) {
                const value = input[key];
                if (!this.validateType(value, field.type)) {
                    errors.push(`Invalid type for field ${key}: expected ${field.type}`);
                }
                
                // Custom validation
                if (field.validation) {
                    const validationResult = this.validateField(value, field.validation);
                    if (!validationResult.valid) {
                        errors.push(`Validation failed for ${key}: ${validationResult.error}`);
                    }
                }
            }
        }
        
        // Run custom validation if provided
        if (this.definition.methods?.validate) {
            const customResult = await this.runMethod('validate', input);
            if (customResult.errors) {
                errors.push(...customResult.errors);
            }
            if (customResult.warnings) {
                warnings.push(...customResult.warnings);
            }
        }
        
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Process input and generate output
     */
    async process(input) {
        if (!this.initialized) {
            await this.initialize();
        }
        
        // Run before hook
        if (this.definition.hooks?.beforeProcess) {
            await this.runHook('beforeProcess', input);
        }
        
        try {
            // Main processing logic
            let result;
            if (this.definition.methods?.process) {
                result = await this.runMethod('process', input);
            } else if (this.definition.code) {
                result = await this.runCode(this.definition.code, input);
            } else {
                throw new Error('No process method or code defined');
            }
            
            // Validate output
            const outputValidation = await this.validateOutput(result);
            if (!outputValidation.valid) {
                throw new Error(`Invalid output: ${outputValidation.errors.join(', ')}`);
            }
            
            // Run after hook
            if (this.definition.hooks?.afterProcess) {
                result = await this.runHook('afterProcess', result) || result;
            }
            
            // Run success hook
            if (this.definition.hooks?.onSuccess) {
                await this.runHook('onSuccess', result);
            }
            
            return result;
            
        } catch (error) {
            // Run error hook
            if (this.definition.hooks?.onError) {
                await this.runHook('onError', error);
            }
            throw error;
        }
    }

    /**
     * Destroy the engine and cleanup resources
     */
    async destroy() {
        if (this.definition.methods?.destroy) {
            await this.runMethod('destroy');
        }
        this.initialized = false;
    }

    /**
     * Health check
     */
    async healthCheck() {
        if (this.definition.methods?.healthCheck) {
            return await this.runMethod('healthCheck');
        }
        
        return {
            status: 'healthy',
            initialized: this.initialized,
            metadata: this.metadata
        };
    }

    /**
     * Validate field value
     */
    validateField(value, validation) {
        if (validation.min !== undefined && value < validation.min) {
            return { valid: false, error: `Value must be >= ${validation.min}` };
        }
        
        if (validation.max !== undefined && value > validation.max) {
            return { valid: false, error: `Value must be <= ${validation.max}` };
        }
        
        if (validation.pattern && !new RegExp(validation.pattern).test(value)) {
            return { valid: false, error: `Value does not match pattern ${validation.pattern}` };
        }
        
        if (validation.enum && !validation.enum.includes(value)) {
            return { valid: false, error: `Value must be one of: ${validation.enum.join(', ')}` };
        }
        
        if (validation.custom) {
            try {
                const customFunc = new Function('value', validation.custom);
                const result = customFunc(value);
                if (!result) {
                    return { valid: false, error: 'Custom validation failed' };
                }
            } catch (error) {
                return { valid: false, error: `Custom validation error: ${error.message}` };
            }
        }
        
        return { valid: true };
    }

    /**
     * Validate output against schema
     */
    async validateOutput(output) {
        const errors = [];
        
        for (const [key, field] of Object.entries(this.schema.outputs)) {
            if (field.required && !(key in output)) {
                errors.push(`Missing required output field: ${key}`);
            }
            
            if (key in output && !this.validateType(output[key], field.type)) {
                errors.push(`Invalid type for output field ${key}: expected ${field.type}`);
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate type
     */
    validateType(value, type) {
        switch (type) {
            case 'string':
                return typeof value === 'string';
            case 'number':
                return typeof value === 'number';
            case 'boolean':
                return typeof value === 'boolean';
            case 'array':
                return Array.isArray(value);
            case 'object':
                return typeof value === 'object' && !Array.isArray(value);
            case 'date':
                return value instanceof Date || !isNaN(Date.parse(value));
            case 'json':
                try {
                    JSON.parse(typeof value === 'string' ? value : JSON.stringify(value));
                    return true;
                } catch {
                    return false;
                }
            default:
                return true;
        }
    }

    /**
     * Run a method defined in the engine
     */
    async runMethod(methodName, ...args) {
        const methodCode = this.definition.methods[methodName];
        if (!methodCode) {
            throw new Error(`Method ${methodName} not defined`);
        }
        
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const method = new AsyncFunction('input', 'context', methodCode);
        return await method(...args, this);
    }

    /**
     * Run a hook
     */
    async runHook(hookName, data) {
        const hookCode = this.definition.hooks[hookName];
        if (!hookCode) return;
        
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const hook = new AsyncFunction('data', 'context', hookCode);
        return await hook(data, this);
    }

    /**
     * Run code
     */
    async runCode(code, input) {
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const func = new AsyncFunction('input', 'context', code);
        return await func(input, this);
    }

    /**
     * Get engine info
     */
    getInfo() {
        return {
            metadata: this.metadata,
            schema: this.schema,
            config: this.config,
            initialized: this.initialized
        };
    }

    /**
     * Run tests
     */
    async runTests() {
        if (!this.definition.tests || this.definition.tests.length === 0) {
            return { passed: 0, failed: 0, results: [] };
        }
        
        const results = [];
        let passed = 0;
        let failed = 0;
        
        for (const test of this.definition.tests) {
            try {
                const output = await this.process(test.input);
                const success = JSON.stringify(output) === JSON.stringify(test.expectedOutput);
                
                if (success) {
                    passed++;
                } else {
                    failed++;
                }
                
                results.push({
                    name: test.name,
                    success,
                    input: test.input,
                    expectedOutput: test.expectedOutput,
                    actualOutput: output
                });
            } catch (error) {
                failed++;
                results.push({
                    name: test.name,
                    success: false,
                    input: test.input,
                    expectedOutput: test.expectedOutput,
                    error: error.message
                });
            }
        }
        
        return { passed, failed, results };
    }
}

/**
 * Validate engine definition
 */
function validateEngineDefinition(definition) {
    const { error, value } = engineDefinitionSchema.validate(definition);
    if (error) {
        throw new Error(`Invalid engine definition: ${error.message}`);
    }
    return value;
}

/**
 * Create engine from definition
 */
function createEngine(definition) {
    const validated = validateEngineDefinition(definition);
    return new IUniversalEngine(validated);
}

module.exports = {
    IUniversalEngine,
    validateEngineDefinition,
    createEngine,
    schemas: {
        metadata: metadataSchema,
        field: fieldSchema,
        schema: schemaDefinition,
        config: configSchema,
        engineDefinition: engineDefinitionSchema
    }
};