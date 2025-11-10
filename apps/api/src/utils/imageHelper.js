/**
 * 图片数据处理助手
 * 统一处理各种格式的图片输入
 */

class ImageHelper {
  /**
   * 将各种格式的图片数据转换为Buffer
   * @param {*} imageData - 可能是Buffer、Base64字符串、或文件对象
   * @returns {Buffer} 图片的Buffer数据
   */
  static toBuffer(imageData) {
    if (!imageData) {
      return null;
    }

    // 已经是Buffer
    if (Buffer.isBuffer(imageData)) {
      console.log('  📷 图片格式: Buffer');
      return imageData;
    }

    // Base64字符串
    if (typeof imageData === 'string') {
      console.log('  📷 图片格式: Base64字符串');
      console.log('  📷 原始字符串长度:', imageData.length);
      console.log('  📷 前50个字符:', imageData.substring(0, 50));
      
      // 移除data:image/xxx;base64,前缀
      let base64Data = imageData;
      if (base64Data.includes(',')) {
        console.log('  📷 检测到data URL格式，移除前缀');
        const parts = base64Data.split(',');
        console.log('  📷 前缀:', parts[0]);
        base64Data = parts[1];
        console.log('  📷 Base64数据长度:', base64Data ? base64Data.length : 0);
      }
      
      // 移除可能的换行符和空格
      base64Data = base64Data.replace(/[\r\n\s]/g, '');
      console.log('  📷 清理后Base64长度:', base64Data.length);
      
      try {
        const buffer = Buffer.from(base64Data, 'base64');
        console.log('  📷 解码后Buffer长度:', buffer.length, '字节');
        
        // 验证是否为有效图片
        if (buffer.length < 100) {
          console.error('  ❌ Buffer太小，可能解码失败');
          console.error('  ❌ Base64前100字符:', base64Data.substring(0, 100));
          return null;
        }
        
        return buffer;
      } catch (error) {
        console.error('Base64解码失败:', error);
        console.error('Base64数据前100字符:', base64Data.substring(0, 100));
        return null;
      }
    }

    // Express multer文件对象
    if (imageData.buffer) {
      console.log('  📷 图片格式: Multer文件对象');
      return imageData.buffer;
    }

    // 其他格式
    console.warn('  ⚠️ 未知的图片格式:', typeof imageData);
    return null;
  }

  /**
   * 验证图片Buffer是否有效
   */
  static isValidImageBuffer(buffer) {
    if (!buffer || !Buffer.isBuffer(buffer)) {
      return false;
    }

    // 检查是否太小（至少要有几百字节）
    if (buffer.length < 100) {
      return false;
    }

    // 检查常见图片格式的魔术字节
    // JPEG: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return true;
    }
    
    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && 
        buffer[2] === 0x4E && buffer[3] === 0x47) {
      return true;
    }

    // GIF: 47 49 46
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      return true;
    }

    // BMP: 42 4D
    if (buffer[0] === 0x42 && buffer[1] === 0x4D) {
      return true;
    }

    // 不是已知的图片格式，但可能仍然有效
    console.warn('  ⚠️ 未识别的图片格式，但尝试继续处理');
    return true;
  }

  /**
   * 从请求中提取图片数据
   * 支持多种输入方式：
   * 1. multipart/form-data 文件上传
   * 2. JSON中的base64字符串
   * 3. 直接的二进制数据
   */
  static extractFromRequest(req) {
    let imageBuffer = null;

    // 1. 检查文件上传（multipart/form-data）
    if (req.file && req.file.buffer) {
      console.log('  📷 来源: 文件上传');
      imageBuffer = req.file.buffer;
    }
    // 2. 检查body中的image字段（base64）
    else if (req.body && req.body.image) {
      console.log('  📷 来源: body.image (base64)');
      imageBuffer = this.toBuffer(req.body.image);
    }
    // 3. 检查body.data中的image字段（嵌套的base64）
    else if (req.body && req.body.data) {
      const data = typeof req.body.data === 'string' 
        ? JSON.parse(req.body.data) 
        : req.body.data;
        
      // 检查直接的image字段
      if (data.image) {
        console.log('  📷 来源: body.data.image (base64)');
        imageBuffer = this.toBuffer(data.image);
      }
      // 检查input.image字段（Ruby客户端格式）
      else if (data.input && data.input.image) {
        console.log('  📷 来源: body.data.input.image (Ruby客户端base64)');
        imageBuffer = this.toBuffer(data.input.image);
      }
    }
    // 4. 检查params中的image字段
    else if (req.params && req.params.image) {
      console.log('  📷 来源: params.image');
      imageBuffer = this.toBuffer(req.params.image);
    }

    // 验证图片数据
    if (imageBuffer && this.isValidImageBuffer(imageBuffer)) {
      console.log(`  ✅ 成功提取图片数据 (${(imageBuffer.length / 1024).toFixed(2)} KB)`);
      return imageBuffer;
    }

    console.warn('  ❌ 未能提取有效的图片数据');
    return null;
  }
}

module.exports = ImageHelper;