#!/usr/bin/env node

/**
 * Test 2D to 3D Conversion Engine
 * Simulates converting a hand-drawn sketch to 3D model
 */

const axios = require('axios');

const API_URL = 'http://localhost:3000/api';

async function test2DTo3D() {
    console.log('🎨 Testing 2D to 3D conversion engine...\n');
    
    // Simulate sketch data from hand-drawn input
    const sketchData = {
        sketch: {
            walls: [
                { id: 'w1', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, type: 'exterior' },
                { id: 'w2', start: { x: 10, y: 0 }, end: { x: 10, y: 8 }, type: 'exterior' },
                { id: 'w3', start: { x: 10, y: 8 }, end: { x: 0, y: 8 }, type: 'exterior' },
                { id: 'w4', start: { x: 0, y: 8 }, end: { x: 0, y: 0 }, type: 'exterior' },
                { id: 'w5', start: { x: 5, y: 0 }, end: { x: 5, y: 8 }, type: 'interior' }
            ],
            doors: [
                { id: 'd1', wall: 'w1', position: 0.5, type: 'standard' },
                { id: 'd2', wall: 'w5', position: 0.3, type: 'cleanroom' }
            ],
            windows: [
                { id: 'win1', wall: 'w2', position: 0.5, type: 'cleanroom' },
                { id: 'win2', wall: 'w3', position: 0.3, type: 'observation' }
            ],
            rooms: [
                { id: 'r1', name: '洁净室A', type: 'cleanroom', corners: [[0,0], [5,0], [5,8], [0,8]] },
                { id: 'r2', name: '设备间', type: 'technical', corners: [[5,0], [10,0], [10,8], [5,8]] }
            ]
        },
        buildingType: 'cleanroom',
        scale: 100  // 1:100 scale
    };
    
    try {
        // Execute the 2D to 3D engine
        console.log('📐 Input sketch data:');
        console.log(`  - Walls: ${sketchData.sketch.walls.length}`);
        console.log(`  - Doors: ${sketchData.sketch.doors.length}`);
        console.log(`  - Windows: ${sketchData.sketch.windows.length}`);
        console.log(`  - Rooms: ${sketchData.sketch.rooms.length}`);
        console.log(`  - Building type: ${sketchData.buildingType}`);
        console.log(`  - Scale: 1:${sketchData.scale}\n`);
        
        const response = await axios.post(`${API_URL}/engines/2d-to-3d-converter/execute`, {
            input: sketchData,
            context: {
                project: 'Test Fab Project',
                user: 'Test User'
            }
        });
        
        console.log('✅ Conversion successful!\n');
        console.log('📊 Output 3D model:');
        
        const result = response.data.data;
        console.log(`  - 3D Walls: ${result.model3D?.walls?.length || 0}`);
        console.log(`  - 3D Doors: ${result.model3D?.doors?.length || 0}`);
        console.log(`  - 3D Windows: ${result.model3D?.windows?.length || 0}`);
        console.log(`  - Grid system: ${JSON.stringify(result.model3D?.grid)}`);
        console.log(`  - SketchUp file: ${result.skpFile}`);
        console.log(`\n📋 Applied rules:`);
        result.rules?.forEach(rule => console.log(`  - ${rule}`));
        
        console.log('\n🏗️ Wall details:');
        result.model3D?.walls?.slice(0, 2).forEach(wall => {
            console.log(`  Wall ${wall.id}: thickness=${wall.thickness}m, height=${wall.height}m`);
        });
        
        console.log('\n🚪 Door specifications:');
        result.model3D?.doors?.forEach(door => {
            console.log(`  Door ${door.id}: width=${door.width}m, height=${door.height}m`);
        });
        
        return result;
        
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

async function testWorkflow() {
    console.log('\n\n🔄 Testing complete Fab workflow...\n');
    
    try {
        const workflowInput = {
            sketch: {
                walls: [
                    { id: 'w1', start: { x: 0, y: 0 }, end: { x: 20, y: 0 }, type: 'exterior' }
                ],
                rooms: [
                    { id: 'r1', name: 'Main Cleanroom', type: 'cleanroom' }
                ]
            },
            buildingType: 'cleanroom',
            cleanliness: 'ISO5',
            area: 500,
            processType: 'semiconductor',
            processNode: '14nm',
            waferSize: 300,
            throughput: 5000
        };
        
        const response = await axios.post(`${API_URL}/engines/workflows/fab-design-workflow/execute`, {
            input: workflowInput,
            context: {
                project: 'Complete Fab Design',
                mode: 'full-analysis'
            }
        });
        
        console.log('✅ Workflow execution successful!');
        console.log('\n📊 Workflow results:');
        
        const results = response.data.data;
        
        // Show results from each step
        if (results.steps) {
            Object.entries(results.steps).forEach(([stepId, result]) => {
                console.log(`\n  ${stepId}:`);
                console.log(`    Status: ${result.status || 'completed'}`);
                if (result.output) {
                    console.log(`    Output keys: ${Object.keys(result.output).join(', ')}`);
                }
            });
        }
        
    } catch (error) {
        console.error('❌ Workflow test failed:', error.response?.data || error.message);
    }
}

// Run tests
async function runTests() {
    await test2DTo3D();
    await testWorkflow();
}

runTests();