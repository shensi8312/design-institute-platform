const MechanicalEngineeringKB = require('../../../../src/services/knowledge/MechanicalEngineeringKB')
const db = require('../../../../src/config/database')

describe('MechanicalEngineeringKB 单元测试', () => {
  let mechanicalKB

  beforeAll(async () => {
    mechanicalKB = new MechanicalEngineeringKB()
    await mechanicalKB.initialize()
  })

  afterAll(async () => {
    await db.destroy()
  })

  describe('螺纹配对验证', () => {
    test('应该验证通过相同螺纹规格的螺栓-螺母配对', async () => {
      const bolt = {
        partName: 'GB/T 70.1 M8x1.25 六角头螺栓',
        part_name: 'GB/T 70.1 M8x1.25 六角头螺栓',
        type: '螺栓'
      }

      const nut = {
        partName: 'GB/T 6170 M8x1.25 六角螺母',
        part_name: 'GB/T 6170 M8x1.25 六角螺母',
        type: '螺母'
      }

      const result = await mechanicalKB.validateThreadMating(bolt, nut)

      expect(result.valid).toBe(true)
      expect(result.reason).toContain('M8')
      expect(result.recommendedTorque).toBeDefined()
    })

    test('应该拒绝不同螺纹规格的配对', async () => {
      const bolt = {
        partName: 'M8 螺栓',
        part_name: 'M8 螺栓',
        type: '螺栓'
      }

      const nut = {
        partName: 'M10 螺母',
        part_name: 'M10 螺母',
        type: '螺母'
      }

      const result = await mechanicalKB.validateThreadMating(bolt, nut)

      expect(result.valid).toBe(false)
      expect(result.severity).toBe('critical')
      expect(result.reason).toContain('不匹配')
    })

    test('应该拒绝公母螺纹类型不匹配', async () => {
      const bolt1 = {
        partName: 'M8 螺栓',
        part_name: 'M8 螺栓',
        type: '螺栓'
      }

      const bolt2 = {
        partName: 'M8 螺栓',
        part_name: 'M8 螺栓',
        type: '螺栓'
      }

      const result = await mechanicalKB.validateThreadMating(bolt1, bolt2)

      expect(result.valid).toBe(false)
      expect(result.severity).toBe('high')
      expect(result.reason).toContain('公母配合')
    })

    test('无螺纹信息时应跳过检查', async () => {
      const part1 = { partName: '法兰', part_name: '法兰' }
      const part2 = { partName: '垫片', part_name: '垫片' }

      const result = await mechanicalKB.validateThreadMating(part1, part2)

      expect(result.valid).toBe(true)
      expect(result.reason).toContain('无螺纹信息')
    })
  })

  describe('法兰配对验证', () => {
    test('应该验证通过相同标准和规格的法兰配对', async () => {
      const flange1 = {
        partName: 'ANSI 150# DN50 法兰',
        part_name: 'ANSI 150# DN50 法兰'
      }

      const flange2 = {
        partName: '150# DN50 对焊法兰',
        part_name: '150# DN50 对焊法兰'
      }

      const result = await mechanicalKB.validateFlangeMating(flange1, flange2)

      expect(result.valid).toBe(true)
      expect(result.reason).toContain('150#')
      expect(result.reason).toContain('DN50')
      expect(result.boltRequirements).toBeDefined()
      expect(result.boltRequirements.boltSize).toBe('M16')
      expect(result.boltRequirements.boltCount).toBe(4)
    })

    test('应该拒绝ANSI和DIN标准混用', async () => {
      const ansiFlange = {
        partName: 'ANSI 150# DN50 法兰',
        part_name: 'ANSI 150# DN50 法兰'
      }

      const dinFlange = {
        partName: 'DIN PN16 DN50 法兰',
        part_name: 'DIN PN16 DN50 法兰'
      }

      const result = await mechanicalKB.validateFlangeMating(ansiFlange, dinFlange)

      expect(result.valid).toBe(false)
      expect(result.severity).toBe('critical')
      expect(result.reason).toContain('标准不匹配')
      expect(result.reason).toContain('ANSI')
      expect(result.reason).toContain('DIN')
    })

    test('应该拒绝压力等级或尺寸不匹配', async () => {
      const flange1 = {
        partName: 'ANSI 150# DN50 法兰',
        part_name: 'ANSI 150# DN50 法兰'
      }

      const flange2 = {
        partName: 'ANSI 300# DN80 法兰',
        part_name: 'ANSI 300# DN80 法兰'
      }

      const result = await mechanicalKB.validateFlangeMating(flange1, flange2)

      expect(result.valid).toBe(false)
      expect(result.severity).toBe('high')
      expect(result.reason).toContain('规格不匹配')
    })
  })

  describe('机械设计合规性验证', () => {
    test('应该检测出螺纹不匹配问题', async () => {
      const bomData = [
        { partName: 'M8 螺栓', part_name: 'M8 螺栓', partNumber: '001', part_number: '001' },
        { partName: 'M10 螺母', part_name: 'M10 螺母', partNumber: '002', part_number: '002' }
      ]

      const violations = await mechanicalKB.validateMechanicalDesign(bomData)

      expect(violations.length).toBeGreaterThan(0)
      expect(violations[0].type).toBe('thread_mismatch')
      expect(violations[0].severity).toBe('critical')
    })

    test('应该检测出法兰标准混用问题', async () => {
      const bomData = [
        { partName: 'ANSI 150# DN50 法兰', part_name: 'ANSI 150# DN50 法兰', partNumber: '001', part_number: '001' },
        { partName: 'DIN PN16 DN50 法兰', part_name: 'DIN PN16 DN50 法兰', partNumber: '002', part_number: '002' }
      ]

      const violations = await mechanicalKB.validateMechanicalDesign(bomData)

      expect(violations.length).toBeGreaterThan(0)
      expect(violations[0].type).toBe('flange_mismatch')
      expect(violations[0].severity).toBe('critical')
    })

    test('合规的BOM应返回空违规列表', async () => {
      const bomData = [
        { partName: 'M8 螺栓', part_name: 'M8 螺栓', partNumber: '001', part_number: '001' },
        { partName: 'M8 螺母', part_name: 'M8 螺母', partNumber: '002', part_number: '002' },
        { partName: 'ANSI 150# DN50 法兰', part_name: 'ANSI 150# DN50 法兰', partNumber: '003', part_number: '003' },
        { partName: 'ANSI 150# DN50 法兰', part_name: 'ANSI 150# DN50 法兰', partNumber: '004', part_number: '004' }
      ]

      const violations = await mechanicalKB.validateMechanicalDesign(bomData)

      expect(violations).toEqual([])
    })
  })
})
