import axios from 'axios';
import { message } from 'antd';

// 创建axios实例
const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 120000, // 增加到120秒（2分钟）用于PID识别等耗时操作
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求拦截器
instance.interceptors.request.use(
  (config) => {
    // 添加token
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
instance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response;

      if (status === 401) {
        // token过期或无效
        message.error('登录已过期，请重新登录');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      } else if (status === 403) {
        message.error('没有权限访问');
      } else if (status === 404) {
        message.error('请求的资源不存在');
      } else if (status === 500) {
        message.error(data?.message || '服务器错误');
      }
      // 400等其他错误不在这里统一处理，让业务代码自己处理
    } else if (error.request) {
      // 请求已发出但没有收到响应（网络错误或超时）
      if (error.code === 'ECONNABORTED') {
        message.error('请求超时，请稍后重试或上传更小的文件');
      } else {
        message.error('网络错误，请检查网络连接');
      }
    } else {
      message.error('请求失败');
    }

    return Promise.reject(error);
  }
);

export default instance;