<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { List, Spin, Empty, Button } from 'ant-design-vue';

interface ChatRoom {
  id: number;
  lastMessage: string;
  timestamp: string;
  gameEnded: boolean;
}

const router = useRouter();
const rooms = ref<ChatRoom[]>([]);
const loading = ref(false);

const LOCAL_STORAGE_KEY = 'ai_riddle_chat_history';

// 从本地存储加载房间列表
const loadRooms = () => {
  loading.value = true;
  try {
    const historyStr = localStorage.getItem(LOCAL_STORAGE_KEY);
    rooms.value = historyStr ? JSON.parse(historyStr) : [];
    
    // 按时间倒序排列（最新的在前面）
    rooms.value.sort((a: ChatRoom, b: ChatRoom) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  } catch (error) {
    console.error('加载历史对话失败:', error);
    rooms.value = [];
  } finally {
    loading.value = false;
  }
};

const goToRoom = (roomId: number) => {
  router.push(`/chat/${roomId}`);
};

// 监听自定义事件，当聊天历史更新时重新加载
const handleHistoryUpdate = () => {
  loadRooms();
};

onMounted(() => {
  loadRooms();
  // 监听聊天历史更新事件
  window.addEventListener('chatHistoryUpdated', handleHistoryUpdate);
});

onUnmounted(() => {
  // 移除事件监听
  window.removeEventListener('chatHistoryUpdated', handleHistoryUpdate);
});
</script>

<!-- 添加一个 script 块用于默认导出 -->
<script lang="ts">
export default {
  name: 'HistoryList'
};
</script>

<template>
  <div class="history-list">
    <Spin :spinning="loading">
      <div v-if="rooms.length === 0 && !loading" class="empty-state">
        <Empty description="暂无历史对话" />
        <p class="empty-tip">开始新游戏后，对话会自动保存到这里</p>
      </div>
      
      <div v-else>
        <div class="history-header">
          <span>共 {{ rooms.length }} 个历史对话</span>
          <Button 
            type="link" 
            size="small" 
            @click="loadRooms"
            :loading="loading"
          >
            刷新
          </Button>
        </div>
        
        <List :data-source="rooms" class="room-list">
          <template #renderItem="{ item }">
            <div class="room-item" @click="goToRoom(item.id)">
              <div class="room-header">
                <div class="room-icon">
                  {{ item.gameEnded ? '✅' : '💬' }}
                </div>
                <div class="room-title">房间 {{ item.id }}</div>
                <div class="room-status" :class="{ 'ended': item.gameEnded }">
                  {{ item.gameEnded ? '已结束' : '进行中' }}
                </div>
              </div>
              <div class="room-preview">
                {{ item.lastMessage?.substring(0, 40) || '无消息内容' }}
                {{ item.lastMessage?.length > 40 ? '...' : '' }}
              </div>
              <div class="room-time">
                {{ new Date(item.timestamp).toLocaleString('zh-CN') }}
              </div>
            </div>
          </template>
        </List>
      </div>
    </Spin>
  </div>
</template>

<style scoped>
.history-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.empty-state {
  padding: 40px 20px;
  text-align: center;
}

.empty-tip {
  color: #999;
  font-size: 12px;
  margin-top: 10px;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #fafafa;
  border-radius: 6px;
  margin-bottom: 12px;
  font-size: 14px;
  color: #666;
}

.room-list {
  background: transparent;
}

.room-item {
  padding: 12px 16px;
  margin-bottom: 8px;
  background: #f5f5f5;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  border-left: 3px solid #1890ff;
}

.room-item:hover {
  background: #e6f7ff;
  transform: translateX(4px);
  border-left-color: #52c41a;
}

.room-header {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
  gap: 8px;
}

.room-icon {
  font-size: 16px;
}

.room-title {
  font-weight: 600;
  color: #333;
  flex: 1;
}

.room-status {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 10px;
  background: #1890ff;
  color: white;
}

.room-status.ended {
  background: #52c41a;
}

.room-preview {
  color: #666;
  font-size: 13px;
  margin-bottom: 4px;
  line-height: 1.4;
}

.room-time {
  font-size: 11px;
  color: #999;
  text-align: right;
}
</style>