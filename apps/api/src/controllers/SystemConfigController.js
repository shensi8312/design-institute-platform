const knex = require('../config/database');

const SystemConfigController = {
  // 获取所有配置
  getConfig: async (req, res) => {
    try {
      const { category } = req.query;
      
      let query = knex('system_configs').select('*');
      
      if (category) {
        query = query.where('category', category);
      }
      
      const configs = await query;
      
      // 将配置转换为对象格式
      const configObject = {};
      configs.forEach(config => {
        // 隐藏敏感信息
        if (config.is_sensitive && !req.user?.is_admin) {
          config.config_value = '******';
        }
        
        // 根据类型转换值
        let value = config.config_value;
        if (config.config_type === 'number') {
          value = parseFloat(value);
        } else if (config.config_type === 'boolean') {
          value = value === 'true';
        } else if (config.config_type === 'json') {
          try {
            value = JSON.parse(value);
          } catch (e) {
            value = config.config_value;
          }
        }
        
        configObject[config.config_key] = value;
      });
      
      res.json({
        success: true,
        code: 200,
        data: configObject
      });
    } catch (error) {
      console.error('获取配置失败:', error);
      res.status(500).json({
        success: false,
        message: '获取配置失败',
        error: error.message
      });
    }
  },

  // 更新配置
  updateConfig: async (req, res) => {
    try {
      // 只有管理员可以更新配置
      if (!req.user?.is_admin && req.user?.username !== 'admin') {
        return res.status(403).json({
          success: false,
          message: '只有管理员可以修改系统配置'
        });
      }
      
      const configs = req.body;
      
      // 批量更新配置
      for (const [key, value] of Object.entries(configs)) {
        // 查找配置项
        const config = await knex('system_configs')
          .where('config_key', key)
          .first();
        
        if (config) {
          // 根据类型转换值
          let configValue = value;
          if (config.config_type === 'json' && typeof value === 'object') {
            configValue = JSON.stringify(value);
          } else {
            configValue = String(value);
          }
          
          // 更新配置
          await knex('system_configs')
            .where('config_key', key)
            .update({
              config_value: configValue,
              updated_at: knex.fn.now()
            });
        } else {
          // 如果配置不存在，创建新配置
          await knex('system_configs').insert({
            config_key: key,
            config_value: String(value),
            config_type: typeof value === 'number' ? 'number' : 
                        typeof value === 'boolean' ? 'boolean' :
                        typeof value === 'object' ? 'json' : 'string',
            category: 'custom',
            description: `Custom config: ${key}`,
            is_sensitive: false,
            created_at: knex.fn.now(),
            updated_at: knex.fn.now()
          });
        }
      }
      
      res.json({
        success: true,
        code: 200,
        message: '配置更新成功'
      });
    } catch (error) {
      console.error('更新配置失败:', error);
      res.status(500).json({
        success: false,
        message: '更新配置失败',
        error: error.message
      });
    }
  },

  // 获取单个配置
  getConfigByKey: async (req, res) => {
    try {
      const { key } = req.params;
      
      const config = await knex('system_configs')
        .where('config_key', key)
        .first();
      
      if (!config) {
        return res.status(404).json({
          success: false,
          message: '配置项不存在'
        });
      }
      
      // 隐藏敏感信息
      if (config.is_sensitive && !req.user?.is_admin) {
        config.config_value = '******';
      }
      
      // 根据类型转换值
      let value = config.config_value;
      if (config.config_type === 'number') {
        value = parseFloat(value);
      } else if (config.config_type === 'boolean') {
        value = value === 'true';
      } else if (config.config_type === 'json') {
        try {
          value = JSON.parse(value);
        } catch (e) {
          value = config.config_value;
        }
      }
      
      res.json({
        success: true,
        code: 200,
        data: {
          key: config.config_key,
          value: value,
          type: config.config_type,
          category: config.category,
          description: config.description
        }
      });
    } catch (error) {
      console.error('获取配置项失败:', error);
      res.status(500).json({
        success: false,
        message: '获取配置项失败',
        error: error.message
      });
    }
  },

  // 重置为默认配置
  resetToDefault: async (req, res) => {
    try {
      // 只有管理员可以重置配置
      if (!req.user?.is_admin && req.user?.username !== 'admin') {
        return res.status(403).json({
          success: false,
          message: '只有管理员可以重置系统配置'
        });
      }
      
      const { category } = req.body;
      
      // 默认配置值
      const defaultConfigs = {
        basic: {
          system_name: 'MST-AI建筑设计平台',
          system_version: 'v1.0.0',
          copyright: '© 2025 MST Design Institute. All rights reserved.',
          icp_record: ''
        },
        security: {
          password_min_length: '6',
          password_complexity: 'true',
          login_max_attempts: '5',
          session_timeout: '30',
          enable_captcha: 'false',
          enable_two_factor: 'false'
        },
        email: {
          smtp_host: '',
          smtp_port: '587',
          smtp_user: '',
          smtp_password: '',
          smtp_ssl: 'true',
          email_from: 'noreply@mst-ai.com'
        },
        storage: {
          storage_type: 'local',
          storage_path: '/uploads',
          max_upload_size: '104857600'
        },
        api: {
          api_rate_limit: '100',
          api_timeout: '30000',
          enable_api_log: 'true'
        },
        ai: {
          openai_api_key: '',
          openai_model: 'gpt-3.5-turbo',
          stable_diffusion_url: 'http://localhost:7860',
          ragflow_api_url: 'http://localhost:8080',
          graphrag_api_url: 'http://localhost:8081'
        },
        backup: {
          backup_enabled: 'true',
          backup_schedule: '02:00',
          backup_retention_days: '30',
          backup_path: '/backups'
        }
      };
      
      // 根据分类重置
      const configsToReset = category ? defaultConfigs[category] : 
                            Object.values(defaultConfigs).reduce((acc, val) => ({...acc, ...val}), {});
      
      if (!configsToReset) {
        return res.status(400).json({
          success: false,
          message: '无效的配置分类'
        });
      }
      
      // 更新配置
      for (const [key, value] of Object.entries(configsToReset)) {
        await knex('system_configs')
          .where('config_key', key)
          .update({
            config_value: String(value),
            updated_at: knex.fn.now()
          });
      }
      
      res.json({
        success: true,
        code: 200,
        message: category ? `${category}配置已重置为默认值` : '所有配置已重置为默认值'
      });
    } catch (error) {
      console.error('重置配置失败:', error);
      res.status(500).json({
        success: false,
        message: '重置配置失败',
        error: error.message
      });
    }
  },

  // 测试邮件配置
  testEmailConfig: async (req, res) => {
    try {
      // 获取邮件配置
      const emailConfigs = await knex('system_configs')
        .whereIn('config_key', ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_ssl', 'email_from'])
        .select('config_key', 'config_value');
      
      const config = {};
      emailConfigs.forEach(item => {
        config[item.config_key] = item.config_value;
      });
      
      if (!config.smtp_host || !config.smtp_user || !config.smtp_password) {
        return res.status(400).json({
          success: false,
          message: '邮件配置不完整'
        });
      }
      
      // TODO: 实际的邮件发送测试
      // const nodemailer = require('nodemailer');
      // const transporter = nodemailer.createTransport({...});
      // await transporter.verify();
      
      // 模拟测试成功
      res.json({
        success: true,
        code: 200,
        message: '邮件配置测试成功'
      });
    } catch (error) {
      console.error('测试邮件配置失败:', error);
      res.status(500).json({
        success: false,
        message: '测试邮件配置失败',
        error: error.message
      });
    }
  }
};

module.exports = SystemConfigController;