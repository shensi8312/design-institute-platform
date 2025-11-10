import React, { useState } from 'react';
import { message } from 'antd';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axios';
import './Login.css';

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      message.error('请输入用户名和密码');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('/api/auth/login', {
        username,
        password,
      });

      if (response.data.success) {
        localStorage.setItem('token', response.data.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.data.user));
        localStorage.setItem('permissions', JSON.stringify(response.data.data.user.permissions || []));
        
        message.success('登录成功');
        navigate('/dashboard');
      } else {
        message.error(response.data.message || '登录失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '登录失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <span className="logo">🏗️</span>
          <h1>MST-设计平台</h1>
          <p>AI辅助设计平台</p>
        </div>
        
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">用户名</label>
            <div className="input-wrapper">
              <span className="input-icon">👤</span>
              <input
                type="text"
                className="form-input"
                placeholder="请输入用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                autoComplete="username"
              />
            </div>
          </div>
          
          <div className="form-group">
            <label className="form-label">密码</label>
            <div className="input-wrapper">
              <span className="input-icon">🔒</span>
              <input
                type="password"
                className="form-input"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
              />
            </div>
          </div>
          
          <div className="form-checkbox">
            <input
              type="checkbox"
              id="remember"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <label htmlFor="remember">记住密码</label>
          </div>

          <button 
            type="submit" 
            className={`login-button ${loading ? 'loading' : ''}`}
            disabled={loading}
          >
            {loading ? '登录中...' : '登 录'}
          </button>
        </form>
        
        <div className="login-footer">
          <p>© 2025 MST设计平台 版权所有</p>
        </div>
      </div>
    </div>
  );
};

export default Login;