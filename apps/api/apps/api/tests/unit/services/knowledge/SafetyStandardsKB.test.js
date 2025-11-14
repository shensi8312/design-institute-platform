const SafetyStandardsKB = require('../../../../src/services/knowledge/SafetyStandardsKB')
const db = require('../../../../src/config/database')

describe('SafetyStandardsKB 单元测试', () => {
  let safetyKB

  beforeAll(async () => {
    safetyKB = new SafetyStandardsKB()
    await safetyKB.initialize()
  })

  afterAll(async () => {
    await db.destroy()
  })

  describe('危险品隔离距离计算', () => {
    test('应该返回H2和O2的隔离距离(3000mm)', async () => {
      const result = await safetyKB.calculateIsolationDistance('H2', 'O2')

      expect(result.distance).toBe(3000)
      expect(result.riskLevel).toBe('critical')
      expect(result.reason).toContain('氢氧')
      expect(result.standardRef).toBe('GB 50016')
    })

    test('应该返回Cl2和NH3的隔离距离(3000mm)', async () => {
      const result = await safetyKB.calculateIsolationDistance('Cl2', 'NH3')

      expect(result.distance).toBe(3000)
      expect(result.riskLevel).toBe('critical')
      expect(result.reason).toContain('氯气')
      expect(result.reason).toContain('氨气')
    })

    test('相同流体隔离距离应较小', async () => {
      const result = await safetyKB.calculateIsolationDistance('H2', 'H2')

      expect(result.distance).toBe(1000)
      expect(result.riskLevel).toBe('low')
    })

    test('未知流体组合应返回默认值', async () => {
      const result = await safetyKB.calculateIsolationDistance('UnknownFluid1', 'UnknownFluid2')

      expect(result.distance).toBe(1000)
      expect(result.riskLevel).toBe('medium')
      expect(result.reason).toContain('默认')
    })

    test('应该支持顺序无关查询', async () => {
      const result1 = await safetyKB.calculateIsolationDistance('H2', 'O2')
      const result2 = await safetyKB.calculateIsolationDistance('O2', 'H2')

      expect(result1.distance).toBe(result2.distance)
      expect(result1.riskLevel).toBe(result2.riskLevel)
    })
  })

  describe('应急通道验证', () => {
    test('应急通道过窄应报critical违规', () => {
      const layoutPlacements = [
        { position: { x: 0, y: 0 } },
        { position: { x: 600, y: 0 } }  // 间隔600mm < 最小800mm
      ]

      const violations = safetyKB.validateEmergencyCorridor(layoutPlacements)

      expect(violations.length).toBeGreaterThan(0)
      expect(violations[0].type).toBe('emergency_corridor_narrow')
      expect(violations[0].severity).toBe('critical')
      expect(violations[0].currentValue).toBeLessThan(800)
    })

    test('逃生距离过远应报high违规', () => {
      const layoutPlacements = [
        { position: { x: 0, y: 0 } },
        { position: { x: 35000, y: 0 } }  // 35m > 最大30m
      ]

      const violations = safetyKB.validateEmergencyCorridor(layoutPlacements)

      const exitViolation = violations.find(v => v.type === 'emergency_exit_too_far')
      expect(exitViolation).toBeDefined()
      expect(exitViolation.severity).toBe('high')
    })

    test('合规的应急通道应返回空列表', () => {
      const layoutPlacements = [
        { position: { x: 0, y: 0 } },
        { position: { x: 1500, y: 0 } }  // 间隔1500mm，在范围内
      ]

      const violations = safetyKB.validateEmergencyCorridor(layoutPlacements)

      expect(violations).toEqual([])
    })
  })

  describe('防爆区域分类', () => {
    test('密闭容器应为Zone 0', () => {
      const result = safetyKB.determineExplosionProofZone('tank', 'H2', 8)

      expect(result.zone).toBe('Zone 0')
      expect(result.reason).toContain('密闭容器')
      expect(result.requirements.equipmentRequirement).toContain('Ex ia')
    })

    test('通风良好的阀门应为Zone 2', () => {
      const result = safetyKB.determineExplosionProofZone('valve', 'H2', 8)

      expect(result.zone).toBe('Zone 2')
      expect(result.requirements.ventilationRate).toBe(4)
    })

    test('通风不足的泵应为Zone 1', () => {
      const result = safetyKB.determineExplosionProofZone('pump', 'H2', 4)

      expect(result.zone).toBe('Zone 1')
      expect(result.reason).toContain('泄漏高危')
    })
  })

  describe('安全合规性验证', () => {
    test('应该检测危险品隔离不足', async () => {
      const bomData = [
        { partNumber: '001', part_number: '001', fluidType: 'H2' },
        { partNumber: '002', part_number: '002', fluidType: 'O2' }
      ]

      const layoutPlacements = [
        { part_number: '001', fluidType: 'H2', position: { x: 0, y: 0, z: 0 } },
        { part_number: '002', fluidType: 'O2', position: { x: 1000, y: 0, z: 0 } }  // 1000mm < 3000mm
      ]

      const violations = await safetyKB.validateSafetyCompliance(bomData, layoutPlacements, {})

      const isolationViolation = violations.find(v => v.type === 'hazard_isolation_insufficient')
      expect(isolationViolation).toBeDefined()
      expect(isolationViolation.severity).toBe('critical')
      expect(isolationViolation.currentDistance).toBeLessThan(3000)
      expect(isolationViolation.requiredDistance).toBe(3000)
    })
  })
})
