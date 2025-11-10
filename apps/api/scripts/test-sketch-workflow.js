#!/usr/bin/env node

/**
 * Test the complete sketch-to-SKP workflow with user's actual image
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const API_URL = 'http://localhost:3000/api';

async function login() {
    try {
        const response = await axios.post(`${API_URL}/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });
        return response.data.data.token;
    } catch (error) {
        console.error('Login failed:', error.message);
        return null;
    }
}

async function testSketchWorkflow() {
    console.log('🎨 Testing sketch-to-SKP workflow with real image...\n');
    
    // User's actual sketch image
    const imagePath = '/Users/shenguoli/Documents/projects/design-institute-platform/docs/u=2338591061,480638766&fm=193.jpeg';
    
    if (!fs.existsSync(imagePath)) {
        console.error('❌ Image not found:', imagePath);
        return;
    }
    
    console.log('📁 Using image:', path.basename(imagePath));
    console.log('📏 File size:', (fs.statSync(imagePath).size / 1024).toFixed(2), 'KB\n');
    
    try {
        // Get authentication token
        const token = await login();
        if (!token) {
            console.error('❌ Failed to authenticate');
            return;
        }
        console.log('🔑 Authenticated successfully\n');
        
        // Execute the workflow with the image
        console.log('🔄 Executing workflow: sketch-to-skp-workflow');
        console.log('   Step 1: Image Recognition (OCR + Edge Detection)');
        console.log('   Step 2: Sketch Data Extraction');
        console.log('   Step 3: 2D to 3D Conversion');
        console.log('   Step 4: SketchUp File Generation\n');
        
        // Since the workflow expects image data, we need to pass it properly
        // The workflow will call each engine in sequence
        
        const workflowInput = {
            image: imagePath,  // Pass the image path
            format: 'skp',     // Output format
            config: {
                recognitionConfig: {
                    ocrLanguage: 'ch',
                    useYolo: false,  // Disabled due to segfault
                    useMultimodal: true
                }
            }
        };
        
        const response = await axios.post(
            `${API_URL}/workflow/workflows/sketch-to-skp-workflow/execute`,
            {
                input: workflowInput,
                context: {
                    source: 'test-script',
                    user: 'test',
                    project: 'Fab Design Test'
                }
            },
            {
                timeout: 60000,
                maxContentLength: 50 * 1024 * 1024,  // 50MB
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );
        
        if (response.data.success) {
            console.log('✅ Workflow executed successfully!\n');
            
            const result = response.data.data;
            
            // Display results from each step
            console.log('📊 Workflow Results:\n');
            
            if (result.steps) {
                // Step 1: Recognition results
                if (result.steps.recognize) {
                    console.log('1️⃣ Image Recognition:');
                    const recog = result.steps.recognize.output;
                    console.log(`   - Lines detected: ${recog.lines?.length || 0}`);
                    console.log(`   - Shapes detected: ${recog.shapes?.length || 0}`);
                    console.log(`   - Text annotations: ${recog.text?.length || 0}`);
                    console.log(`   - Building type: ${recog.semantic?.buildingType || 'unknown'}`);
                    console.log(`   - Floors: ${recog.semantic?.floors || 1}\n`);
                }
                
                // Step 2: Extraction results
                if (result.steps.extract) {
                    console.log('2️⃣ Sketch Data Extraction:');
                    const extract = result.steps.extract.output;
                    console.log(`   - Walls: ${extract.walls?.length || 0}`);
                    console.log(`   - Doors: ${extract.doors?.length || 0}`);
                    console.log(`   - Windows: ${extract.windows?.length || 0}`);
                    console.log(`   - Rooms: ${extract.rooms?.length || 0}`);
                    console.log(`   - Scale: 1:${extract.scale || 100}\n`);
                }
                
                // Step 3: 3D Conversion results
                if (result.steps.convert) {
                    console.log('3️⃣ 2D to 3D Conversion:');
                    const convert = result.steps.convert.output;
                    console.log(`   - 3D walls: ${convert.model3D?.walls?.length || 0}`);
                    console.log(`   - Applied rules: ${convert.rules?.length || 0}`);
                    if (convert.rules) {
                        convert.rules.slice(0, 3).forEach(rule => {
                            console.log(`     • ${rule}`);
                        });
                    }
                    console.log();
                }
                
                // Step 4: SKP Generation results
                if (result.steps.generate) {
                    console.log('4️⃣ SketchUp File Generation:');
                    const generate = result.steps.generate.output;
                    console.log(`   - SKP file: ${generate.skpFile || 'Not generated'}`);
                    console.log(`   - Preview: ${generate.preview || 'N/A'}`);
                    if (generate.statistics) {
                        console.log(`   - Statistics:`);
                        console.log(`     • Walls: ${generate.statistics.walls}`);
                        console.log(`     • Doors: ${generate.statistics.doors}`);
                        console.log(`     • Windows: ${generate.statistics.windows}`);
                        console.log(`     • Total area: ${generate.statistics.totalArea} m²`);
                    }
                    console.log();
                }
            }
            
            console.log('🎉 Complete pipeline test successful!');
            console.log('\n💡 This demonstrates the full flow:');
            console.log('   Image → Recognition → Extraction → 3D Conversion → SKP File');
            console.log('\n📝 Note: All processing is done through dynamic engines!');
            console.log('   No hardcoded logic - everything is configurable via workflow');
            
        } else {
            console.error('❌ Workflow failed:', response.data.error);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        
        if (error.response?.status === 404) {
            console.log('\n💡 Make sure the workflow is registered:');
            console.log('   node scripts/register-sketch-engines.js');
        }
        
        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 Make sure the server is running:');
            console.log('   PORT=3000 node src/app.js');
        }
    }
}

// Alternative: Test individual engines
async function testIndividualEngines() {
    console.log('\n\n🔧 Testing individual engines...\n');
    
    const imagePath = '/Users/shenguoli/Documents/projects/design-institute-platform/docs/u=2338591061,480638766&fm=193.jpeg';
    
    try {
        // Test each engine individually
        
        // 1. Test recognition engine
        console.log('Testing image recognition engine...');
        const recognizeResponse = await axios.post(
            `${API_URL}/engines/image-recognition-engine/execute`,
            {
                input: { image: imagePath },
                context: {}
            }
        );
        console.log('✅ Recognition engine works');
        
        // 2. Test extraction engine
        console.log('Testing sketch extraction engine...');
        const extractResponse = await axios.post(
            `${API_URL}/engines/sketch-extractor-engine/execute`,
            {
                input: recognizeResponse.data.data,
                context: {}
            }
        );
        console.log('✅ Extraction engine works');
        
        // 3. Test 2D-to-3D engine
        console.log('Testing 2D-to-3D conversion engine...');
        const convertResponse = await axios.post(
            `${API_URL}/engines/2d-to-3d-converter/execute`,
            {
                input: {
                    sketch: extractResponse.data.data,
                    buildingType: 'industrial',
                    scale: 100
                },
                context: {}
            }
        );
        console.log('✅ 2D-to-3D engine works');
        
        // 4. Test SKP generator
        console.log('Testing SKP generator engine...');
        const generateResponse = await axios.post(
            `${API_URL}/engines/skp-generator-engine/execute`,
            {
                input: {
                    model3D: convertResponse.data.data.model3D
                },
                context: {}
            }
        );
        console.log('✅ SKP generator works');
        
        console.log('\n✅ All engines tested successfully!');
        
    } catch (error) {
        console.error('❌ Engine test failed:', error.response?.data || error.message);
    }
}

// Run tests
async function runTests() {
    // Test the complete workflow
    await testSketchWorkflow();
    
    // Optionally test individual engines
    // await testIndividualEngines();
}

runTests();