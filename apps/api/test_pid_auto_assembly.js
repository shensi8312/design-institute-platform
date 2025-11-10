#!/usr/bin/env node
/**
 * 测试PID自动装配系统
 * 加载装配定义 → 解析STEP文件 → 生成3D装配体
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PYTHON_PATH = '/Users/shenguoli/miniconda3/envs/cad/bin/python';
const PARSER_SCRIPT = 'src/services/assembly/parse_step_with_transforms.py';

async function loadSTEPFile(stepFilePath) {
  console.log(`  🔄 加载: ${path.basename(stepFilePath)}`);

  return new Promise((resolve, reject) => {
    const python = spawn(PYTHON_PATH, [PARSER_SCRIPT, stepFilePath]);
    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`解析失败: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        if (result.success) {
          console.log(`  ✓ 解析完成`);
          resolve(result.data);
        } else {
          reject(new Error(result.error));
        }
      } catch (e) {
        reject(new Error(`JSON解析错误: ${e.message}`));
      }
    });
  });
}

async function generateAssembly() {
  console.log('='.repeat(60));
  console.log('PID自动装配 - 3D生成');
  console.log('='.repeat(60));

  // 1. 读取装配定义
  const assemblyDef = JSON.parse(
    fs.readFileSync('uploads/assembly_output/pid_auto_assembly.json', 'utf-8')
  );

  if (!assemblyDef.success) {
    console.error('❌ 装配定义无效');
    return;
  }

  const parts = assemblyDef.assembly.parts;
  console.log(`\n📦 准备加载 ${parts.length} 个零件\n`);

  // 2. 逐个加载STEP文件
  const loadedParts = [];
  for (const part of parts) {
    try {
      const stepData = await loadSTEPFile(part.model_file);

      // 应用装配位置
      const assemblyObject = {
        type: 'Group',
        name: part.part_number,
        children: stepData.object.children.map((child, idx) => {
          // 计算组合变换矩阵
          const pos = part.position;
          const rot = part.rotation;

          // 简化：直接使用平移矩阵
          return {
            ...child,
            matrix: [
              1, 0, 0, 0,
              0, 1, 0, 0,
              0, 0, 1, 0,
              pos[0], pos[1], pos[2], 1
            ]
          };
        })
      };

      loadedParts.push({
        part_number: part.part_number,
        type: part.type,
        geometries: stepData.geometries,
        materials: stepData.materials,
        object: assemblyObject
      });

    } catch (error) {
      console.error(`  ✗ 加载失败: ${error.message}`);
    }
  }

  console.log(`\n✓ 成功加载 ${loadedParts.length}/${parts.length} 个零件\n`);

  // 3. 合并为完整装配体
  const allGeometries = [];
  const allMaterials = [];
  const allObjects = [];

  let geoOffset = 0;
  let matOffset = 0;

  for (const part of loadedParts) {
    // 更新几何体和材质的UUID以避免冲突
    for (const geo of part.geometries) {
      allGeometries.push({
        ...geo,
        uuid: `geo-${geoOffset++}`
      });
    }

    for (const mat of part.materials) {
      allMaterials.push({
        ...mat,
        uuid: `mat-${matOffset++}`
      });
    }

    // 更新对象引用
    for (const child of part.object.children) {
      const oldGeoUUID = child.geometry;
      const oldMatUUID = child.material;

      // 查找新UUID
      const geoIdx = part.geometries.findIndex(g => g.uuid === oldGeoUUID);
      const matIdx = part.materials.findIndex(m => m.uuid === oldMatUUID);

      allObjects.push({
        ...child,
        uuid: `obj-${allObjects.length}`,
        name: `${part.part_number}_${child.name}`,
        geometry: `geo-${geoIdx + (geoOffset - part.geometries.length)}`,
        material: `mat-${matIdx + (matOffset - part.materials.length)}`
      });
    }
  }

  // 4. 生成Three.js场景JSON
  const sceneData = {
    metadata: {
      version: 4.5,
      type: 'Object',
      generator: 'PID-Auto-Assembly-Engine',
      source: 'pid_auto_assembly'
    },
    geometries: allGeometries,
    materials: allMaterials,
    object: {
      type: 'Scene',
      children: allObjects
    }
  };

  // 5. 保存结果
  const outputFile = 'uploads/assembly_output/pid_generated_assembly.json';
  fs.writeFileSync(outputFile, JSON.stringify(sceneData, null, 2));

  const fileSize = (fs.statSync(outputFile).size / 1024 / 1024).toFixed(2);
  console.log(`✓ 装配体已生成: ${outputFile}`);
  console.log(`  文件大小: ${fileSize}MB`);
  console.log(`  几何体: ${allGeometries.length}`);
  console.log(`  材质: ${allMaterials.length}`);
  console.log(`  对象: ${allObjects.length}`);

  // 6. 创建HTML查看器
  const viewerHTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>PID自动装配结果</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: sans-serif; background: #1a1a2e; overflow: hidden; }
    #container { width: 100vw; height: 100vh; }
    #info {
      position: absolute; top: 20px; left: 20px;
      background: rgba(0,0,0,0.9); color: white;
      padding: 20px; border-radius: 10px; max-width: 350px;
    }
    h2 { color: #4ecdc4; margin-bottom: 15px; }
    .stat { margin: 8px 0; }
    .label { opacity: 0.7; }
    .value { font-weight: bold; color: #4ecdc4; }
  </style>
</head>
<body>
  <div id="container"></div>
  <div id="info">
    <h2>🤖 PID自动装配</h2>
    <div class="stat"><span class="label">算法:</span> <span class="value">规则学习</span></div>
    <div class="stat"><span class="label">零件数:</span> <span class="value" id="partCount">-</span></div>
    <div class="stat"><span class="label">置信度:</span> <span class="value">75%</span></div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/three@0.146.0/build/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.146.0/examples/js/controls/OrbitControls.js"></script>
  <script>
    let scene, camera, renderer, controls;

    async function init() {
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x1a1a2e);

      camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 10000);
      camera.position.set(100, 100, 100);

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      document.getElementById('container').appendChild(renderer.domElement);

      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(500, 500, 500);
      scene.add(directionalLight);

      const gridHelper = new THREE.GridHelper(500, 50, 0x444444, 0x222222);
      scene.add(gridHelper);

      await loadAssembly();
      animate();
    }

    async function loadAssembly() {
      const response = await fetch('/assembly-output/pid_generated_assembly.json');
      const result = await response.json();
      const data = result.data || result;

      const loader = new THREE.ObjectLoader();
      const assemblyObject = loader.parse(data);
      scene.add(assemblyObject);

      let partCount = 0;
      assemblyObject.traverse((child) => {
        if (child instanceof THREE.Mesh) partCount++;
      });

      document.getElementById('partCount').textContent = partCount;

      const box = new THREE.Box3().setFromObject(scene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 2;

      camera.position.set(center.x + cameraZ, center.y + cameraZ, center.z + cameraZ);
      controls.target.copy(center);
      controls.update();
    }

    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    init();
  </script>
</body>
</html>`;

  fs.writeFileSync('uploads/pid-auto-assembly-viewer.html', viewerHTML);
  console.log(`\n✓ 查看器已创建: uploads/pid-auto-assembly-viewer.html`);
  console.log(`\n🌐 访问: http://localhost:3000/uploads/pid-auto-assembly-viewer.html`);
}

generateAssembly().catch(console.error);
