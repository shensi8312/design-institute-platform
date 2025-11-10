import { useState, useCallback } from 'react';
import axios from '../utils/axios';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  timestamp: Date;
  sources?: string[];
  attachments?: any[];
  outputFiles?: any[];
}

interface Conversation {
  id: string;
  title: string;
  scope: string;
  lastActivityAt: string;
  messageCount: number;
}

export const useConversation = () => {
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(
    localStorage.getItem('currentConversationId')
  );
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);

  // 创建新会话
  const createConversation = useCallback(async (scope: string = 'all', title: string = '新对话') => {
    try {
      const { data } = await axios.post('/api/chat/history/sessions', { scope, title });
      if (data.success) {
        setCurrentConversationId(data.data.id);
        localStorage.setItem('currentConversationId', data.data.id);
        return data.data;
      }
    } catch (error) {
      console.error('创建会话失败:', error);
      throw error;
    }
  }, []);

  // 获取用户所有会话
  const fetchConversations = useCallback(async (page = 1, pageSize = 20) => {
    try {
      setLoading(true);
      const { data } = await axios.get(`/api/chat/history/sessions?page=${page}&pageSize=${pageSize}`);
      if (data.success) {
        setConversations(data.data.conversations);
        return data.data;
      }
    } catch (error) {
      console.error('获取会话列表失败:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // 获取会话的所有消息
  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      setLoading(true);
      const { data } = await axios.get(`/api/chat/history/sessions/${conversationId}/messages`);
      if (data.success) {
        return data.data.messages.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          thinking: msg.thinking,
          timestamp: new Date(msg.created_at),
          sources: msg.sources && msg.sources.length > 0 ? msg.sources : undefined,
          attachments: msg.attachments && msg.attachments.length > 0 ? msg.attachments : undefined,
          outputFiles: msg.output_files && msg.output_files.length > 0 ? msg.output_files : undefined,
        }));
      }
    } catch (error) {
      console.error('获取消息列表失败:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // 添加消息到会话
  const addMessage = useCallback(async (
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    extras?: any
  ) => {
    try {
      const { data } = await axios.post(`/api/chat/history/sessions/${conversationId}/messages`, {
        role,
        content,
        ...extras
      });
      return data;
    } catch (error) {
      console.error('添加消息失败:', error);
      throw error;
    }
  }, []);

  // 删除会话
  const deleteConversation = useCallback(async (conversationId: string) => {
    try {
      await axios.delete(`/api/chat/history/sessions/${conversationId}`);
      if (currentConversationId === conversationId) {
        setCurrentConversationId(null);
        localStorage.removeItem('currentConversationId');
      }
      await fetchConversations();
    } catch (error) {
      console.error('删除会话失败:', error);
      throw error;
    }
  }, [currentConversationId, fetchConversations]);

  // 切换会话
  const switchConversation = useCallback((conversationId: string | null) => {
    setCurrentConversationId(conversationId);
    if (conversationId) {
      localStorage.setItem('currentConversationId', conversationId);
    } else {
      localStorage.removeItem('currentConversationId');
    }
  }, []);

  return {
    currentConversationId,
    conversations,
    loading,
    createConversation,
    fetchConversations,
    fetchMessages,
    addMessage,
    deleteConversation,
    switchConversation,
  };
};
