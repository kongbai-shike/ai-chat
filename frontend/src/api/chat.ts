import axios, { AxiosResponse } from 'axios';

// 创建axios实例
const apiClient = axios.create({
  baseURL: 'http://localhost:8080',
  timeout: 30000
});

export interface BackendChatRoom {
  roomId: number;
  chatMessageList?: Array<{
    role: string;
    content: string;
    timestamp?: string;
  }>;
}

export interface ChatRoom {
  id: number;
  name?: string;
  lastMessage?: string;
}

export const chatApi = {
  async getChatRoomList(): Promise<ChatRoom[]> {
    try {
      const response: AxiosResponse<BackendChatRoom[]> = await apiClient.get('/rooms');
      
      return response.data.map(room => ({
        id: room.roomId,
        name: `对话 ${room.roomId}`,
        lastMessage: room.chatMessageList?.length 
          ? room.chatMessageList[room.chatMessageList.length - 1].content.substring(0, 30) + '...'
          : '暂无消息'
      }));
    } catch (error) {
      console.error('获取聊天室列表失败:', error);
      throw error;
    }
  },

  async sendMessage(roomId: number, userPrompt: string): Promise<string> {
    try {
      // 对于POST请求，将参数放在URL中
      const response: AxiosResponse<string> = await apiClient.post(
        `/${roomId}/chat?userPrompt=${encodeURIComponent(userPrompt)}`
      );
      
      return response.data;
    } catch (error) {
      console.error('发送消息失败:', error);
      throw error;
    }
  }
};