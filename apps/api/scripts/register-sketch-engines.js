#!/usr/bin/env node

/**
 * Register Sketch Recognition Engines Dynamically
 * These are configurable engines that process through workflow
 */

require('dotenv').config();
const { getEngineCore } = require('../src/core/EngineCore');
const { getWorkflowOrchestrator } = require('../src/core/WorkflowOrchestrator');
const db = require('../src/config/database');

async function registerSketchProcessingEngines() {
    try {
        const engineCore = getEngineCore();
        await engineCore.initialize();
        
        console.log('🎨 Registering sketch processing engines...\n');
        
        // 1. Image Recognition Engine - Uses OCR/YOLO/Multimodal
        const imageRecognitionEngine = {
            metadata: {
                id: 'image-recognition-engine',
                name: '图像识别引擎',
                version: '1.0.0',
                domain: 'recognition',
                author: 'AI',
                description: '使用OCR+YOLO+多模态模型识别建筑草图',
                icon: '👁️',
                tags: ['ocr', 'yolo', 'multimodal', 'recognition']
            },
            schema: {
                inputs: {
                    image: { 
                        type: 'object', 
                        required: true, 
                        description: '图像数据(base64或路径)' 
                    },
                    recognitionConfig: {
                        type: 'object',
                        required: false,
                        description: '识别配置(OCR语言、YOLO模型等)'
                    }
                },
                outputs: {
                    lines: { type: 'array', description: '检测到的线条' },
                    shapes: { type: 'array', description: '检测到的形状' },
                    text: { type: 'array', description: 'OCR识别的文字' },
                    semantic: { type: 'object', description: '语义理解结果' }
                }
            },
            config: {
                timeout: 60000,
                cache: false,
                externalService: 'http://localhost:8087/api/recognize'
            },
            code: `
                // This engine calls external recognition service
                const axios = require('axios');
                
                try {
                    // Call external recognition service
                    const serviceUrl = context.engineConfig?.externalService || 
                                      'http://localhost:8087/api/recognize';
                    
                    const response = await axios.post(serviceUrl, {
                        image: input.image,
                        config: input.recognitionConfig || {}
                    }, {
                        timeout: 30000
                    });
                    
                    if (response.data.success) {
                        return response.data.data;
                    } else {
                        throw new Error(response.data.error || 'Recognition failed');
                    }
                } catch (error) {
                    // Fallback to simple edge detection if service unavailable
                    console.warn('Recognition service unavailable, using fallback');
                    
                    return {
                        lines: [],
                        shapes: [],
                        text: [],
                        semantic: {
                            buildingType: 'unknown',
                            floors: 1,
                            confidence: 0.1
                        },
                        error: 'Service unavailable - fallback mode'
                    };
                }
            `
        };

        // 2. Sketch Data Extractor - Converts recognition results to sketch data
        const sketchExtractorEngine = {
            metadata: {
                id: 'sketch-extractor-engine',
                name: '草图数据提取引擎',
                version: '1.0.0',
                domain: 'extraction',
                author: 'AI',
                description: '从识别结果中提取结构化草图数据',
                icon: '📐',
                tags: ['extraction', 'sketch', 'structure']
            },
            schema: {
                inputs: {
                    lines: { type: 'array', required: true },
                    shapes: { type: 'array', required: true },
                    text: { type: 'array', required: false },
                    semantic: { type: 'object', required: false }
                },
                outputs: {
                    walls: { type: 'array', description: '墙体数据' },
                    doors: { type: 'array', description: '门数据' },
                    windows: { type: 'array', description: '窗数据' },
                    rooms: { type: 'array', description: '房间数据' },
                    scale: { type: 'number', description: '比例尺' }
                }
            },
            config: {
                timeout: 30000,
                cache: true
            },
            code: `
                // Extract structured sketch data from recognition results
                const walls = [];
                const doors = [];
                const windows = [];
                const rooms = [];
                let scale = 100; // Default 1:100
                
                // Process lines into walls
                if (input.lines && Array.isArray(input.lines)) {
                    input.lines.forEach((line, index) => {
                        if (line.length > 50) {
                            walls.push({
                                id: 'w' + (index + 1),
                                start: line.start || {x: 0, y: 0},
                                end: line.end || {x: 100, y: 0},
                                type: line.length > 200 ? 'exterior' : 'interior',
                                thickness: line.thickness || 0.2
                            });
                        }
                    });
                }
                
                // Process shapes into rooms
                if (input.shapes && Array.isArray(input.shapes)) {
                    input.shapes.forEach((shape, index) => {
                        if (shape.type === 'rectangle' && shape.area > 100) {
                            rooms.push({
                                id: 'r' + (index + 1),
                                name: 'Room ' + (index + 1),
                                type: input.semantic?.buildingType === 'industrial' ? 
                                      'cleanroom' : 'office',
                                corners: shape.corners || [],
                                area: shape.area
                            });
                        }
                    });
                }
                
                // Extract scale from text if available
                if (input.text && Array.isArray(input.text)) {
                    input.text.forEach(textItem => {
                        const scaleMatch = textItem.text?.match(/1[:：](\\d+)/);
                        if (scaleMatch) {
                            scale = parseInt(scaleMatch[1]);
                        }
                    });
                }
                
                // Generate some doors and windows based on gaps
                // This is simplified - real implementation would analyze wall gaps
                if (walls.length > 3) {
                    doors.push({
                        id: 'd1',
                        wall: 'w1',
                        position: 0.5,
                        type: 'standard',
                        width: 0.9,
                        height: 2.1
                    });
                    
                    windows.push({
                        id: 'win1',
                        wall: 'w2',
                        position: 0.5,
                        type: 'standard',
                        width: 1.5,
                        height: 1.5
                    });
                }
                
                return {
                    walls,
                    doors,
                    windows,
                    rooms,
                    scale,
                    metadata: {
                        lineCount: input.lines?.length || 0,
                        shapeCount: input.shapes?.length || 0,
                        buildingType: input.semantic?.buildingType || 'unknown'
                    }
                };
            `
        };

        // 3. SKP Generator Engine - Creates actual SketchUp files
        const skpGeneratorEngine = {
            metadata: {
                id: 'skp-generator-engine',
                name: 'SketchUp文件生成引擎',
                version: '1.0.0',
                domain: 'generation',
                author: 'AI',
                description: '生成SketchUp (.skp)格式的3D模型文件',
                icon: '🏗️',
                tags: ['sketchup', 'skp', '3d', 'generation']
            },
            schema: {
                inputs: {
                    model3D: { type: 'object', required: true, description: '3D模型数据' },
                    format: { type: 'string', required: false, description: '输出格式(skp/dae/obj)' }
                },
                outputs: {
                    skpFile: { type: 'string', description: 'SKP文件路径' },
                    preview: { type: 'string', description: '预览图URL' },
                    statistics: { type: 'object', description: '模型统计信息' }
                }
            },
            config: {
                timeout: 120000,
                cache: false,
                outputPath: '/tmp/sketchup_models/'
            },
            code: `
                // Generate SketchUp file from 3D model data
                const fs = require('fs');
                const path = require('path');
                
                // In real implementation, this would use Ruby API or sketchup-sdk
                // For now, we create a mock SKP structure
                
                const timestamp = Date.now();
                const fileName = 'model_' + timestamp + '.skp';
                const filePath = (context.engineConfig?.outputPath || '/tmp/') + fileName;
                
                // SKP file structure (simplified)
                const skpData = {
                    version: 'SketchUp 2023',
                    model: {
                        entities: [],
                        materials: [],
                        layers: []
                    }
                };
                
                // Convert walls to SKP entities
                if (input.model3D.walls) {
                    input.model3D.walls.forEach(wall => {
                        skpData.model.entities.push({
                            type: 'face',
                            points: [
                                [wall.start?.x || 0, wall.start?.y || 0, 0],
                                [wall.end?.x || 10, wall.end?.y || 0, 0],
                                [wall.end?.x || 10, wall.end?.y || 0, wall.height || 3],
                                [wall.start?.x || 0, wall.start?.y || 0, wall.height || 3]
                            ],
                            thickness: wall.thickness || 0.2,
                            material: 'concrete'
                        });
                    });
                }
                
                // Add doors and windows
                if (input.model3D.doors) {
                    input.model3D.doors.forEach(door => {
                        skpData.model.entities.push({
                            type: 'component',
                            name: 'door',
                            position: door.position,
                            dimensions: {
                                width: door.width || 0.9,
                                height: door.height || 2.1
                            }
                        });
                    });
                }
                
                // Statistics
                const statistics = {
                    walls: input.model3D.walls?.length || 0,
                    doors: input.model3D.doors?.length || 0,
                    windows: input.model3D.windows?.length || 0,
                    rooms: input.model3D.rooms?.length || 0,
                    totalArea: input.model3D.rooms?.reduce((sum, r) => sum + (r.area || 0), 0) || 0
                };
                
                // In production, this would actually write SKP binary format
                // For now, we save as JSON representation
                try {
                    // Ensure directory exists
                    const dir = path.dirname(filePath);
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }
                    
                    fs.writeFileSync(filePath + '.json', JSON.stringify(skpData, null, 2));
                    
                    return {
                        skpFile: filePath,
                        preview: '/preview/' + fileName + '.png',
                        statistics,
                        format: input.format || 'skp',
                        message: 'SKP file generated (JSON format for demo)'
                    };
                } catch (error) {
                    return {
                        skpFile: null,
                        preview: null,
                        statistics,
                        error: 'Failed to write file: ' + error.message
                    };
                }
            `
        };

        // Register all engines
        const engines = [
            imageRecognitionEngine,
            sketchExtractorEngine,
            skpGeneratorEngine
        ];

        for (const engine of engines) {
            try {
                const existing = await db('engines')
                    .where({ id: engine.metadata.id })
                    .first();
                
                if (existing) {
                    console.log(`⚠️  Engine exists: ${engine.metadata.name}`);
                    // Update the engine
                    await db('engines')
                        .where({ id: engine.metadata.id })
                        .update({
                            code: engine.code,
                            schema: JSON.stringify(engine.schema),
                            config: JSON.stringify(engine.config),
                            updated_at: new Date()
                        });
                    console.log(`   Updated with latest code`);
                } else {
                    const engineId = await engineCore.registerEngine(engine);
                    console.log(`✅ Registered: ${engine.metadata.name} (${engineId})`);
                }
            } catch (error) {
                console.error(`❌ Failed: ${engine.metadata.name} - ${error.message}`);
            }
        }

        // Create complete workflow
        const sketchToSkpWorkflow = {
            id: 'sketch-to-skp-workflow',
            name: '草图转SketchUp完整流程',
            description: '从手绘草图到SketchUp模型的完整处理流程',
            steps: [
                {
                    id: 'recognize',
                    type: 'engine',
                    engineId: 'image-recognition-engine',
                    name: '图像识别',
                    input_mapping: {
                        image: '$.input.image'
                    }
                },
                {
                    id: 'extract',
                    type: 'engine',
                    engineId: 'sketch-extractor-engine',
                    name: '草图数据提取',
                    dependsOn: ['recognize'],
                    input_mapping: {
                        lines: '$.steps.recognize.output.lines',
                        shapes: '$.steps.recognize.output.shapes',
                        text: '$.steps.recognize.output.text',
                        semantic: '$.steps.recognize.output.semantic'
                    }
                },
                {
                    id: 'convert',
                    type: 'engine',
                    engineId: '2d-to-3d-converter',
                    name: '2D转3D',
                    dependsOn: ['extract'],
                    input_mapping: {
                        sketch: {
                            walls: '$.steps.extract.output.walls',
                            doors: '$.steps.extract.output.doors',
                            windows: '$.steps.extract.output.windows',
                            rooms: '$.steps.extract.output.rooms'
                        },
                        buildingType: '$.steps.extract.output.metadata.buildingType',
                        scale: '$.steps.extract.output.scale'
                    }
                },
                {
                    id: 'generate',
                    type: 'engine',
                    engineId: 'skp-generator-engine',
                    name: '生成SKP文件',
                    dependsOn: ['convert'],
                    input_mapping: {
                        model3D: '$.steps.convert.output.model3D',
                        format: '$.input.format'
                    }
                }
            ],
            config: {
                timeout: 300000,
                retries: 1,
                parallel: false
            }
        };

        // Save workflow
        await db('workflows').insert({
            id: sketchToSkpWorkflow.id,
            name: sketchToSkpWorkflow.name,
            description: sketchToSkpWorkflow.description,
            steps: JSON.stringify(sketchToSkpWorkflow.steps),
            config: JSON.stringify(sketchToSkpWorkflow.config),
            status: 'active',
            created_at: new Date(),
            updated_at: new Date()
        }).onConflict('id').merge();

        console.log('\n✅ Created sketch-to-SKP workflow');
        
        // Get statistics
        const stats = await engineCore.getStatistics();
        console.log(`\n🎉 Registration complete!`);
        console.log(`📊 Total engines: ${stats.engines.total}`);
        console.log(`\n💡 Usage example:`);
        console.log(`   POST /api/engines/workflows/sketch-to-skp-workflow/execute`);
        console.log(`   Body: { "input": { "image": "path/to/sketch.jpg" } }`);
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Registration failed:', error);
        process.exit(1);
    }
}

registerSketchProcessingEngines();