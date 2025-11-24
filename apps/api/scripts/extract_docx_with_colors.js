/**
 * 使用 docx 库提取 Word 文件内容，保留颜色和格式
 */

const fs = require('fs');
const { DOMParser } = require('xmldom');
const JSZip = require('jszip');

/**
 * RGB 转十六进制
 */
function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/**
 * 解析颜色值
 */
function parseColor(colorNode) {
  if (!colorNode) return null;

  const val = colorNode.getAttribute('w:val');
  if (val && val !== 'auto') {
    return '#' + val;
  }

  return null;
}

/**
 * 加载并解析样式文件
 */
function parseStyles(stylesXml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(stylesXml, 'text/xml');
  const styles = {};

  const styleNodes = doc.getElementsByTagName('w:style');
  for (let i = 0; i < styleNodes.length; i++) {
    const styleNode = styleNodes[i];
    const styleId = styleNode.getAttribute('w:styleId');
    if (!styleId) continue;

    // 查找样式中的颜色定义
    const rPr = styleNode.getElementsByTagName('w:rPr')[0];
    if (rPr) {
      const colorNode = rPr.getElementsByTagName('w:color')[0];
      const color = parseColor(colorNode);
      if (color) {
        styles[styleId] = { color };
      }
    }
  }

  return styles;
}

/**
 * 解析numbering.xml
 */
function parseNumbering(numberingXml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(numberingXml, 'text/xml');
  const numbering = {};

  // 解析abstractNum定义
  const abstractNums = {};
  const abstractNumNodes = doc.getElementsByTagName('w:abstractNum');
  for (let i = 0; i < abstractNumNodes.length; i++) {
    const abstractNum = abstractNumNodes[i];
    const abstractNumId = abstractNum.getAttribute('w:abstractNumId');
    const levels = {};

    const lvlNodes = abstractNum.getElementsByTagName('w:lvl');
    for (let j = 0; j < lvlNodes.length; j++) {
      const lvl = lvlNodes[j];
      const ilvl = lvl.getAttribute('w:ilvl');

      const startNode = lvl.getElementsByTagName('w:start')[0];
      const numFmtNode = lvl.getElementsByTagName('w:numFmt')[0];
      const lvlTextNode = lvl.getElementsByTagName('w:lvlText')[0];

      levels[ilvl] = {
        start: startNode ? parseInt(startNode.getAttribute('w:val')) : 1,
        numFmt: numFmtNode ? numFmtNode.getAttribute('w:val') : 'decimal',
        lvlText: lvlTextNode ? lvlTextNode.getAttribute('w:val') : '%1.'
      };
    }

    abstractNums[abstractNumId] = levels;
  }

  // 解析num定义（映射numId到abstractNumId）
  const numNodes = doc.getElementsByTagName('w:num');
  for (let i = 0; i < numNodes.length; i++) {
    const num = numNodes[i];
    const numId = num.getAttribute('w:numId');
    const abstractNumIdNode = num.getElementsByTagName('w:abstractNumId')[0];
    if (abstractNumIdNode) {
      const abstractNumId = abstractNumIdNode.getAttribute('w:val');
      numbering[numId] = abstractNums[abstractNumId];
    }
  }

  return numbering;
}

/**
 * 格式化编号
 */
function formatNumber(num, format) {
  switch (format) {
    case 'decimal':
      return num.toString();
    case 'upperLetter':
      return String.fromCharCode(64 + num); // A, B, C...
    case 'lowerLetter':
      return String.fromCharCode(96 + num); // a, b, c...
    case 'upperRoman':
      return toRoman(num).toUpperCase();
    case 'lowerRoman':
      return toRoman(num).toLowerCase();
    case 'none':
      return '';
    default:
      return num.toString();
  }
}

/**
 * 转换为罗马数字
 */
function toRoman(num) {
  const lookup = {M:1000,CM:900,D:500,CD:400,C:100,XC:90,L:50,XL:40,X:10,IX:9,V:5,IV:4,I:1};
  let roman = '';
  for (let i in lookup) {
    while (num >= lookup[i]) {
      roman += i;
      num -= lookup[i];
    }
  }
  return roman;
}

/**
 * 生成编号文本
 */
function generateNumberText(counters, numId, ilvl, numbering) {
  if (!numbering[numId] || !numbering[numId][ilvl]) {
    return '';
  }

  const level = numbering[numId][ilvl];
  let lvlText = level.lvlText;

  // 替换 %1, %2 等占位符
  // 注意：%1 对应 ilvl=0, %2 对应 ilvl=1，以此类推
  let text = lvlText;

  // 查找所有占位符并替换
  const placeholderRegex = /%(\d+)/g;
  let match;
  const replacements = new Map();

  while ((match = placeholderRegex.exec(lvlText)) !== null) {
    const placeholderNum = parseInt(match[1]);
    const counterIndex = placeholderNum - 1; // %1 对应 index 0

    if (counters[counterIndex] !== undefined && numbering[numId][counterIndex]) {
      const formatted = formatNumber(counters[counterIndex], numbering[numId][counterIndex].numFmt);
      replacements.set(match[0], formatted);
    } else if (numbering[numId][counterIndex]) {
      // 如果计数器不存在但定义存在，使用起始值
      const startVal = numbering[numId][counterIndex].start || 1;
      counters[counterIndex] = startVal;
      const formatted = formatNumber(startVal, numbering[numId][counterIndex].numFmt);
      replacements.set(match[0], formatted);
    } else {
      // 完全没有定义，使用空字符串
      replacements.set(match[0], '');
    }
  }

  // 执行所有替换
  replacements.forEach((value, placeholder) => {
    text = text.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
  });

  return text;
}

/**
 * 处理文本run（粗体、斜体、颜色）
 */
function processRun(run, paragraphStyle, styles) {
  const textNodes = run.getElementsByTagName('w:t');
  if (textNodes.length === 0) return '';

  let text = '';
  for (let i = 0; i < textNodes.length; i++) {
    text += textNodes[i].textContent || '';
  }

  if (!text) return '';

  // 提取格式
  const rPr = run.getElementsByTagName('w:rPr')[0];
  let isBold = false;
  let isItalic = false;
  let color = null;

  if (rPr) {
    const boldNode = rPr.getElementsByTagName('w:b')[0];
    if (boldNode) isBold = true;

    const italicNode = rPr.getElementsByTagName('w:i')[0];
    if (italicNode) isItalic = true;

    const colorNode = rPr.getElementsByTagName('w:color')[0];
    color = parseColor(colorNode);
  }

  // 如果run没有颜色，检查段落样式
  if (!color && paragraphStyle && styles[paragraphStyle]) {
    color = styles[paragraphStyle].color;
  }

  // 构建 HTML
  let formattedText = text;

  if (isBold) {
    formattedText = `<strong>${formattedText}</strong>`;
  }

  if (isItalic) {
    formattedText = `<em>${formattedText}</em>`;
  }

  if (color) {
    formattedText = `<span style="color: ${color}">${formattedText}</span>`;
  }

  return formattedText;
}

/**
 * 处理表格
 */
function processTable(table, styles) {
  const rows = table.getElementsByTagName('w:tr');
  if (rows.length === 0) return '';

  let tableHtml = '<table border="1" style="border-collapse: collapse; width: 100%;">';

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = row.getElementsByTagName('w:tc');

    tableHtml += '<tr>';

    for (let j = 0; j < cells.length; j++) {
      const cell = cells[j];
      const paras = cell.getElementsByTagName('w:p');

      let cellContent = '';
      for (let k = 0; k < paras.length; k++) {
        const para = paras[k];

        // 获取段落样式
        const pPr = para.getElementsByTagName('w:pPr')[0];
        let paragraphStyle = null;
        if (pPr) {
          const pStyle = pPr.getElementsByTagName('w:pStyle')[0];
          if (pStyle) {
            paragraphStyle = pStyle.getAttribute('w:val');
          }
        }

        const runs = para.getElementsByTagName('w:r');

        let paraContent = '';
        for (let m = 0; m < runs.length; m++) {
          paraContent += processRun(runs[m], paragraphStyle, styles);
        }

        if (paraContent) {
          cellContent += (k > 0 ? '<br>' : '') + paraContent;
        }
      }

      tableHtml += `<td style="padding: 5px; border: 1px solid #ddd;">${cellContent || '&nbsp;'}</td>`;
    }

    tableHtml += '</tr>';
  }

  tableHtml += '</table>';
  return tableHtml;
}

/**
 * 提取 .docx 文件内容，转换为 HTML（保留颜色、表格、列表、编号）
 */
async function extractDocxWithColors(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(data);

    // 加载样式
    let styles = {};
    const stylesFile = zip.file('word/styles.xml');
    if (stylesFile) {
      const stylesXml = await stylesFile.async('string');
      styles = parseStyles(stylesXml);
    }

    // 加载编号定义
    let numbering = {};
    const numberingFile = zip.file('word/numbering.xml');
    if (numberingFile) {
      const numberingXml = await numberingFile.async('string');
      numbering = parseNumbering(numberingXml);
    }

    const documentXml = await zip.file('word/document.xml').async('string');
    const parser = new DOMParser();
    const doc = parser.parseFromString(documentXml, 'text/xml');

    const body = doc.getElementsByTagName('w:body')[0];
    if (!body) return '';

    let html = '';

    // 编号计数器（按numId和ilvl维护）
    const numberCounters = {};

    // 遍历body的直接子元素
    for (let i = 0; i < body.childNodes.length; i++) {
      const node = body.childNodes[i];

      if (node.nodeName === 'w:p') {
        // 段落
        const pPr = node.getElementsByTagName('w:pPr')[0];
        let paragraphStyle = null;
        let numPr = null;

        if (pPr) {
          const pStyle = pPr.getElementsByTagName('w:pStyle')[0];
          if (pStyle) {
            paragraphStyle = pStyle.getAttribute('w:val');
          }

          // 获取编号属性
          numPr = pPr.getElementsByTagName('w:numPr')[0];
        }

        const runs = node.getElementsByTagName('w:r');

        if (runs.length === 0) {
          html += '<p>&nbsp;</p>';
          continue;
        }

        let indentLevel = 0;
        let numberText = '';

        // 处理编号
        if (numPr) {
          const ilvlNode = numPr.getElementsByTagName('w:ilvl')[0];
          const numIdNode = numPr.getElementsByTagName('w:numId')[0];

          if (ilvlNode && numIdNode) {
            const ilvl = ilvlNode.getAttribute('w:val');
            const numId = numIdNode.getAttribute('w:val');
            indentLevel = parseInt(ilvl);

            // 初始化或更新计数器
            if (!numberCounters[numId]) {
              numberCounters[numId] = {};
            }

            // 重置更高层级的计数器
            for (let lvl in numberCounters[numId]) {
              if (parseInt(lvl) > parseInt(ilvl)) {
                delete numberCounters[numId][lvl];
              }
            }

            // 初始化当前层级
            if (!numberCounters[numId][ilvl]) {
              const startVal = numbering[numId] && numbering[numId][ilvl] ?
                              numbering[numId][ilvl].start : 1;
              numberCounters[numId][ilvl] = startVal;
            } else {
              numberCounters[numId][ilvl]++;
            }

            // 生成编号文本
            numberText = generateNumberText(numberCounters[numId], numId, ilvl, numbering);
          }
        }

        // 构建段落开始标签（带缩进）
        // 使用更明显的缩进：每层 40px
        let paraHtml = indentLevel > 0
          ? `<p style="margin-left: ${indentLevel * 40}px;">`
          : '<p>';

        // 添加编号文本
        if (numberText) {
          paraHtml += numberText + ' ';
        }

        for (let j = 0; j < runs.length; j++) {
          paraHtml += processRun(runs[j], paragraphStyle, styles);
        }
        paraHtml += '</p>';
        html += paraHtml;

      } else if (node.nodeName === 'w:tbl') {
        // 表格
        html += processTable(node, styles);
      }
    }

    // 替换 $ 为 ¥
    html = html.replace(/\$/g, '¥');

    // 合并连续的空白段落（保留最多2个连续空行）
    html = html.replace(/(<p>&nbsp;<\/p>){3,}/g, '<p>&nbsp;</p><p>&nbsp;</p>');

    return html;

  } catch (error) {
    console.error(`Error extracting ${filePath}:`, error.message);
    return null;
  }
}

module.exports = { extractDocxWithColors };

// 测试
if (require.main === module) {
  const testFile = process.argv[2];
  if (!testFile) {
    console.error('Usage: node extract_docx_with_colors.js <docx-file>');
    process.exit(1);
  }

  extractDocxWithColors(testFile).then(html => {
    console.log(html);
  });
}
