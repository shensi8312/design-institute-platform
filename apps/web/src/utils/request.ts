import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import axios from 'axios'
import { message } from 'antd';

// API base URL
const API_BASE = '/api';

// Get token from localStorage
const getToken = () => {
  const token = localStorage.getItem('token');
  if (!token) {
    // If no token, try to get from sessionStorage or use demo token
    return sessionStorage.getItem('token') || '';
  }
  return token;
};

// Create axios instance
const request: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
request.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
request.interceptors.response.use(
  (response: AxiosResponse) => {
    const res = response.data;
    
    // Handle success response
    if (res.success || res.code === 200 || res.code === 0) {
      return res.data || res;
    }
    
    // Handle business error
    message.error(res.message || '请求失败');
    return Promise.reject(new Error(res.message || '请求失败'));
  },
  (error) => {
    // Handle network error
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          message.error('登录已过期，请重新登录');
          // Redirect to login
          localStorage.removeItem('token');
          window.location.href = '/login';
          break;
        case 403:
          message.error('没有权限访问该资源');
          break;
        case 404:
          message.error('请求的资源不存在');
          break;
        case 500:
          message.error('服务器错误');
          break;
        default:
          message.error(data?.message || `请求失败: ${status}`);
      }
    } else if (error.request) {
      message.error('网络错误，请检查网络连接');
    } else {
      message.error('请求配置错误');
    }
    
    return Promise.reject(error);
  }
);

// Export request methods
export default request;

// Convenience methods
export const get = <T = any>(url: string, config?: AxiosRequestConfig) => 
  request.get<T, T>(url, config);

export const post = <T = any>(url: string, data?: any, config?: AxiosRequestConfig) => 
  request.post<T, T>(url, data, config);

export const put = <T = any>(url: string, data?: any, config?: AxiosRequestConfig) => 
  request.put<T, T>(url, data, config);

export const del = <T = any>(url: string, config?: AxiosRequestConfig) => 
  request.delete<T, T>(url, config);

export const patch = <T = any>(url: string, data?: any, config?: AxiosRequestConfig) => 
  request.patch<T, T>(url, data, config);
