/**
 * Rules Engine Adapter
 * Transforms the existing RulesEngine into a standard Universal Engine
 */

const RulesEngine = require('../services/system/RulesEngineService');
const { IUniversalEngine } = require('../core/EngineDefinitionLanguage');

// Rules Engine Definition
const rulesEngineDefinition = {
    metadata: {
        id: 'rules-engine-v1',
        name: 'Building Rules Compliance Engine',
        version: '1.0.0',
        domain: 'architecture',
        author: 'System',
        description: 'Checks building designs against regulatory rules and standards',
        icon: '🏗️',
        tags: ['compliance', 'building-codes', 'regulations', 'validation']
    },
    
    schema: {
        inputs: {
            design: {
                type: 'object',
                required: true,
                description: 'Building design parameters',
                example: {
                    buildingType: 'high_rise',
                    height: 120,
                    floors: 30,
                    occupancy: 'residential',
                    area: 5000
                }
            },
            standards: {
                type: 'array',
                required: false,
                description: 'Specific standards to check against',
                example: ['GB50016-2014', 'GB50352-2019']
            },
            checkLevel: {
                type: 'string',
                required: false,
                description: 'Level of compliance checking',
                example: 'strict',
                validation: {
                    enum: ['basic', 'standard', 'strict']
                }
            }
        },
        
        outputs: {
            compliant: {
                type: 'boolean',
                description: 'Whether the design is compliant'
            },
            violations: {
                type: 'array',
                description: 'List of rule violations found'
            },
            warnings: {
                type: 'array',
                description: 'List of warnings or recommendations'
            },
            checkedRules: {
                type: 'number',
                description: 'Total number of rules checked'
            },
            complianceScore: {
                type: 'number',
                description: 'Compliance score (0-100)'
            },
            suggestions: {
                type: 'array',
                description: 'Suggestions for improving compliance'
            }
        }
    },
    
    config: {
        timeout: 30000,
        retries: 2,
        cache: true,
        cacheTTL: 7200,  // 2 hours
        rateLimit: {
            enabled: true,
            maxRequests: 100,
            windowMs: 60000
        }
    },
    
    methods: {
        initialize: `
            // Initialize rules database connection
            this.rulesEngine = new (require('../services/system/RulesEngineService'))();
            await this.rulesEngine.initialize();
            this.initialized = true;
        `,
        
        validate: `
            const errors = [];
            
            // Validate design object
            if (!input.design || typeof input.design !== 'object') {
                errors.push('Design must be a valid object');
            }
            
            // Validate building type
            if (input.design && !input.design.buildingType) {
                errors.push('Building type is required');
            }
            
            // Validate check level
            if (input.checkLevel && !['basic', 'standard', 'strict'].includes(input.checkLevel)) {
                errors.push('Check level must be basic, standard, or strict');
            }
            
            return { valid: errors.length === 0, errors };
        `,
        
        process: `
            // Get rules engine instance
            const rulesEngine = this.rulesEngine || new (require('../services/system/RulesEngineService'))();
            
            // Prepare parameters
            const checkParams = {
                ...input.design,
                standards: input.standards || [],
                level: input.checkLevel || 'standard'
            };
            
            // Run compliance check
            const result = await rulesEngine.checkCompliance(checkParams);
            
            // Calculate compliance score
            const totalRules = result.checkedRules || 0;
            const violations = result.violations || [];
            const score = totalRules > 0 
                ? Math.round((1 - violations.length / totalRules) * 100)
                : 100;
            
            // Generate suggestions
            const suggestions = violations.map(v => ({
                rule: v.rule,
                suggestion: v.suggestion || 'Review and adjust design parameters',
                priority: v.severity === 'critical' ? 'high' : 'medium'
            }));
            
            return {
                compliant: violations.length === 0,
                violations: violations,
                warnings: result.warnings || [],
                checkedRules: totalRules,
                complianceScore: score,
                suggestions: suggestions
            };
        `,
        
        destroy: `
            // Cleanup resources
            if (this.rulesEngine) {
                await this.rulesEngine.cleanup();
            }
            this.initialized = false;
        `
    },
    
    hooks: {
        beforeProcess: `
            console.log('Starting rules compliance check for:', data.design?.buildingType);
        `,
        
        afterProcess: `
            console.log('Compliance check completed. Score:', data.complianceScore);
            
            // Log critical violations
            const criticalViolations = data.violations?.filter(v => v.severity === 'critical');
            if (criticalViolations?.length > 0) {
                console.warn('Critical violations found:', criticalViolations.length);
            }
        `,
        
        onError: `
            console.error('Rules engine error:', data.message);
            // Could send to monitoring service
        `
    },
    
    tests: [
        {
            name: 'High-rise residential compliance',
            input: {
                design: {
                    buildingType: 'high_rise',
                    height: 100,
                    floors: 28,
                    occupancy: 'residential',
                    area: 4500,
                    hasFireElevator: true,
                    antroomArea: 8
                },
                checkLevel: 'standard'
            },
            expectedOutput: {
                compliant: true,
                violations: [],
                warnings: [],
                checkedRules: 25,
                complianceScore: 100,
                suggestions: []
            },
            description: 'Tests compliance for a standard high-rise residential building'
        },
        {
            name: 'Non-compliant design detection',
            input: {
                design: {
                    buildingType: 'high_rise',
                    height: 150,
                    floors: 40,
                    occupancy: 'residential',
                    area: 3000,
                    hasFireElevator: true,
                    antroomArea: 4  // Too small
                },
                checkLevel: 'strict'
            },
            expectedOutput: {
                compliant: false,
                violations: [
                    {
                        rule: 'FIRE_ELEVATOR_ANTEROOM',
                        message: 'Fire elevator anteroom area must be >= 6.0 sqm',
                        severity: 'critical',
                        currentValue: 4,
                        requiredValue: 6
                    }
                ],
                warnings: [],
                checkedRules: 30,
                complianceScore: 97,
                suggestions: [
                    {
                        rule: 'FIRE_ELEVATOR_ANTEROOM',
                        suggestion: 'Increase anteroom area to at least 6.0 sqm',
                        priority: 'high'
                    }
                ]
            },
            description: 'Tests detection of non-compliant design parameters'
        }
    ]
};

/**
 * Create Rules Engine instance
 */
class RulesEngineAdapter extends IUniversalEngine {
    constructor() {
        super(rulesEngineDefinition);
        this.rulesEngine = null;
    }
    
    async initialize() {
        if (!this.rulesEngine) {
            this.rulesEngine = new RulesEngine();
            await this.rulesEngine.initialize();
        }
        await super.initialize();
    }
    
    async process(input) {
        // Ensure rules engine is available
        if (!this.rulesEngine) {
            await this.initialize();
        }
        
        // Use the parent process method which will execute our defined process code
        return await super.process(input);
    }
}

/**
 * Export the engine definition and adapter
 */
module.exports = {
    rulesEngineDefinition,
    RulesEngineAdapter,
    
    // Factory function to create engine instance
    createRulesEngine: () => new RulesEngineAdapter(),
    
    // Register function for engine core
    registerRulesEngine: async (engineCore) => {
        return await engineCore.registerEngine(rulesEngineDefinition);
    }
};