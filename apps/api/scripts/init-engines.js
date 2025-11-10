#!/usr/bin/env node

/**
 * Engine Initialization Script
 * Run this to register initial engines to the platform
 * Usage: node scripts/init-engines.js [--mode=architecture|fortune|medical]
 */

require('dotenv').config();
const { getEngineCore } = require('../src/core/EngineCore');
const { rulesEngineDefinition } = require('../src/engines/RulesEngineAdapter');
const { simpleTarotEngineDefinition, tarotProcess } = require('../src/engines/SimpleTarotEngine');
const db = require('../src/config/database');

// Parse command line arguments
const args = process.argv.slice(2);
const mode = args.find(arg => arg.startsWith('--mode='))?.split('=')[1] || 'demo';

console.log(`🚀 Initializing engines for mode: ${mode}`);

async function initEngines() {
    try {
        // Initialize engine core
        const engineCore = getEngineCore();
        await engineCore.initialize();
        
        // Check existing engines
        const existingEngines = await engineCore.listEngines();
        console.log(`📊 Found ${existingEngines.length} existing engines`);
        
        // Define engines based on mode
        let enginesToRegister = [];
        
        switch (mode) {
            case 'architecture':
                enginesToRegister = [
                    rulesEngineDefinition,
                    createSpatialEngine(),
                    createCostEstimationEngine()
                ];
                break;
                
            case 'fortune':
                enginesToRegister = [
                    { ...simpleTarotEngineDefinition, processFunction: tarotProcess },
                    createAstrologyEngine(),
                    createNumerologyEngine()
                ];
                break;
                
            case 'medical':
                enginesToRegister = [
                    createSymptomAnalysisEngine(),
                    createDiagnosisEngine(),
                    createTreatmentEngine()
                ];
                break;
                
            case 'demo':
            default:
                // Register one from each domain to show versatility
                enginesToRegister = [
                    rulesEngineDefinition,
                    { ...simpleTarotEngineDefinition, processFunction: tarotProcess }
                ];
                break;
        }
        
        // Register engines
        for (const engine of enginesToRegister) {
            try {
                // Check if engine already exists
                const existing = existingEngines.find(e => 
                    e.name === engine.metadata.name && 
                    e.version === engine.metadata.version
                );
                
                if (existing) {
                    console.log(`⚠️  Engine already exists: ${engine.metadata.name}`);
                    continue;
                }
                
                const engineId = await engineCore.registerEngine(engine);
                console.log(`✅ Registered: ${engine.metadata.name} (${engineId})`);
            } catch (error) {
                console.error(`❌ Failed to register ${engine.metadata.name}:`, error.message);
            }
        }
        
        // Final statistics
        const stats = await engineCore.getStatistics();
        console.log(`\n🎉 Initialization complete!`);
        console.log(`📊 Total engines: ${stats.engines.total}`);
        console.log(`✨ Active engines: ${stats.engines.active}`);
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Initialization failed:', error);
        process.exit(1);
    }
}

// Helper functions to create engine definitions

function createSpatialEngine() {
    return {
        metadata: {
            id: 'spatial-engine-v1',
            name: 'Spatial Layout Engine',
            version: '1.0.0',
            domain: 'architecture',
            author: 'System',
            description: 'Generates optimal spatial layouts for buildings',
            icon: '📍',
            tags: ['architecture', 'layout', 'spatial', 'optimization']
        },
        schema: {
            inputs: {
                requirements: {
                    type: 'object',
                    required: true,
                    description: 'Space requirements'
                }
            },
            outputs: {
                layout: {
                    type: 'object',
                    description: 'Generated layout'
                }
            }
        },
        config: { timeout: 30000 },
        processFunction: async (input) => {
            // Simplified spatial generation
            return {
                layout: {
                    rooms: [],
                    corridors: [],
                    optimization_score: 0.85
                }
            };
        }
    };
}

function createCostEstimationEngine() {
    return {
        metadata: {
            id: 'cost-estimation-v1',
            name: 'Cost Estimation Engine',
            version: '1.0.0',
            domain: 'architecture',
            author: 'System',
            description: 'Estimates construction costs',
            icon: '💰',
            tags: ['cost', 'estimation', 'budget']
        },
        schema: {
            inputs: {
                design: { type: 'object', required: true, description: 'Design parameters' }
            },
            outputs: {
                cost: { type: 'number', description: 'Estimated cost' },
                breakdown: { type: 'object', description: 'Cost breakdown' }
            }
        },
        config: { timeout: 10000 },
        processFunction: async (input) => {
            return {
                cost: Math.random() * 1000000 + 500000,
                breakdown: {
                    materials: 0.4,
                    labor: 0.3,
                    equipment: 0.2,
                    overhead: 0.1
                }
            };
        }
    };
}

function createAstrologyEngine() {
    return {
        metadata: {
            id: 'astrology-engine-v1',
            name: 'Astrology Engine',
            version: '1.0.0',
            domain: 'divination',
            author: 'AI',
            description: 'Astrological chart analysis',
            icon: '✨',
            tags: ['astrology', 'zodiac', 'horoscope']
        },
        schema: {
            inputs: {
                birthDate: { type: 'date', required: true, description: 'Birth date' },
                birthTime: { type: 'string', required: false, description: 'Birth time' }
            },
            outputs: {
                sign: { type: 'string', description: 'Zodiac sign' },
                chart: { type: 'object', description: 'Astrological chart' }
            }
        },
        config: { timeout: 5000 },
        processFunction: async (input) => {
            const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 
                          'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
            return {
                sign: signs[Math.floor(Math.random() * signs.length)],
                chart: { sun: 'Leo', moon: 'Cancer', rising: 'Gemini' }
            };
        }
    };
}

function createNumerologyEngine() {
    return {
        metadata: {
            id: 'numerology-engine-v1',
            name: 'Numerology Engine',
            version: '1.0.0',
            domain: 'divination',
            author: 'AI',
            description: 'Numerological analysis',
            icon: '🔢',
            tags: ['numerology', 'numbers', 'life-path']
        },
        schema: {
            inputs: {
                name: { type: 'string', required: true, description: 'Full name' },
                birthDate: { type: 'date', required: true, description: 'Birth date' }
            },
            outputs: {
                lifePathNumber: { type: 'number', description: 'Life path number' },
                interpretation: { type: 'string', description: 'Interpretation' }
            }
        },
        config: { timeout: 3000 },
        processFunction: async (input) => {
            const num = Math.floor(Math.random() * 9) + 1;
            return {
                lifePathNumber: num,
                interpretation: `Your life path number ${num} indicates leadership and independence.`
            };
        }
    };
}

function createSymptomAnalysisEngine() {
    return {
        metadata: {
            id: 'symptom-analysis-v1',
            name: 'Symptom Analysis Engine',
            version: '1.0.0',
            domain: 'healthcare',
            author: 'Medical AI',
            description: 'Analyzes medical symptoms',
            icon: '🤒',
            tags: ['medical', 'symptoms', 'analysis']
        },
        schema: {
            inputs: {
                symptoms: { type: 'array', required: true, description: 'List of symptoms' }
            },
            outputs: {
                analysis: { type: 'object', description: 'Symptom analysis' }
            }
        },
        config: { timeout: 10000 },
        processFunction: async (input) => {
            return {
                analysis: {
                    severity: 'moderate',
                    possibleConditions: ['Common cold', 'Flu'],
                    recommendation: 'Rest and hydration recommended'
                }
            };
        }
    };
}

function createDiagnosisEngine() {
    return {
        metadata: {
            id: 'diagnosis-engine-v1',
            name: 'Diagnosis Engine',
            version: '1.0.0',
            domain: 'healthcare',
            author: 'Medical AI',
            description: 'Medical diagnosis assistant',
            icon: '🧑‍⚕️',
            tags: ['medical', 'diagnosis', 'health']
        },
        schema: {
            inputs: {
                symptoms: { type: 'array', required: true },
                history: { type: 'object', required: false }
            },
            outputs: {
                diagnosis: { type: 'object', description: 'Diagnostic results' }
            }
        },
        config: { timeout: 15000 },
        processFunction: async (input) => {
            return {
                diagnosis: {
                    conditions: [{ name: 'Common Cold', probability: 0.7 }],
                    tests_recommended: ['Blood test'],
                    urgency: 'low'
                }
            };
        }
    };
}

function createTreatmentEngine() {
    return {
        metadata: {
            id: 'treatment-engine-v1',
            name: 'Treatment Recommendation Engine',
            version: '1.0.0',
            domain: 'healthcare',
            author: 'Medical AI',
            description: 'Recommends treatment plans',
            icon: '💊',
            tags: ['medical', 'treatment', 'recommendation']
        },
        schema: {
            inputs: {
                diagnosis: { type: 'object', required: true }
            },
            outputs: {
                treatment: { type: 'object', description: 'Treatment plan' }
            }
        },
        config: { timeout: 10000 },
        processFunction: async (input) => {
            return {
                treatment: {
                    medications: [],
                    lifestyle: ['Rest', 'Hydration'],
                    followUp: '1 week'
                }
            };
        }
    };
}

// Run initialization
initEngines();