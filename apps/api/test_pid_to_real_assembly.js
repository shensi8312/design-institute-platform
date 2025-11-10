/**
 * PID → 真实STEP装配体 完整流程测试
 *
 * 流程：
 * 1. 模拟PID识别结果（设备和连接关系）
 * 2. 从零件库匹配实际STEP文件
 * 3. 使用pythonocc-core解析STEP几何体
 * 4. 生成Three.js装配体JSON（真实几何体）
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const AssemblyPositionCalculator = require('./src/services/assembly/AssemblyPositionCalculator');

// 模拟PID识别结果
const pidData = {
  components: [
    { type: 'PIPE', spec: 'DN40-SCH40' },
    { type: 'FLANGE', spec: 'DN40-PN16-RF' },
    { type: 'VALVE', spec: 'BALL-DN40-PN16' },
    { type: 'FLANGE', spec: 'DN40-PN16-RF' },
    { type: 'PIPE', spec: 'DN40-SCH40' }
  ],
  connections: [
    { from: 0, to: 1, type: 'flange-connection' },
    { from: 1, to: 2, type: 'bolted-connection' },
    { from: 2, to: 3, type: 'bolted-connection' },
    { from: 3, to: 4, type: 'flange-connection' }
  ]
};

// 零件库：类型 → STEP文件映射
const partsLibrary = {
  'PIPE-DN40-SCH40': 'P0000009449.STEP',
  'FLANGE-DN40-PN16-RF': '100001060023.STEP',
  'VALVE-BALL-DN40-PN16': 'A0000002655.STEP'  // 示例，实际可能不是阀门
};

// 解析STEP文件的函数
async function parseStepFile(stepFileName) {
  const stepFilePath = path.join(__dirname, '../../docs/solidworks', stepFileName);
  const pythonScript = path.join(__dirname, 'src/services/assembly/parse_step_to_json.py');
  const pythonPath = '/Users/shenguoli/miniconda3/envs/cad/bin/python';

  return new Promise((resolve, reject) => {
    const python = spawn(pythonPath, [pythonScript, stepFilePath]);

    let output = '';
    python.stdout.on('data', (data) => { output += data.toString(); });
    python.stderr.on('data', (data) => { console.error(`[${stepFileName}] ${data}`); });

    python.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (e) {
          reject(new Error(`JSON解析失败: ${e.message}`));
        }
      } else {
        reject(new Error(`Python进程退出码: ${code}`));
      }
    });
  });
}

function degToRad(value) {
  return (value || 0) * Math.PI / 180;
}

function buildMatrix(position = { x: 0, y: 0, z: 0 }, rotation = { x: 0, y: 0, z: 0 }) {
  const rx = degToRad(rotation.x);
  const ry = degToRad(rotation.y);
  const rz = degToRad(rotation.z);

  const cx = Math.cos(rx); const sx = Math.sin(rx);
  const cy = Math.cos(ry); const sy = Math.sin(ry);
  const cz = Math.cos(rz); const sz = Math.sin(rz);

  const m00 = cy * cz;
  const m01 = cz * sx * sy - cx * sz;
  const m02 = cx * cz * sy + sx * sz;

  const m10 = cy * sz;
  const m11 = cx * cz + sx * sy * sz;
  const m12 = -cz * sx + cx * sy * sz;

  const m20 = -sy;
  const m21 = cy * sx;
  const m22 = cx * cy;

  return [
    m00, m01, m02, 0,
    m10, m11, m12, 0,
    m20, m21, m22, 0,
    position.x || 0, position.y || 0, position.z || 0, 1
  ];
}

function normalizeComponents() {
  return pidData.components.map((component, index) => ({
    ...component,
    tag: `COMP-${index + 1}`,
    id: `COMP-${index + 1}`,
    family: component.type?.toLowerCase() || 'pipe',
    dn: component.spec?.match(/DN(\d+)/i)?.[1],
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 }
  }));
}

function normalizeConnections(components) {
  return pidData.connections.map((connection, index) => ({
    ...connection,
    id: `CONN-${index + 1}`,
    from_tag: components[connection.from].tag,
    to_tag: components[connection.to].tag
  }));
}

// 主流程
async function generateAssemblyFromPID() {
  console.log('🔧 PID → 真实STEP装配体生成\n');

  const geometries = [];
  const materials = [];
  const objects = [];

  const calculator = new AssemblyPositionCalculator();
  const normalizedComponents = normalizeComponents();
  const normalizedConnections = normalizeConnections(normalizedComponents);
  const positionedComponents = calculator.calculateAssemblyPositions(normalizedComponents, normalizedConnections);
  const positionMap = new Map(
    positionedComponents.map(component => [component.tag || component.id, component])
  );

  console.log(`📋 PID识别到 ${pidData.components.length} 个设备\n`);

  for (let i = 0; i < pidData.components.length; i++) {
    const component = pidData.components[i];
    const positioned = positionMap.get(normalizedComponents[i].tag) || normalizedComponents[i];
    const partKey = `${component.type}-${component.spec}`;
    const stepFile = partsLibrary[partKey];

    if (!stepFile) {
      console.warn(`⚠️  零件库中未找到: ${partKey}，使用占位符`);
      // 降级：使用占位几何体
      geometries.push({
        uuid: `geo-${i}`,
        type: 'BoxGeometry',
        width: 50,
        height: 50,
        depth: 50
      });
    } else {
      console.log(`🔍 解析 ${partKey} → ${stepFile}`);

      try {
        const stepData = await parseStepFile(stepFile);

        if (stepData.success && stepData.geometry.vertices.length > 0) {
          // 使用真实STEP几何体
          geometries.push({
            uuid: `geo-${i}`,
            type: 'BufferGeometry',
            data: {
              attributes: {
                position: {
                  itemSize: 3,
                  type: 'Float32Array',
                  array: stepData.geometry.vertices
                },
                normal: {
                  itemSize: 3,
                  type: 'Float32Array',
                  array: stepData.geometry.normals || []
                }
              }
            }
          });

          console.log(`   ✅ ${stepData.metadata.vertexCount} 顶点, ${stepData.metadata.parser}`);
        } else {
          // 降级：占位几何体
          geometries.push({
            uuid: `geo-${i}`,
            type: 'BoxGeometry',
            width: 50,
            height: 50,
            depth: 50
          });
          console.log(`   ⚠️  解析失败，使用占位符`);
        }
      } catch (error) {
        console.error(`   ❌ 错误: ${error.message}`);
        // 降级：占位几何体
        geometries.push({
          uuid: `geo-${i}`,
          type: 'BoxGeometry',
          width: 50,
          height: 50,
          depth: 50
        });
      }
    }

    // 材质
    materials.push({
      uuid: `mat-${i}`,
      type: 'MeshStandardMaterial',
      color: 0x999999,
      metalness: 0.5,
      roughness: 0.5
    });

    // 对象（包含位置）
    objects.push({
      uuid: `obj-${i}`,
      type: 'Mesh',
      name: partKey,
      geometry: `geo-${i}`,
      material: `mat-${i}`,
      matrix: buildMatrix(positioned.position, positioned.rotation)
    });
  }

  // 生成Three.js装配体JSON
  const assemblyJson = {
    metadata: {
      version: 4.5,
      type: 'Object',
      generator: 'PID-to-Assembly-Real-STEP',
      source: 'PID-301000050672',
      timestamp: new Date().toISOString()
    },
    geometries,
    materials,
    object: {
      type: 'Scene',
      children: objects
    }
  };

  // 保存
  const outputPath = path.join(__dirname, 'uploads/assembly_output/pid_real_assembly.json');
  fs.writeFileSync(outputPath, JSON.stringify(assemblyJson, null, 2));

  console.log(`\n✅ 装配体已生成:`);
  console.log(`   文件: ${outputPath}`);
  console.log(`   零件数: ${objects.length}`);
  console.log(`   总顶点数: ${geometries.reduce((sum, geo) => {
    if (geo.type === 'BufferGeometry') {
      return sum + (geo.data.attributes.position.array.length / 3);
    }
    return sum;
  }, 0).toLocaleString()}`);
  console.log(`\n🌐 在浏览器中查看:`);
  console.log(`   http://localhost:3000/step-viewer-server.html`);
  console.log(`   (修改viewer的assemblyFile为: /assembly-output/pid_real_assembly.json)`);
}

// 运行
generateAssemblyFromPID().catch(console.error);
