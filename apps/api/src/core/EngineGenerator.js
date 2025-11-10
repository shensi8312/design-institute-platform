/**
 * Engine Generator
 * AI-powered engine creation from documents and examples
 */

const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const db = require('../config/database');
const { validateEngineDefinition } = require('./EngineDefinitionLanguage');
const { getEngineCore } = require('./EngineCore');
const logger = require('../utils/logger');

class EngineGenerator {
    constructor() {
        this.engineCore = getEngineCore();
        this.langExtractUrl = process.env.LANGEXTRACT_URL || 'http://localhost:8090';
        this.llmUrl = process.env.LLM_URL || 'http://localhost:11434'; // Ollama
    }

    /**
     * Generate engine from documents and description
     */
    async generateEngine(documents, description, options = {}) {
        logger.info(`Generating engine: ${description}`);
        
        try {
            // 1. Understand user intent
            const intent = await this.understandIntent(description);
            
            // 2. Extract patterns from documents
            const patterns = await this.extractPatternsFromDocuments(documents);
            
            // 3. Identify domain and context
            const domain = await this.identifyDomain(documents, description);
            
            // 4. Design engine structure
            const structure = await this.designEngineStructure({
                intent,
                patterns,
                domain
            });
            
            // 5. Generate processing logic
            const logic = await this.generateProcessingLogic(structure, patterns);
            
            // 6. Create engine definition
            const engineDefinition = await this.createEngineDefinition({
                structure,
                logic,
                description,
                domain
            });
            
            // 7. Test and validate
            const validation = await this.validateAndTest(engineDefinition, documents);
            
            // 8. Store as draft
            const engineId = await this.storeDraftEngine(engineDefinition, validation);
            
            return {
                engineId,
                definition: engineDefinition,
                validation,
                status: 'draft',
                requiresReview: true
            };
            
        } catch (error) {
            logger.error('Engine generation failed:', error);
            throw error;
        }
    }

    /**
     * Understand user intent from description
     */
    async understandIntent(description) {
        const prompt = `
        Analyze the following engine request and extract the intent:
        
        User Request: "${description}"
        
        Extract:
        1. Engine name (short, descriptive)
        2. Primary function (what it does)
        3. Expected inputs (what data it needs)
        4. Expected outputs (what it produces)
        5. Domain/Category (e.g., architecture, finance, healthcare)
        
        Return as JSON.
        `;
        
        const response = await this.callLLM(prompt);
        return JSON.parse(response);
    }

    /**
     * Extract patterns from documents using LangExtract
     */
    async extractPatternsFromDocuments(documents) {
        const patterns = {
            inputs: new Set(),
            outputs: new Set(),
            rules: [],
            calculations: [],
            constraints: [],
            entities: [],
            relationships: []
        };
        
        for (const doc of documents) {
            try {
                // Use LangExtract to analyze document
                const extraction = await this.callLangExtract(doc);
                
                // Extract inputs/outputs
                if (extraction.parameters) {
                    extraction.parameters.forEach(param => {
                        patterns.inputs.add({
                            name: param.name,
                            type: param.type,
                            description: param.description,
                            example: param.example
                        });
                    });
                }
                
                // Extract rules and constraints
                if (extraction.rules) {
                    patterns.rules.push(...extraction.rules);
                }
                
                // Extract calculations and formulas
                if (extraction.formulas) {
                    patterns.calculations.push(...extraction.formulas);
                }
                
                // Extract entities and relationships
                if (extraction.entities) {
                    patterns.entities.push(...extraction.entities);
                }
                
                if (extraction.relationships) {
                    patterns.relationships.push(...extraction.relationships);
                }
                
            } catch (error) {
                logger.warn(`Failed to extract patterns from document: ${error.message}`);
            }
        }
        
        // Convert sets to arrays
        patterns.inputs = Array.from(patterns.inputs);
        patterns.outputs = Array.from(patterns.outputs);
        
        return patterns;
    }

    /**
     * Call LangExtract service
     */
    async callLangExtract(document) {
        try {
            const response = await axios.post(`${this.langExtractUrl}/api/extract`, {
                document: document.content || document,
                extractionType: 'comprehensive',
                options: {
                    extractRules: true,
                    extractFormulas: true,
                    extractEntities: true,
                    extractRelationships: true,
                    extractParameters: true
                }
            });
            
            return response.data;
        } catch (error) {
            // Fallback to basic extraction
            return this.basicPatternExtraction(document);
        }
    }

    /**
     * Basic pattern extraction (fallback)
     */
    async basicPatternExtraction(document) {
        const text = typeof document === 'string' ? document : document.content;
        
        const prompt = `
        Extract patterns from the following document:
        
        ${text.substring(0, 3000)}
        
        Identify:
        1. Input parameters (what data is needed)
        2. Output results (what is produced)
        3. Rules or conditions (if-then statements)
        4. Calculations or formulas
        5. Key entities and their relationships
        
        Return as structured JSON.
        `;
        
        const response = await this.callLLM(prompt);
        return JSON.parse(response);
    }

    /**
     * Identify domain from documents
     */
    async identifyDomain(documents, description) {
        const sampleText = documents.slice(0, 3)
            .map(d => typeof d === 'string' ? d : d.content)
            .join('\n')
            .substring(0, 2000);
        
        const prompt = `
        Based on the description and document samples, identify the domain:
        
        Description: ${description}
        
        Sample content:
        ${sampleText}
        
        Return the domain category (e.g., architecture, finance, healthcare, manufacturing, etc.)
        `;
        
        const response = await this.callLLM(prompt);
        return response.trim().toLowerCase();
    }

    /**
     * Design engine structure
     */
    async designEngineStructure({ intent, patterns, domain }) {
        // Combine all information to design structure
        const structure = {
            name: intent.engineName || 'Custom Engine',
            domain: domain,
            inputs: {},
            outputs: {},
            rules: [],
            calculations: []
        };
        
        // Process inputs
        for (const input of patterns.inputs || []) {
            structure.inputs[input.name || `input_${Object.keys(structure.inputs).length}`] = {
                type: this.inferType(input.type || input.example),
                required: true,
                description: input.description || 'Input parameter',
                example: input.example
            };
        }
        
        // Process outputs
        for (const output of patterns.outputs || []) {
            structure.outputs[output.name || `output_${Object.keys(structure.outputs).length}`] = {
                type: this.inferType(output.type || output.example),
                description: output.description || 'Output result'
            };
        }
        
        // Process rules
        structure.rules = patterns.rules || [];
        
        // Process calculations
        structure.calculations = patterns.calculations || [];
        
        return structure;
    }

    /**
     * Generate processing logic
     */
    async generateProcessingLogic(structure, patterns) {
        const prompt = `
        Generate JavaScript processing logic for an engine with the following structure:
        
        Inputs: ${JSON.stringify(structure.inputs)}
        Outputs: ${JSON.stringify(structure.outputs)}
        Rules: ${JSON.stringify(structure.rules)}
        Calculations: ${JSON.stringify(structure.calculations)}
        
        Generate a process function that:
        1. Validates inputs
        2. Applies rules
        3. Performs calculations
        4. Returns outputs
        
        Return only the function body (async JavaScript code).
        `;
        
        const response = await this.callLLM(prompt);
        
        // Clean and validate the generated code
        const code = this.cleanGeneratedCode(response);
        
        return {
            processCode: code,
            validationCode: this.generateValidationCode(structure),
            optimizationCode: this.generateOptimizationCode(structure)
        };
    }

    /**
     * Create engine definition
     */
    async createEngineDefinition({ structure, logic, description, domain }) {
        const definition = {
            metadata: {
                id: uuidv4(),
                name: structure.name,
                version: '1.0.0',
                domain: domain,
                author: 'AI Generator',
                description: description,
                icon: this.getIconForDomain(domain),
                tags: this.getTagsForDomain(domain),
                generatedAt: new Date().toISOString()
            },
            schema: {
                inputs: structure.inputs,
                outputs: structure.outputs
            },
            config: {
                timeout: 30000,
                retries: 3,
                cache: true,
                cacheTTL: 3600
            },
            code: logic.processCode,
            methods: {
                validate: logic.validationCode,
                process: logic.processCode,
                optimize: logic.optimizationCode
            },
            tests: this.generateTests(structure)
        };
        
        // Validate the definition
        validateEngineDefinition(definition);
        
        return definition;
    }

    /**
     * Validate and test engine
     */
    async validateAndTest(engineDefinition, documents) {
        const results = {
            syntaxValid: true,
            testsRun: 0,
            testsPassed: 0,
            testsFailed: 0,
            errors: [],
            warnings: []
        };
        
        try {
            // Check syntax
            new Function('return ' + engineDefinition.code);
            
            // Run tests if available
            if (engineDefinition.tests && engineDefinition.tests.length > 0) {
                for (const test of engineDefinition.tests) {
                    results.testsRun++;
                    try {
                        // Create temporary engine instance
                        const testEngine = {
                            process: new Function('input', engineDefinition.code)
                        };
                        
                        const output = await testEngine.process(test.input);
                        
                        if (JSON.stringify(output) === JSON.stringify(test.expectedOutput)) {
                            results.testsPassed++;
                        } else {
                            results.testsFailed++;
                            results.warnings.push(`Test '${test.name}' produced unexpected output`);
                        }
                    } catch (error) {
                        results.testsFailed++;
                        results.errors.push(`Test '${test.name}' failed: ${error.message}`);
                    }
                }
            }
        } catch (error) {
            results.syntaxValid = false;
            results.errors.push(`Syntax error: ${error.message}`);
        }
        
        results.confidence = this.calculateConfidence(results);
        
        return results;
    }

    /**
     * Store draft engine
     */
    async storeDraftEngine(engineDefinition, validation) {
        const engineId = engineDefinition.metadata.id;
        
        await db('draft_engines').insert({
            id: engineId,
            name: engineDefinition.metadata.name,
            domain: engineDefinition.metadata.domain,
            definition: JSON.stringify(engineDefinition),
            validation_results: JSON.stringify(validation),
            confidence: validation.confidence,
            status: 'draft',
            auto_generated: true,
            created_at: new Date()
        });
        
        logger.info(`Draft engine stored: ${engineDefinition.metadata.name} (${engineId})`);
        
        return engineId;
    }

    /**
     * Call LLM for text generation
     */
    async callLLM(prompt) {
        try {
            const response = await axios.post(`${this.llmUrl}/api/generate`, {
                model: 'qwen2.5:latest',
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.7,
                    top_p: 0.9
                }
            });
            
            return response.data.response;
        } catch (error) {
            logger.error('LLM call failed:', error);
            throw new Error('Failed to generate content');
        }
    }

    /**
     * Infer data type from value or description
     */
    inferType(value) {
        if (typeof value === 'number') return 'number';
        if (typeof value === 'boolean') return 'boolean';
        if (Array.isArray(value)) return 'array';
        if (value instanceof Date) return 'date';
        if (typeof value === 'object') return 'object';
        return 'string';
    }

    /**
     * Clean generated code
     */
    cleanGeneratedCode(code) {
        // Remove markdown code blocks if present
        code = code.replace(/```javascript\n?/g, '').replace(/```\n?/g, '');
        
        // Ensure it's async function body
        if (!code.includes('return')) {
            code += '\nreturn input;';
        }
        
        return code.trim();
    }

    /**
     * Generate validation code
     */
    generateValidationCode(structure) {
        const validations = [];
        
        for (const [key, field] of Object.entries(structure.inputs)) {
            if (field.required) {
                validations.push(`if (!input.${key}) errors.push('Missing required field: ${key}');`);
            }
            if (field.type === 'number') {
                validations.push(`if (typeof input.${key} !== 'number') errors.push('${key} must be a number');`);
            }
        }
        
        return `
            const errors = [];
            ${validations.join('\n            ')}
            return { valid: errors.length === 0, errors };
        `;
    }

    /**
     * Generate optimization code
     */
    generateOptimizationCode(structure) {
        return `
            // Optimization logic
            // TODO: Implement domain-specific optimizations
            return result;
        `;
    }

    /**
     * Get icon for domain
     */
    getIconForDomain(domain) {
        const icons = {
            architecture: '🏗️',
            finance: '💰',
            healthcare: '🏥',
            education: '📚',
            manufacturing: '🏭',
            retail: '🛍️',
            logistics: '🚚',
            entertainment: '🎮',
            default: '⚙️'
        };
        return icons[domain] || icons.default;
    }

    /**
     * Get tags for domain
     */
    getTagsForDomain(domain) {
        const tagMap = {
            architecture: ['building', 'design', 'construction', 'CAD'],
            finance: ['banking', 'investment', 'accounting', 'trading'],
            healthcare: ['medical', 'diagnosis', 'treatment', 'patient'],
            education: ['learning', 'teaching', 'curriculum', 'assessment'],
            manufacturing: ['production', 'quality', 'assembly', 'inventory'],
            default: ['custom', 'ai-generated']
        };
        return tagMap[domain] || tagMap.default;
    }

    /**
     * Generate tests for engine
     */
    generateTests(structure) {
        const tests = [];
        
        // Generate a basic test
        const testInput = {};
        for (const [key, field] of Object.entries(structure.inputs)) {
            testInput[key] = field.example || this.generateExampleValue(field.type);
        }
        
        const testOutput = {};
        for (const [key, field] of Object.entries(structure.outputs)) {
            testOutput[key] = this.generateExampleValue(field.type);
        }
        
        tests.push({
            name: 'Basic functionality test',
            input: testInput,
            expectedOutput: testOutput,
            description: 'Tests basic input/output processing'
        });
        
        return tests;
    }

    /**
     * Generate example value for type
     */
    generateExampleValue(type) {
        switch (type) {
            case 'number':
                return 42;
            case 'boolean':
                return true;
            case 'array':
                return [];
            case 'object':
                return {};
            case 'date':
                return new Date().toISOString();
            default:
                return 'example';
        }
    }

    /**
     * Calculate confidence score
     */
    calculateConfidence(validation) {
        let confidence = 0;
        
        if (validation.syntaxValid) confidence += 40;
        if (validation.testsRun > 0) {
            const testScore = (validation.testsPassed / validation.testsRun) * 40;
            confidence += testScore;
        }
        if (validation.errors.length === 0) confidence += 10;
        if (validation.warnings.length === 0) confidence += 10;
        
        return Math.round(confidence);
    }

    /**
     * Learn from feedback
     */
    async learnFromFeedback(engineId, feedback) {
        // Store feedback for future improvements
        await db('engine_feedback').insert({
            engine_id: engineId,
            feedback_type: feedback.type,
            feedback_content: JSON.stringify(feedback.content),
            created_at: new Date()
        });
        
        // TODO: Implement learning mechanism
        logger.info(`Feedback recorded for engine ${engineId}`);
    }
}

// Singleton instance
let instance = null;

module.exports = {
    getEngineGenerator: () => {
        if (!instance) {
            instance = new EngineGenerator();
        }
        return instance;
    },
    EngineGenerator
};