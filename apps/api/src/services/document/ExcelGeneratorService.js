const ExcelJS = require('exceljs')
const fs = require('fs-extra')
const TemplateManager = require('./TemplateManager')

/**
 * Excel表格生成服务
 * 基于exceljs，使用单位标准模板生成Excel表格
 */
class ExcelGeneratorService {
  /**
   * 生成Excel表格（自动使用对应模板）
   * @param {Object} options
   * @param {string} options.title - 表格标题
   * @param {Array} options.data - 数据数组
   * @param {string} options.template - 模板ID
   * @param {Object} options.metadata - 额外元数据
   */
  async generate({ title, data, template, metadata = {} }) {
    try {
      // 1. 从模板管理器获取模板
      const templatePath = TemplateManager.getTemplatePath('excel', template || 'general')
      const templateInfo = TemplateManager.getTemplateInfo('excel', template || 'general')

      console.log(`📊 使用Excel模板: ${templateInfo.name} (${templateInfo.file})`)

      // 检查模板文件是否存在，不存在则使用直接生成方式
      if (!await fs.pathExists(templatePath)) {
        console.warn(`⚠️ 模板文件不存在，使用exceljs直接生成: ${templatePath}`)
        return this._generateWithoutTemplate({ title, data, template, metadata })
      }

      // 2. 加载模板
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.readFile(templatePath)

      // 3. 获取第一个工作表
      const worksheet = workbook.getWorksheet(1)

      if (!worksheet) {
        console.warn('⚠️ 模板中没有工作表，使用直接生成方式')
        return this._generateWithoutTemplate({ title, data, template, metadata })
      }

      // 4. 填充数据
      this._fillData(worksheet, { title, data, metadata })

      // 5. 生成Buffer
      const buffer = await workbook.xlsx.writeBuffer()

      console.log(`✅ Excel表格生成成功: ${title}.xlsx (${(buffer.length / 1024).toFixed(2)} KB)`)

      return {
        buffer,
        filename: `${title}.xlsx`,
        size: buffer.length,
        template: templateInfo.name
      }

    } catch (error) {
      console.error('❌ 生成Excel失败:', error)
      throw new Error(`生成Excel失败: ${error.message}`)
    }
  }

  /**
   * 填充数据到工作表
   */
  _fillData(worksheet, { title, data, metadata }) {
    // 填充标题（假设标题在A1单元格）
    const titleCell = worksheet.getCell('A1')
    if (titleCell) {
      titleCell.value = title
    }

    // 填充日期（假设在B1单元格）
    const dateCell = worksheet.getCell('B1')
    if (dateCell) {
      dateCell.value = new Date().toLocaleDateString('zh-CN')
    }

    // 填充项目名称（假设在C1单元格）
    if (metadata.project_name) {
      const projectCell = worksheet.getCell('C1')
      if (projectCell) {
        projectCell.value = metadata.project_name
      }
    }

    // 填充数据表格（假设从第3行开始）
    if (Array.isArray(data) && data.length > 0) {
      const startRow = 3

      // 如果数据是对象数组
      if (typeof data[0] === 'object') {
        data.forEach((row, index) => {
          const rowIndex = startRow + index
          const values = Object.values(row)

          values.forEach((value, colIndex) => {
            const cell = worksheet.getCell(rowIndex, colIndex + 1)
            cell.value = value

            // 如果是数字，尝试格式化
            if (typeof value === 'number') {
              cell.numFmt = '#,##0.00'
            }
          })
        })
      }
      // 如果数据是二维数组
      else if (Array.isArray(data[0])) {
        data.forEach((row, rowIdx) => {
          row.forEach((value, colIdx) => {
            const cell = worksheet.getCell(startRow + rowIdx, colIdx + 1)
            cell.value = value
          })
        })
      }
    }

    // 自动计算合计（如果模板需要）
    if (metadata.autoSum && Array.isArray(data) && data.length > 0) {
      const lastRow = 3 + data.length
      const sumRow = worksheet.getRow(lastRow + 1)

      // 假设需要合计的列是数字列
      const firstRow = data[0]
      Object.values(firstRow).forEach((value, colIndex) => {
        if (typeof value === 'number') {
          const sumCell = sumRow.getCell(colIndex + 1)
          const startCell = worksheet.getCell(3, colIndex + 1).address
          const endCell = worksheet.getCell(3 + data.length - 1, colIndex + 1).address
          sumCell.value = { formula: `SUM(${startCell}:${endCell})` }
          sumCell.numFmt = '#,##0.00'
          sumCell.font = { bold: true }
        }
      })
    }
  }

  /**
   * 不使用模板直接生成Excel（回退方案）
   */
  async _generateWithoutTemplate({ title, data, template, metadata = {} }) {
    try {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Sheet1')

      // 准备表头（从数据推断）
      let headers = []
      if (Array.isArray(data) && data.length > 0) {
        if (typeof data[0] === 'object' && !Array.isArray(data[0])) {
          headers = Object.keys(data[0])
        } else if (Array.isArray(data[0])) {
          headers = data[0].map((_, idx) => `列${idx + 1}`)
        }
      }

      // 设置列宽
      worksheet.columns = headers.map(header => ({
        header,
        key: header.toLowerCase().replace(/\s+/g, '_'),
        width: 15
      }))

      // 添加标题行
      worksheet.mergeCells('A1', `${String.fromCharCode(64 + Math.max(headers.length, 1))}1`)
      const titleCell = worksheet.getCell('A1')
      titleCell.value = title
      titleCell.font = { size: 16, bold: true }
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' }

      // 添加日期
      worksheet.getCell('A2').value = `生成日期: ${new Date().toLocaleDateString('zh-CN')}`

      // 添加表头（第3行）
      const headerRow = worksheet.getRow(3)
      headers.forEach((header, index) => {
        const cell = headerRow.getCell(index + 1)
        cell.value = header
        cell.font = { bold: true }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
      })

      // 添加数据
      if (Array.isArray(data)) {
        data.forEach((row, index) => {
          const excelRow = worksheet.getRow(4 + index)
          if (typeof row === 'object' && !Array.isArray(row)) {
            Object.values(row).forEach((value, colIndex) => {
              excelRow.getCell(colIndex + 1).value = value
            })
          } else if (Array.isArray(row)) {
            row.forEach((value, colIndex) => {
              excelRow.getCell(colIndex + 1).value = value
            })
          }
        })
      }

      // 设置边框
      const lastRow = 4 + (data?.length || 0) - 1
      for (let row = 3; row <= lastRow; row++) {
        for (let col = 1; col <= headers.length; col++) {
          const cell = worksheet.getCell(row, col)
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          }
        }
      }

      const buffer = await workbook.xlsx.writeBuffer()

      console.log(`✅ Excel表格生成成功（无模板）: ${title}.xlsx (${(buffer.length / 1024).toFixed(2)} KB)`)

      return {
        buffer,
        filename: `${title}.xlsx`,
        size: buffer.length,
        template: 'generated-without-template'
      }

    } catch (error) {
      console.error('❌ 直接生成Excel失败:', error)
      throw new Error(`直接生成Excel失败: ${error.message}`)
    }
  }

  /**
   * 创建简单表格（不使用模板）- 保留兼容性
   */
  async createSimple({ title, headers, data, metadata = {} }) {
    try {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Sheet1')

      // 设置列宽
      worksheet.columns = headers.map(header => ({
        header,
        key: header.toLowerCase().replace(/\s+/g, '_'),
        width: 15
      }))

      // 添加标题行
      worksheet.mergeCells('A1', `${String.fromCharCode(64 + headers.length)}1`)
      const titleCell = worksheet.getCell('A1')
      titleCell.value = title
      titleCell.font = { size: 16, bold: true }
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' }

      // 添加日期
      worksheet.getCell('A2').value = `生成日期: ${new Date().toLocaleDateString('zh-CN')}`

      // 添加表头（第3行）
      const headerRow = worksheet.getRow(3)
      headers.forEach((header, index) => {
        const cell = headerRow.getCell(index + 1)
        cell.value = header
        cell.font = { bold: true }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
      })

      // 添加数据
      if (Array.isArray(data)) {
        data.forEach((row, index) => {
          const excelRow = worksheet.getRow(4 + index)
          Object.values(row).forEach((value, colIndex) => {
            excelRow.getCell(colIndex + 1).value = value
          })
        })
      }

      // 设置边框
      const lastRow = 4 + (data?.length || 0) - 1
      for (let row = 3; row <= lastRow; row++) {
        for (let col = 1; col <= headers.length; col++) {
          const cell = worksheet.getCell(row, col)
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          }
        }
      }

      const buffer = await workbook.xlsx.writeBuffer()

      console.log(`✅ 简单Excel表格生成成功: ${title}.xlsx`)

      return {
        buffer,
        filename: `${title}.xlsx`,
        size: buffer.length
      }

    } catch (error) {
      console.error('❌ 创建Excel失败:', error)
      throw new Error(`创建Excel失败: ${error.message}`)
    }
  }
}

// 创建单例
const excelGeneratorService = new ExcelGeneratorService()

module.exports = excelGeneratorService
