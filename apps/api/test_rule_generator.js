/**
 * 测试基于规则的装配生成器
 */

const generator = require('./src/services/assembly/RuleBasedAssemblyGenerator')

async function test() {
  try {
    console.log('===== 测试规则装配生成器 =====\n')

    // 测试1: 加载规则
    console.log('Step 1: 加载装配规则...')
    const rules = await generator.loadRules()
    console.log(`✅ 加载了 ${rules.length} 条规则`)
    rules.forEach(r => {
      console.log(`  - ${r.rule_id}: ${r.name} (优先级 ${r.priority})`)
    })

    // 测试2: 加载零件
    console.log('\nStep 2: 加载零件...')
    const partIds = [
      'FLANGE-DN25-PN16-RF',
      'FLANGE-DN40-PN16-RF',
      'VALVE-BALL-DN25-PN16',
      'FLANGE-DN50-PN16-RF'
    ]
    await generator.loadParts(partIds)
    console.log(`✅ 加载了 ${generator.parts.length} 个零件`)
    generator.parts.forEach(p => {
      console.log(`  - ${p.part_id} (family: ${p.family}, DN${p.dn}, PN${p.pn})`)
    })

    // 测试3: 匹配规则
    console.log('\nStep 3: 测试规则匹配...')
    if (generator.parts.length >= 2) {
      const partA = generator.parts[0]
      const partB = generator.parts[1]
      const matches = generator.matchPartsWithRules(partA, partB)
      console.log(`  ${partA.part_id} <-> ${partB.part_id}:`)
      if (matches.length > 0) {
        matches.forEach(m => {
          console.log(`    ✅ 匹配规则: ${m.rule_name} (${m.action.type}, 置信度 ${m.confidence.toFixed(2)})`)
        })
      } else {
        console.log(`    ⚠️  无匹配规则`)
      }
    }

    // 测试4: 生成完整装配
    console.log('\nStep 4: 生成完整装配...')
    const assembly = await generator.generateAssembly({
      partIds,
      assemblyName: '测试装配'
    })

    console.log('\n===== 装配结果 =====')
    console.log(`零件数: ${assembly.statistics.total_parts}`)
    console.log(`约束数: ${assembly.statistics.total_constraints}`)
    console.log(`应用规则数: ${assembly.statistics.rules_applied}`)

    console.log('\n约束详情:')
    assembly.constraints.forEach((c, i) => {
      console.log(`  ${i+1}. ${c.entity_a} <-> ${c.entity_b}`)
      console.log(`     类型: ${c.constraint_type}`)
      console.log(`     规则: ${c.rule_name}`)
      console.log(`     置信度: ${c.confidence.toFixed(2)}`)
    })

    // 测试5: 导出Three.js格式
    console.log('\nStep 5: 导出Three.js格式...')
    const threeJSON = generator.exportToThreeJS()
    console.log(`✅ 导出成功`)
    console.log(`  几何体数: ${threeJSON.geometries.length}`)
    console.log(`  材质数: ${threeJSON.materials.length}`)
    console.log(`  对象数: ${threeJSON.object.children.length}`)

    console.log('\n✅ 所有测试通过!')

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

test()
