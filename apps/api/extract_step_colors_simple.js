#!/usr/bin/env node
/**
 * 从STEP文件文本内容提取颜色信息
 */
const fs = require('fs');
const path = require('path');

function extractColorFromStep(stepFilePath) {
  try {
    const content = fs.readFileSync(stepFilePath, 'utf-8');

    // 查找COLOUR_RGB定义: #123=COLOUR_RGB('',0.7,0.7,0.7);
    const colorRegex = /COLOUR_RGB\s*\([^,]*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/gi;
    const matches = [...content.matchAll(colorRegex)];

    if (matches.length > 0) {
      // 取第一个颜色（通常是主体颜色）
      const match = matches[0];
      const r = Math.round(parseFloat(match[1]) * 255);
      const g = Math.round(parseFloat(match[2]) * 255);
      const b = Math.round(parseFloat(match[3]) * 255);

      return {
        rgb: [r, g, b],
        hex: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
      };
    }

    // 如果没找到COLOUR_RGB，查找FILL_AREA_STYLE_COLOUR
    const fillColorRegex = /FILL_AREA_STYLE_COLOUR\s*\([^,]*,\s*#(\d+)\s*\)/gi;
    const fillMatches = [...content.matchAll(fillColorRegex)];

    if (fillMatches.length > 0) {
      // 找到引用的颜色ID，再查找该颜色的RGB值
      const colorId = fillMatches[0][1];
      const refColorRegex = new RegExp(`#${colorId}\\s*=\\s*COLOUR_RGB\\s*\\([^,]*,\\s*([\\d.]+)\\s*,\\s*([\\d.]+)\\s*,\\s*([\\d.]+)\\s*\\)`, 'i');
      const refMatch = content.match(refColorRegex);

      if (refMatch) {
        const r = Math.round(parseFloat(refMatch[1]) * 255);
        const g = Math.round(parseFloat(refMatch[2]) * 255);
        const b = Math.round(parseFloat(refMatch[3]) * 255);

        return {
          rgb: [r, g, b],
          hex: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
        };
      }
    }

    return null;
  } catch (error) {
    console.error(`  ❌ 读取失败: ${error.message}`);
    return null;
  }
}

function batchExtractColors(stepDir, outputFile) {
  const colorMap = {};

  const files = fs.readdirSync(stepDir).filter(f => f.endsWith('.STEP'));
  const total = files.length;

  console.log(`📂 找到 ${total} 个STEP文件`);
  console.log(`🎨 开始提取颜色...\n`);

  let extracted = 0;

  files.forEach((file, i) => {
    const partName = path.basename(file, '.STEP');
    const stepPath = path.join(stepDir, file);

    process.stdout.write(`[${i+1}/${total}] ${partName} `);

    const color = extractColorFromStep(stepPath);

    if (color) {
      colorMap[partName] = color;
      console.log(`✅ ${color.hex}`);
      extracted++;
    } else {
      console.log(`⏭️  无颜色`);
    }
  });

  // 保存
  fs.writeFileSync(outputFile, JSON.stringify(colorMap, null, 2));

  console.log(`\n✅ 颜色映射已保存: ${outputFile}`);
  console.log(`📊 提取成功: ${extracted}/${total} (${(extracted/total*100).toFixed(1)}%)`);
}

const stepDir = path.join(__dirname, '../../docs/solidworks');
const outputFile = path.join(__dirname, 'src/uploads/step_colors.json');

batchExtractColors(stepDir, outputFile);
