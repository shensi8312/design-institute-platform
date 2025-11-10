/**
 * 前端错误监控系统
 */

import React, { Component, type ReactNode } from 'react';
import { Result, Button } from 'antd';

interface ErrorInfo {
  message: string;
  stack?: string;
  source?: string;
  lineno?: number;
  colno?: number;
  timestamp: number;
  userAgent: string;
  url: string;
  userId?: string;
  extra?: any;
}

class ErrorMonitor {
  private errors: ErrorInfo[] = [];
  private maxErrors = 100;
  private reportUrl = '/api/logs/error';
  private reportInterval = 30000; // 30秒
  private timer: NodeJS.Timeout | null = null;

  constructor() {
    this.setupErrorHandlers();
    this.startReporting();
  }

  /**
   * 设置错误处理器
   */
  private setupErrorHandlers() {
    // 捕获全局错误
    window.addEventListener('error', (event) => {
      this.handleError({
        message: event.message,
        source: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      });
    });

    // 捕获未处理的Promise拒绝
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack
      });
    });

    // 捕获React错误边界之外的错误
    if (typeof window !== 'undefined') {
      const originalConsoleError = console.error;
      console.error = (...args) => {
        const errorMessage = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        
        // 忽略开发环境的某些警告
        if (!this.shouldIgnoreError(errorMessage)) {
          this.handleError({
            message: errorMessage,
            source: 'console.error'
          });
        }
        
        originalConsoleError.apply(console, args);
      };
    }
  }

  /**
   * 处理错误
   */
  private handleError(error: Partial<ErrorInfo>) {
    const errorInfo: ErrorInfo = {
      message: error.message || 'Unknown error',
      stack: error.stack,
      source: error.source,
      lineno: error.lineno,
      colno: error.colno,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: this.getUserId(),
      extra: error.extra
    };

    // 添加到错误队列
    this.errors.push(errorInfo);

    // 限制错误数量
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    // 严重错误立即上报
    if (this.isCriticalError(errorInfo)) {
      this.reportErrors();
    }

    // 开发环境打印错误
    if (import.meta.env.DEV) {
      console.group('🚨 Error Captured');
      console.error('Message:', errorInfo.message);
      if (errorInfo.stack) {
        console.error('Stack:', errorInfo.stack);
      }
      console.error('URL:', errorInfo.url);
      console.groupEnd();
    }
  }

  /**
   * 判断是否应该忽略错误
   */
  private shouldIgnoreError(message: string): boolean {
    const ignorePatterns = [
      /ResizeObserver loop limit exceeded/,
      /Non-Error promise rejection captured/,
      /Network request failed/,
      /Failed to fetch/,
      /Load failed/,
      /Script error/,
      /TypeError: Failed to fetch dynamically imported module/
    ];

    return ignorePatterns.some(pattern => pattern.test(message));
  }

  /**
   * 判断是否为严重错误
   */
  private isCriticalError(error: ErrorInfo): boolean {
    const criticalPatterns = [
      /Cannot read prop/,
      /Cannot access/,
      /is not defined/,
      /Maximum call stack/,
      /out of memory/
    ];

    return criticalPatterns.some(pattern => pattern.test(error.message));
  }

  /**
   * 获取用户ID
   */
  private getUserId(): string | undefined {
    try {
      const userInfo = localStorage.getItem('userInfo');
      if (userInfo) {
        const user = JSON.parse(userInfo);
        return user.id;
      }
    } catch {
      // 忽略解析错误
    }
    return undefined;
  }

  /**
   * 开始定期上报
   */
  private startReporting() {
    this.timer = setInterval(() => {
      if (this.errors.length > 0) {
        this.reportErrors();
      }
    }, this.reportInterval);
  }

  /**
   * 上报错误
   */
  private async reportErrors() {
    if (this.errors.length === 0) return;

    const errorsToReport = [...this.errors];
    this.errors = [];

    try {
      const token = localStorage.getItem('token');
      await fetch(this.reportUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          errors: errorsToReport,
          environment: import.meta.env.MODE,
          timestamp: Date.now()
        })
      });
    } catch (error) {
      // 上报失败，将错误放回队列
      this.errors.unshift(...errorsToReport);
      console.error('Failed to report errors:', error);
    }
  }

  /**
   * 手动记录错误
   */
  public logError(message: string, extra?: any) {
    this.handleError({
      message,
      extra,
      source: 'manual'
    });
  }

  /**
   * 记录性能指标
   */
  public logPerformance() {
    if ('performance' in window && 'getEntriesByType' in performance) {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      
      if (navigation) {
        const metrics = {
          dns: navigation.domainLookupEnd - navigation.domainLookupStart,
          tcp: navigation.connectEnd - navigation.connectStart,
          ttfb: navigation.responseStart - navigation.requestStart,
          download: navigation.responseEnd - navigation.responseStart,
          domParse: navigation.domInteractive - navigation.responseEnd,
          domReady: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          load: navigation.loadEventEnd - navigation.loadEventStart,
          total: navigation.loadEventEnd - navigation.fetchStart
        };

        // 记录性能数据
        this.handleError({
          message: 'Performance Metrics',
          extra: metrics,
          source: 'performance'
        });
      }
    }
  }

  /**
   * 清理
   */
  public destroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    
    // 上报剩余错误
    this.reportErrors();
  }
}

// 创建单例
const errorMonitor = new ErrorMonitor();

// 页面卸载时上报
window.addEventListener('beforeunload', () => {
  errorMonitor.destroy();
});

// React错误边界组件
interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    errorMonitor.logError(error.message, {
      componentStack: errorInfo.componentStack,
      stack: error.stack
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Result
          status="500"
          title="页面出错了"
          subTitle={this.state.error?.message || '抱歉，页面遇到了一些问题'}
          extra={
            <Button type="primary" onClick={this.handleReset}>
              重新加载
            </Button>
          }
        />
      );
    }

    return this.props.children;
  }
}

export default errorMonitor;
