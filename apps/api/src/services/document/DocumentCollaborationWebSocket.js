/**
 * 文档协作WebSocket服务
 * 实时同步编辑状态、锁定信息、协作者在线状态
 */

const WebSocket = require('ws');

class DocumentCollaborationWebSocket {
  constructor(server) {
    this.wss = new WebSocket.Server({
      server,
      path: '/ws/document-collab'
    });

    // 存储连接: { documentId: { userId: ws } }
    this.connections = new Map();

    // 存储用户信息: { userId: { username, color } }
    this.users = new Map();

    this.initialize();
  }

  initialize() {
    this.wss.on('connection', (ws, req) => {
      console.log('📡 新的文档协作连接');

      let documentId = null;
      let userId = null;

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());

          switch (message.type) {
            case 'join':
              this.handleJoin(ws, message);
              documentId = message.documentId;
              userId = message.userId;
              break;
            case 'section_lock':
              this.handleSectionLock(message);
              break;
            case 'section_unlock':
              this.handleSectionUnlock(message);
              break;
            case 'content_change':
              this.handleContentChange(message);
              break;
            case 'cursor_move':
              this.handleCursorMove(message);
              break;
            default:
              console.warn('未知消息类型:', message.type);
          }
        } catch (error) {
          console.error('处理WebSocket消息失败:', error);
        }
      });

      ws.on('close', () => {
        if (documentId && userId) {
          this.handleLeave(documentId, userId);
        }
        console.log('📡 文档协作连接关闭');
      });

      ws.on('error', (error) => {
        console.error('📡 WebSocket错误:', error);
      });
    });

    console.log('✅ 文档协作WebSocket服务已启动: /ws/document-collab');
  }

  /**
   * 处理用户加入文档
   */
  handleJoin(ws, message) {
    const { documentId, userId, username, sectionId } = message;

    // 存储连接
    if (!this.connections.has(documentId)) {
      this.connections.set(documentId, new Map());
    }
    this.connections.get(documentId).set(userId, ws);

    // 存储用户信息
    if (!this.users.has(userId)) {
      this.users.set(userId, {
        username,
        color: this.assignColor(userId),
      });
    }

    // 通知其他用户
    this.broadcast(documentId, {
      type: 'user_joined',
      userId,
      username,
      color: this.users.get(userId).color,
      sectionId,
    }, userId);

    // 发送当前在线用户列表给新用户
    const onlineUsers = Array.from(this.connections.get(documentId).keys())
      .filter(id => id !== userId)
      .map(id => ({
        userId: id,
        username: this.users.get(id)?.username,
        color: this.users.get(id)?.color,
      }));

    ws.send(JSON.stringify({
      type: 'online_users',
      users: onlineUsers,
    }));

    console.log(`👤 用户 ${username} 加入文档 ${documentId}`);
  }

  /**
   * 处理用户离开文档
   */
  handleLeave(documentId, userId) {
    const connections = this.connections.get(documentId);
    if (connections) {
      connections.delete(userId);

      if (connections.size === 0) {
        this.connections.delete(documentId);
      }
    }

    // 通知其他用户
    this.broadcast(documentId, {
      type: 'user_left',
      userId,
    });

    console.log(`👤 用户 ${userId} 离开文档 ${documentId}`);
  }

  /**
   * 处理章节锁定
   */
  handleSectionLock(message) {
    const { documentId, sectionId, userId, username } = message;

    this.broadcast(documentId, {
      type: 'section_locked',
      sectionId,
      lockedBy: userId,
      lockedByName: username,
      timestamp: new Date().toISOString(),
    }, userId);

    console.log(`🔒 章节 ${sectionId} 被用户 ${username} 锁定`);
  }

  /**
   * 处理章节解锁
   */
  handleSectionUnlock(message) {
    const { documentId, sectionId, userId } = message;

    this.broadcast(documentId, {
      type: 'section_unlocked',
      sectionId,
      unlockedBy: userId,
      timestamp: new Date().toISOString(),
    }, userId);

    console.log(`🔓 章节 ${sectionId} 已解锁`);
  }

  /**
   * 处理内容变化
   */
  handleContentChange(message) {
    const { documentId, sectionId, userId, delta, username } = message;

    // 广播内容变化给其他用户
    this.broadcast(documentId, {
      type: 'content_changed',
      sectionId,
      userId,
      username,
      delta,
      timestamp: new Date().toISOString(),
    }, userId);
  }

  /**
   * 处理光标移动
   */
  handleCursorMove(message) {
    const { documentId, sectionId, userId, range, username } = message;

    // 广播光标位置给其他用户
    this.broadcast(documentId, {
      type: 'cursor_moved',
      sectionId,
      userId,
      username,
      color: this.users.get(userId)?.color,
      range,
    }, userId);
  }

  /**
   * 广播消息给文档的所有用户（排除发送者）
   */
  broadcast(documentId, message, excludeUserId = null) {
    const connections = this.connections.get(documentId);
    if (!connections) return;

    const messageStr = JSON.stringify(message);

    connections.forEach((ws, userId) => {
      if (userId !== excludeUserId && ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    });
  }

  /**
   * 发送消息给特定用户
   */
  sendToUser(documentId, userId, message) {
    const connections = this.connections.get(documentId);
    if (!connections) return;

    const ws = connections.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * 为用户分配颜色
   */
  assignColor(userId) {
    const colors = [
      '#1890ff', // 蓝色
      '#52c41a', // 绿色
      '#faad14', // 橙色
      '#f5222d', // 红色
      '#722ed1', // 紫色
      '#13c2c2', // 青色
      '#eb2f96', // 品红
      '#fa8c16', // 橙红
    ];

    // 基于userId哈希选择颜色
    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }

  /**
   * 获取文档在线用户数
   */
  getOnlineUsersCount(documentId) {
    const connections = this.connections.get(documentId);
    return connections ? connections.size : 0;
  }

  /**
   * 通知章节保存成功
   */
  notifySectionSaved(documentId, sectionId, savedBy, content) {
    this.broadcast(documentId, {
      type: 'section_saved',
      sectionId,
      savedBy,
      content,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 通知修订被接受/拒绝
   */
  notifyRevisionProcessed(documentId, revisionId, status, processedBy) {
    this.broadcast(documentId, {
      type: 'revision_processed',
      revisionId,
      status,
      processedBy,
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = DocumentCollaborationWebSocket;
