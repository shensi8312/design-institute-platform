import React, { useEffect, useMemo, useState, useRef, type ComponentProps } from 'react';
import { Card, Row, Col, Typography, List, Tag, Alert, Space, Skeleton, Badge, notification } from 'antd';
import { AlertOutlined, VideoCameraOutlined, EyeOutlined, SoundOutlined } from '@ant-design/icons';
import type { DigitalSiteAlert } from '../../api/digitalSite'
import { getAlerts } from '../../api/digitalSite'
import { API_BASE_URL, VIDEO_BASE_URL } from '../../config/api';

const { Title, Text } = Typography;

const fallbackAlerts: DigitalSiteAlert[] = [
  {
    id: 'alert_001',
    siteId: 'site_alpha',
    projectId: 'site_alpha',
    level: 'high',
    alertLevel: 'high',
    type: 'helmet_missing',
    alertCode: 'helmet_missing',
    title: '安全帽缺失',
    alertTitle: '安全帽缺失',
    message: '1号摄像头检测到 1 名人员未佩戴安全帽',
    alertMessage: '1号摄像头检测到 1 名人员未佩戴安全帽',
    createdAt: new Date(Date.now() - 120000).toISOString(),
    detectedAt: new Date(Date.now() - 120000).toISOString(),
    handled: false,
    cameraId: 'camera-01',
    imageUrl: '',
    ackStatus: 'unread',
    tags: [{ id: 'tag_safety', label: '安全监控' }],
    confidence: 0.92
  },
  {
    id: 'alert_002',
    siteId: 'site_beta',
    projectId: 'site_beta',
    level: 'medium',
    alertLevel: 'medium',
    type: 'intrusion',
    alertCode: 'intrusion',
    title: '禁区入侵',
    alertTitle: '禁区入侵',
    message: '3号摄像头检测到人员进入限制区域',
    alertMessage: '3号摄像头检测到人员进入限制区域',
    createdAt: new Date(Date.now() - 300000).toISOString(),
    detectedAt: new Date(Date.now() - 300000).toISOString(),
    handled: false,
    cameraId: 'camera-03',
    imageUrl: '',
    ackStatus: 'unread',
    tags: [{ id: 'tag_safety', label: '安全监控' }],
    confidence: 0.81
  },
  {
    id: 'alert_003',
    siteId: 'site_gamma',
    projectId: 'site_gamma',
    level: 'high',
    alertLevel: 'high',
    type: 'smoke_detection',
    alertCode: 'smoke_detection',
    title: '烟雾检测',
    alertTitle: '烟雾检测',
    message: '5号摄像头检测到疑似烟雾',
    alertMessage: '5号摄像头检测到疑似烟雾',
    createdAt: new Date(Date.now() - 60000).toISOString(),
    detectedAt: new Date(Date.now() - 60000).toISOString(),
    handled: false,
    cameraId: 'camera-05',
    imageUrl: '',
    ackStatus: 'unread',
    tags: [{ id: 'tag_fire', label: '消防安全' }],
    confidence: 0.88
  },
  {
    id: 'alert_004',
    siteId: 'site_delta',
    projectId: 'site_delta',
    level: 'low',
    alertLevel: 'low',
    type: 'personnel_count',
    alertCode: 'personnel_count',
    title: '人员超限',
    alertTitle: '人员超限',
    message: '7号摄像头检测到区域人员超过限制',
    alertMessage: '7号摄像头检测到区域人员超过限制',
    createdAt: new Date(Date.now() - 600000).toISOString(),
    detectedAt: new Date(Date.now() - 600000).toISOString(),
    handled: false,
    cameraId: 'camera-07',
    imageUrl: '',
    ackStatus: 'acknowledged',
    tags: [{ id: 'tag_count', label: '人数监控' }],
    confidence: 0.75
  }
];

// 12个摄像头,每个摄像头对应一个不同的视频文件
const cameras = [
  { id: 'camera-01', name: '1号 - 主入口', location: '主入口监控', status: 'online', videoFile: '2025-10-11 141932_domain_adapted_h264.mp4' },
  { id: 'camera-02', name: '2号 - 施工区A', location: '东侧施工区', status: 'online', videoFile: '2025-10-11 142459_domain_adapted_h264.mp4' },
  { id: 'camera-03', name: '3号 - 施工区B', location: '西侧施工区', status: 'online', videoFile: '2025-10-11 142938_domain_adapted_h264.mp4' },
  { id: 'camera-04', name: '4号 - 材料区', location: '北侧仓库', status: 'online', videoFile: '2025-10-11 143127_domain_adapted_h264.mp4' },
  { id: 'camera-05', name: '5号 - 办公区', location: '临时办公室', status: 'online', videoFile: '2025-10-11 143210_domain_adapted_h264.mp4' },
  { id: 'camera-06', name: '6号 - 塔吊区', location: '塔吊作业区', status: 'online', videoFile: '2025-10-11 143344_domain_adapted_h264.mp4' },
  { id: 'camera-07', name: '7号 - 南出口', location: '南侧出口', status: 'online', videoFile: '2025-10-11 143547_domain_adapted_h264.mp4' },
  { id: 'camera-08', name: '8号 - 周边围墙', location: '周边安全', status: 'online', videoFile: '2025-10-11 143920_domain_adapted_h264.mp4' },
  { id: 'camera-09', name: '9号 - 北区监控', location: '北侧区域', status: 'online', videoFile: '2025-10-11 144021_domain_adapted_h264.mp4' },
  { id: 'camera-10', name: '10号 - 东区监控', location: '东侧区域', status: 'online', videoFile: '2025-10-11 144106_domain_adapted_h264.mp4' },
  { id: 'camera-11', name: '11号 - 西区监控', location: '西侧区域', status: 'online', videoFile: '2025-10-11 144528_domain_adapted_h264.mp4' },
  { id: 'camera-12', name: '12号 - 全景监控', location: '制高点', status: 'online', videoFile: '2025-10-11 144552_domain_adapted_h264.mp4' }
];

const levelColorMap: Record<string, ComponentProps<typeof Tag>['color']> = {
  high: 'red',
  medium: 'orange',
  low: 'blue',
  info: 'default'
};

const DigitalSiteAlerts: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [alerts, setAlerts] = useState<DigitalSiteAlert[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [newAlertIds, setNewAlertIds] = useState<Set<string>>(new Set());
  const alertListRef = useRef<HTMLDivElement>(null);
  const [api, contextHolder] = notification.useNotification();

  // 模拟动态告警生成
  const generateRandomAlert = (): DigitalSiteAlert => {
    const alertTypes = [
      { type: 'helmet_missing', title: '安全帽缺失', level: 'high' },
      { type: 'intrusion', title: '禁区入侵', level: 'medium' },
      { type: 'smoke_detection', title: '烟雾检测', level: 'high' },
      { type: 'personnel_count', title: '人员超限', level: 'low' },
      { type: 'unsafe_behavior', title: '不安全行为', level: 'medium' },
    ];

    const randomType = alertTypes[Math.floor(Math.random() * alertTypes.length)];
    const randomCamera = cameras[Math.floor(Math.random() * cameras.length)];
    const now = new Date();

    return {
      id: `alert_${Date.now()}_${Math.random()}`,
      siteId: 'site_live',
      projectId: 'site_live',
      level: randomType.level as 'high' | 'medium' | 'low',
      alertLevel: randomType.level as 'high' | 'medium' | 'low',
      type: randomType.type,
      alertCode: randomType.type,
      title: randomType.title,
      alertTitle: randomType.title,
      message: `${randomCamera.name}检测到${randomType.title}`,
      alertMessage: `${randomCamera.name}检测到${randomType.title}`,
      createdAt: now.toISOString(),
      detectedAt: now.toISOString(),
      handled: false,
      cameraId: randomCamera.id,
      imageUrl: '',
      ackStatus: 'unread',
      tags: [{ id: 'tag_auto', label: '自动识别' }],
      confidence: 0.75 + Math.random() * 0.2
    };
  };

  // 显示新告警通知
  const showAlertNotification = (alert: DigitalSiteAlert) => {
    const camera = cameras.find(c => c.id === alert.cameraId);
    const levelColor = levelColorMap[alert.level || 'info'];

    api.warning({
      message: (
        <Space>
          <SoundOutlined style={{ color: levelColor === 'red' ? '#ff4d4f' : '#fa8c16' }} />
          <span style={{ fontWeight: 'bold' }}>{alert.alertTitle || alert.title}</span>
        </Space>
      ),
      description: (
        <div>
          <div>{alert.alertMessage || alert.message}</div>
          <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>
            📹 {camera?.name || alert.cameraId}
          </div>
        </div>
      ),
      placement: 'topRight',
      duration: 4,
      style: {
        background: levelColor === 'red' ? 'rgba(255, 77, 79, 0.1)' : 'rgba(250, 140, 22, 0.1)'
      }
    });
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        // 尝试连接后端API（验证连接）
        await getAlerts({ pageSize: 1 });
        console.log('已连接到告警API，使用模拟告警系统演示');
      } catch (error) {
        console.warn('数字工地告警API连接失败，使用模拟告警系统，错误信息:', error);
      } finally {
        // 无论如何都从空列表开始，只显示动态生成的告警
        setAlerts([]);
        setLoading(false);
      }
    };

    loadData();

    // 初始化后3秒生成第一个告警（演示用）
    const initialAlertTimeout = setTimeout(() => {
      const initialAlert = generateRandomAlert();
      setAlerts(prev => [initialAlert, ...prev]);
      setNewAlertIds(prev => new Set([...prev, initialAlert.id]));
      showAlertNotification(initialAlert);

      // 3秒后移除"新"标记
      setTimeout(() => {
        setNewAlertIds(prev => {
          const next = new Set(prev);
          next.delete(initialAlert.id);
          return next;
        });
      }, 3000);

      // 8-15秒后自动移除
      setTimeout(() => {
        setAlerts(prev => prev.filter(alert => alert.id !== initialAlert.id));
        console.log(`告警已自动解除: ${initialAlert.alertTitle}`);
      }, Math.random() * 7000 + 8000);
    }, 3000);

    // 模拟动态告警 - 每10-30秒随机生成一个新告警
    const alertInterval = setInterval(() => {
      const newAlert = generateRandomAlert();

      setAlerts(prev => [newAlert, ...prev]);
      setNewAlertIds(prev => new Set([...prev, newAlert.id]));

      // 显示通知
      showAlertNotification(newAlert);

      // 3秒后移除"新"标记
      setTimeout(() => {
        setNewAlertIds(prev => {
          const next = new Set(prev);
          next.delete(newAlert.id);
          return next;
        });
      }, 3000);

      // 5-15秒后自动移除该告警（模拟告警处理/解除）
      const removeDelay = Math.random() * 10000 + 5000; // 5-15秒
      setTimeout(() => {
        setAlerts(prev => prev.filter(alert => alert.id !== newAlert.id));
        console.log(`告警已自动解除: ${newAlert.alertTitle} - ${cameras.find(c => c.id === newAlert.cameraId)?.name}`);
      }, removeDelay);
    }, Math.random() * 20000 + 10000); // 10-30秒随机

    return () => {
      clearTimeout(initialAlertTimeout);
      clearInterval(alertInterval);
    };
  }, []);

  const statsByLevel = useMemo(() => {
    const stats: Record<string, number> = {};
    alerts.forEach(alert => {
      const key = alert.alertLevel || alert.level || 'info';
      stats[key] = (stats[key] || 0) + 1;
    });
    return stats;
  }, [alerts]);

  // 获取摄像头的告警数量
  const getCameraAlertCount = (cameraId: string) => {
    return alerts.filter(alert => alert.cameraId === cameraId).length;
  };

  // 获取摄像头的最高告警等级
  const getCameraHighestLevel = (cameraId: string) => {
    const cameraAlerts = alerts.filter(alert => alert.cameraId === cameraId);
    if (cameraAlerts.length === 0) return null;

    const levels = ['high', 'medium', 'low', 'info'];
    for (const level of levels) {
      if (cameraAlerts.some(alert => (alert.alertLevel || alert.level) === level)) {
        return level;
      }
    }
    return 'info';
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement>, cameraId: string) => {
    console.error(`摄像头 ${cameraId} 视频加载失败:`, e);
  };

  return (
    <div style={{ padding: 24, background: '#0a0e27', minHeight: '100vh' }}>
      {contextHolder}
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {/* 标题区域 */}
        <div>
          <Title level={3} style={{ color: '#fff', margin: 0 }}>
            <VideoCameraOutlined /> 实时监控中心
          </Title>
          <Text style={{ color: '#8c8c8c' }}>九宫格摄像头实时画面 + 智能告警识别</Text>
        </div>

        {errorMessage && (
          <Alert type="warning" message={errorMessage} showIcon />
        )}

        {/* 告警统计 */}
        <Card
          bodyStyle={{ padding: '12px 24px' }}
          style={{ background: '#141832', borderColor: '#1f2544' }}
        >
          <Space size={24}>
            <Text strong style={{ color: '#fff' }}>告警统计:</Text>
            {Object.keys(statsByLevel).length === 0 && (
              <Text type="secondary">暂无告警数据</Text>
            )}
            {Object.entries(statsByLevel).map(([level, count]) => (
              <Badge
                key={level}
                count={count}
                style={{ backgroundColor: levelColorMap[level] === 'red' ? '#ff4d4f' : levelColorMap[level] === 'orange' ? '#fa8c16' : '#1890ff' }}
                showZero
              >
                <span style={{
                  padding: '4px 16px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: 16,
                  color: '#fff'
                }}>
                  {level.toUpperCase()}
                </span>
              </Badge>
            ))}
          </Space>
        </Card>

        <Row gutter={16}>
          {/* 左侧：12宫格摄像头 (3x4) */}
          <Col xs={24} lg={16}>
            <Card
              title={
                <Space>
                  <EyeOutlined />
                  <span style={{ color: '#fff' }}>实时监控画面 (12路)</span>
                </Space>
              }
              bodyStyle={{ padding: 12, background: '#000' }}
              style={{ background: '#141832', borderColor: '#1f2544' }}
              headStyle={{ background: '#141832', borderColor: '#1f2544', color: '#fff' }}
            >
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gridTemplateRows: 'repeat(4, 1fr)',
                gap: 8
              }}>
                {cameras.map((camera, index) => {
                  const alertCount = getCameraAlertCount(camera.id);
                  const highestLevel = getCameraHighestLevel(camera.id);

                  return (
                    <div
                      key={camera.id}
                      style={{
                        position: 'relative',
                        background: '#1a1a1a',
                        borderRadius: 4,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: selectedCamera === camera.id ? '2px solid #1890ff' : '2px solid transparent',
                        transition: 'all 0.3s'
                      }}
                      onClick={() => setSelectedCamera(camera.id)}
                    >
                      {loading ? (
                        <div style={{ aspectRatio: '16/9' }}>
                          <Skeleton.Image active style={{ width: '100%', height: '100%' }} />
                        </div>
                      ) : (
                        <>
                          <video
                            key={camera.id}
                            src={`${API_BASE_URL}/digital-site/video-proxy?url=${encodeURIComponent(`${VIDEO_BASE_URL}/${camera.videoFile}`)}`}
                            style={{ width: '100%', aspectRatio: '16/9', display: 'block', background: '#000' }}
                            autoPlay
                            muted
                            loop
                            playsInline
                            controls={false}
                            preload="auto"
                            onError={(e) => handleVideoError(e, camera.id)}
                            onLoadedData={() => console.log(`视频加载成功: ${camera.name}`)}
                          />

                          {/* 摄像头信息覆盖层 */}
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            background: 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, transparent 100%)',
                            padding: '8px',
                            color: '#fff',
                            fontSize: 12
                          }}>
                            <div style={{ fontWeight: 'bold' }}>{camera.name}</div>
                            <div style={{ fontSize: 11, opacity: 0.8 }}>{camera.location}</div>
                          </div>

                          {/* 告警状态指示器 */}
                          <div style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: alertCount > 0
                              ? (highestLevel === 'high' ? '#ff4d4f' : highestLevel === 'medium' ? '#fa8c16' : '#1890ff')
                              : '#52c41a',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: alertCount > 0
                              ? '0 0 12px rgba(255, 77, 79, 0.8)'
                              : '0 0 8px rgba(82, 196, 26, 0.5)',
                            animation: alertCount > 0 ? 'pulse 2s ease-in-out infinite' : 'none',
                            transition: 'all 0.5s ease-in-out'
                          }}>
                            <AlertOutlined style={{
                              color: '#fff',
                              fontSize: 16,
                              filter: alertCount > 0 ? 'drop-shadow(0 0 3px rgba(255,255,255,0.8))' : 'none'
                            }} />
                          </div>

                          {/* 在线状态 */}
                          <div style={{
                            position: 'absolute',
                            bottom: 8,
                            left: 8,
                            background: 'rgba(0,0,0,0.6)',
                            padding: '2px 8px',
                            borderRadius: 10,
                            fontSize: 11,
                            color: '#52c41a',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}>
                            <span style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: '#52c41a',
                              display: 'inline-block'
                            }} />
                            在线
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </Col>

          {/* 右侧：告警列表 */}
          <Col xs={24} lg={8}>
            <Card
              title={
                <Space>
                  <AlertOutlined />
                  <span style={{ color: '#fff' }}>识别告警信息</span>
                </Space>
              }
              bodyStyle={{ padding: 0, maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}
              style={{ background: '#141832', borderColor: '#1f2544' }}
              headStyle={{ background: '#141832', borderColor: '#1f2544', color: '#fff' }}
            >
              <List
                dataSource={alerts}
                loading={loading}
                locale={{ emptyText: '暂无告警信息' }}
                renderItem={(item) => {
                  const level = item.level || item.alertLevel || 'info';
                  const levelColor = levelColorMap[level];
                  const isNew = newAlertIds.has(item.id);

                  return (
                    <List.Item
                      key={item.id}
                      style={{
                        alignItems: 'flex-start',
                        padding: '16px',
                        background: isNew
                          ? 'linear-gradient(90deg, rgba(255, 77, 79, 0.2) 0%, rgba(255, 77, 79, 0.05) 100%)'
                          : selectedCamera === item.cameraId
                            ? 'rgba(24, 144, 255, 0.1)'
                            : 'transparent',
                        borderBottom: '1px solid #1f2544',
                        borderLeft: isNew ? '3px solid #ff4d4f' : 'none',
                        transition: 'all 0.3s',
                        animation: isNew ? 'slideIn 0.5s ease-out' : 'none'
                      }}
                    >
                      <List.Item.Meta
                        avatar={
                          <div style={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            background: levelColor === 'red' ? 'rgba(255, 77, 79, 0.2)' : levelColor === 'orange' ? 'rgba(250, 140, 22, 0.2)' : 'rgba(24, 144, 255, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 18
                          }}>
                            <AlertOutlined style={{
                              color: levelColor === 'red' ? '#ff4d4f' : levelColor === 'orange' ? '#fa8c16' : '#1890ff'
                            }} />
                          </div>
                        }
                        title={
                          <Space direction="vertical" size={4} style={{ width: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              {isNew && (
                                <Tag
                                  color="red"
                                  style={{
                                    animation: 'pulse 1s ease-in-out infinite',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  NEW
                                </Tag>
                              )}
                              <Tag color={levelColor}>
                                {level.toUpperCase()}
                              </Tag>
                              <Text strong style={{ color: '#fff' }}>
                                {item.alertTitle || item.title}
                              </Text>
                            </div>
                          </Space>
                        }
                        description={
                          <Space direction="vertical" size={6} style={{ width: '100%' }}>
                            <Text style={{ color: '#d9d9d9', fontSize: 13 }}>
                              {(item.alertMessage || item.message || '').slice(0, 100)}
                            </Text>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12 }}>
                              <Text type="secondary">
                                📹 {cameras.find(c => c.id === item.cameraId)?.name || item.cameraId || '未知'}
                              </Text>
                              <Text type="secondary">
                                🕐 {item.detectedAt ? new Date(item.detectedAt).toLocaleTimeString() : '—'}
                              </Text>
                            </div>

                            {item.confidence !== undefined && (
                              <div style={{ fontSize: 12 }}>
                                <Text type="secondary">
                                  置信度: {(item.confidence * 100).toFixed(0)}%
                                </Text>
                                <div style={{
                                  marginTop: 4,
                                  height: 4,
                                  background: 'rgba(255,255,255,0.1)',
                                  borderRadius: 2,
                                  overflow: 'hidden'
                                }}>
                                  <div style={{
                                    width: `${item.confidence * 100}%`,
                                    height: '100%',
                                    background: item.confidence > 0.8 ? '#52c41a' : item.confidence > 0.6 ? '#fa8c16' : '#ff4d4f',
                                    transition: 'width 0.3s'
                                  }} />
                                </div>
                              </div>
                            )}

                            {item.tags && item.tags.length > 0 && (
                              <Space size={4} wrap>
                                {item.tags.map(tag => (
                                  <Tag
                                    key={`${item.id}-${tag.id}`}
                                    style={{ fontSize: 11, margin: 0 }}
                                  >
                                    {tag.label || tag.name || tag.id}
                                  </Tag>
                                ))}
                              </Space>
                            )}
                          </Space>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            </Card>
          </Col>
        </Row>
      </Space>
    </div>
  );
};

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
`;
if (!document.head.querySelector('style[data-alert-animations]')) {
  style.setAttribute('data-alert-animations', 'true');
  document.head.appendChild(style);
}

export default DigitalSiteAlerts;
