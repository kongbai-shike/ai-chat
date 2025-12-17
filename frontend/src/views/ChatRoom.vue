<script setup lang="ts">
import { ref, nextTick, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Button, Input, message, Modal } from 'ant-design-vue';
import { chatApi } from '../api/chat';
import HistoryList from '../components/HistoryList.vue';

interface Message {
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

const route = useRoute();
const router = useRouter();
const roomId = ref<number>(Number(route.params.roomId));
const messages = ref<Message[]>([]);
const userInput = ref('');
const isGameStarted = ref(false);
const isGameEnded = ref(false);
const isLoading = ref(false);
const chatContainerRef = ref<HTMLElement | null>(null);
const showHistory = ref(false);

// localStorage键名
const LOCAL_STORAGE_KEY = 'ai_riddle_chat_history';
const MAX_HISTORY_ROOMS = 20; // 最多保存20个历史房间

// 计算属性，检查是否显示"游戏结束"
const isGameOver = computed(() => {
  return messages.value.some(msg => 
    msg.role === 'ai' && 
    msg.content.includes('游戏结束')
  );
});

// 保存当前房间的对话到本地存储
const saveRoomToLocalStorage = () => {
  try {
    if (messages.value.length === 0) return;
    
    // 获取现有的历史记录
    const historyStr = localStorage.getItem(LOCAL_STORAGE_KEY);
    let historyRooms = historyStr ? JSON.parse(historyStr) : [];
    
    // 准备当前房间的数据
    const roomData = {
      id: roomId.value,
      messages: messages.value,
      lastMessage: messages.value[messages.value.length - 1]?.content || '',
      timestamp: new Date().toISOString(),
      gameEnded: isGameEnded.value
    };
    
    // 检查是否已存在该房间
    const existingIndex = historyRooms.findIndex((room: any) => room.id === roomId.value);
    
    if (existingIndex !== -1) {
      // 更新现有房间
      historyRooms[existingIndex] = roomData;
    } else {
      // 添加新房间
      historyRooms.unshift(roomData); // 新房间放在前面
      
      // 限制历史房间数量
      if (historyRooms.length > MAX_HISTORY_ROOMS) {
        historyRooms = historyRooms.slice(0, MAX_HISTORY_ROOMS);
      }
    }
    
    // 保存到本地存储
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(historyRooms));
    
    // 触发自定义事件，通知HistoryList组件更新
    window.dispatchEvent(new CustomEvent('chatHistoryUpdated'));
    
  } catch (error) {
    console.error('保存到本地存储失败:', error);
  }
};

// 从本地存储加载当前房间的历史记录
const loadRoomFromLocalStorage = () => {
  try {
    const historyStr = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!historyStr) return;
    
    const historyRooms = JSON.parse(historyStr);
    const roomData = historyRooms.find((room: any) => room.id === roomId.value);
    
    if (roomData && roomData.messages) {
      // 加载历史消息
      messages.value = roomData.messages;
      
      // 设置游戏状态
      isGameStarted.value = messages.value.length > 0;
      isGameEnded.value = roomData.gameEnded || isGameOver.value;
      
      // 滚动到底部
      scrollToBottom();
      
      message.success('已加载历史对话');
    }
  } catch (error) {
    console.error('从本地存储加载失败:', error);
  }
};

// 清除本地存储的历史记录（可选功能）
const clearLocalStorage = () => {
  Modal.confirm({
    title: '确认清除历史记录',
    content: '确定要清除所有历史对话记录吗？此操作不可恢复。',
    onOk() {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      message.success('历史记录已清除');
      // 触发更新
      window.dispatchEvent(new CustomEvent('chatHistoryUpdated'));
    }
  });
};

// 重置游戏状态
const resetGame = () => {
  // 先保存当前对话
  if (messages.value.length > 0) {
    saveRoomToLocalStorage();
  }
  
  // 重置状态
  messages.value = [];
  isGameStarted.value = false;
  isGameEnded.value = false;
  userInput.value = '';
  
  // 生成新的房间ID
  const newRoomId = Math.floor(Math.random() * 1000000);
  roomId.value = newRoomId;
  
  // 更新URL
  router.replace(`/chat/${newRoomId}`);
  
  message.info('已开始新的一局游戏');
};

const scrollToBottom = () => {
  nextTick(() => {
    if (chatContainerRef.value) {
      chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight;
    }
  });
};

const sendMessageToAI = async (content: string) => {
  isLoading.value = true;
  try {
    const response = await chatApi.sendMessage(roomId.value, content);
    
    messages.value.push({
      role: 'ai',
      content: response,
      timestamp: new Date()
    });

    // 检查游戏是否结束
    if (response.includes('游戏结束')) {
      isGameEnded.value = true;
      message.success('游戏已结束！');
      
      // 保存到本地存储
      saveRoomToLocalStorage();
      
      Modal.info({
        title: '游戏结束',
        content: '本次游戏已结束，AI已给出完整解答。对话已自动保存。',
        okText: '确定'
      });
    } else {
      // 非结束消息也保存
      saveRoomToLocalStorage();
    }

    scrollToBottom();
  } catch (error: any) {
    console.error('Error sending message:', error);
    
    let errorMsg = '发送消息失败，请重试';
    if (error.response) {
      if (error.response.status === 404) {
        errorMsg = '后端接口不存在，请检查后端是否启动';
      } else if (error.response.status === 500) {
        errorMsg = '后端服务器错误，请检查后端日志';
      } else if (error.response.data) {
        errorMsg = error.response.data.message || errorMsg;
      }
    } else if (error.request) {
      errorMsg = '无法连接到后端服务器，请确保后端已启动';
    }
    
    message.error(errorMsg);
  } finally {
    isLoading.value = false;
  }
};

const startGame = async () => {
  if (isGameStarted.value) return;

  messages.value.push({
    role: 'user',
    content: '开始',
    timestamp: new Date()
  });

  isGameStarted.value = true;
  await sendMessageToAI('开始');
};

const endGame = async () => {
  if (isGameEnded.value) return;

  messages.value.push({
    role: 'user',
    content: '退出',
    timestamp: new Date()
  });

  await sendMessageToAI('退出');
};

const sendMessage = async () => {
  const content = userInput.value.trim();

  if (!content) {
    message.warning('请输入内容');
    return;
  }

  if (content === '开始' || content === 'start') {
    userInput.value = '';
    await startGame();
    return;
  }

  if (content === '退出' || content === '结束' || content === 'exit' || content === 'end') {
    userInput.value = '';
    await endGame();
    return;
  }

  if (!isGameStarted.value) {
    message.warning('请先开始游戏');
    return;
  }

  messages.value.push({
    role: 'user',
    content,
    timestamp: new Date()
  });

  userInput.value = '';
  scrollToBottom();

  await sendMessageToAI(content);
};

const toggleHistory = () => {
  showHistory.value = !showHistory.value;
};

// 监听游戏结束状态
watch(isGameOver, (newValue) => {
  if (newValue) {
    isGameEnded.value = true;
    // 游戏结束时保存到本地存储
    saveRoomToLocalStorage();
  }
});

// 监听消息变化，自动保存
watch(messages, () => {
  if (messages.value.length > 0 && !isLoading.value) {
    // 延迟保存，避免频繁操作
    setTimeout(saveRoomToLocalStorage, 1000);
  }
}, { deep: true });

onMounted(() => {
  scrollToBottom();
  
  // 检查是否有历史记录
  loadRoomFromLocalStorage();
});
</script>

<template>
  <div class="chat-room" :class="{ 'game-ended': isGameEnded }">
    <div class="sidebar" :class="{ 'show': showHistory }">
      <div class="sidebar-header">
        <h3>历史对话</h3>
        <div class="sidebar-actions">
          <Button type="text" @click="clearLocalStorage" title="清除历史记录" class="clear-btn">
            🗑️
          </Button>
          <Button type="text" @click="toggleHistory" class="close-btn">×</Button>
        </div>
      </div>
      <HistoryList />
    </div>

    <div class="main-content">
      <div class="header">
        <Button type="text" @click="toggleHistory" class="menu-btn">☰</Button>
        <h2>AI 脑筋急转弯</h2>
        <div class="room-info">房间号: {{ roomId }}</div>
      </div>

      <div class="chat-container" ref="chatContainerRef">
        <div v-if="messages.length === 0" class="welcome-message">
          <p>👋 欢迎来到AI脑筋急转弯！</p>
          <p>点击"开始游戏"按钮开始新的游戏。</p>
          <p>所有对话都会自动保存到浏览器本地。</p>
          <p>你可以通过左侧的菜单查看历史对话。</p>
        </div>
        
        <div v-else>
          <div v-for="(msg, index) in messages" :key="index" class="message-wrapper" :class="msg.role">
            <div class="avatar" :class="msg.role">
              {{ msg.role === 'ai' ? 'AI' : '我' }}
            </div>
            <div class="message-bubble" :class="msg.role">
              <div class="message-content">{{ msg.content }}</div>
              <div class="message-time">
                {{ new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }}
              </div>
            </div>
          </div>
        </div>
        
        <!-- 游戏结束提示 -->
        <div v-if="isGameEnded && messages.length > 0" class="game-over-message">
          <h3>🎮 游戏已结束 🎮</h3>
          <p>AI已经给出了完整的答案和解释。</p>
          <p>本次对话已自动保存到历史记录中。</p>
          <p>点击"重新开始"按钮可以开始新的一局游戏。</p>
        </div>
        
        <div v-if="isLoading" class="message-wrapper ai">
          <div class="avatar ai">AI</div>
          <div class="message-bubble loading">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
        </div>
      </div>

      <div class="input-area">
        <div class="action-buttons">
          <!-- 游戏未开始或游戏已结束时显示开始按钮 -->
          <Button
            v-if="!isGameStarted || isGameEnded"
            type="primary"
            @click="isGameEnded ? resetGame() : startGame()"
            :disabled="isLoading"
            :class="{ 'restart-btn': isGameEnded }"
          >
            {{ isGameEnded ? '重新开始' : '开始游戏' }}
          </Button>
          
          <!-- 游戏进行中显示结束按钮 -->
          <Button
            v-if="isGameStarted && !isGameEnded"
            type="primary"
            danger
            @click="endGame"
            :disabled="isLoading"
          >
            结束游戏
          </Button>
          
          <!-- 保存状态提示 -->
          <span v-if="messages.length > 0" class="save-status">
            💾 对话已自动保存
          </span>
        </div>
        
        <div class="input-group">
          <Input
            :value="userInput"
            @update:value="(val) => userInput = val"
            :placeholder="isGameEnded ? '游戏已结束，请点击重新开始按钮' : '请输入内容（对话会自动保存）'"
            @pressEnter="sendMessage"
            :disabled="isLoading || !isGameStarted || isGameEnded"
            size="large"
          />
          <Button
            type="primary"
            @click="sendMessage"
            :loading="isLoading"
            size="large"
            :disabled="!isGameStarted || isGameEnded || isLoading"
          >
            发送
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-room {
  display: flex;
  height: 100vh;
  background: #f5f5f5;
}

/* 游戏结束状态 */
.chat-room.game-ended .input-area {
  opacity: 0.8;
}

.chat-room.game-ended .input-group {
  filter: grayscale(30%);
}

/* 游戏结束提示 */
.game-over-message {
  text-align: center;
  padding: 20px;
  background: linear-gradient(135deg, #fff2e8 0%, #ffd8bf 100%);
  border-radius: 10px;
  margin: 20px 0;
  border: 2px dashed #ff7a45;
  animation: fadeIn 0.5s ease;
}

.game-over-message h3 {
  color: #fa541c;
  margin-bottom: 10px;
  font-size: 1.3rem;
}

.game-over-message p {
  color: #666;
  margin-bottom: 8px;
  font-size: 0.9rem;
}

/* 重新开始按钮的特殊样式 */
.restart-btn {
  background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%) !important;
  border: none !important;
  box-shadow: 0 4px 12px rgba(82, 196, 26, 0.3) !important;
}

.restart-btn:hover {
  background: linear-gradient(135deg, #73d13d 0%, #52c41a 100%) !important;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(82, 196, 26, 0.4) !important;
}

/* 侧边栏样式 */
.sidebar {
  width: 280px;
  background: white;
  border-right: 1px solid #e8e8e8;
  display: flex;
  flex-direction: column;
  transition: transform 0.3s ease;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.sidebar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.clear-btn {
  font-size: 18px;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.3s;
}

.clear-btn:hover {
  background: #ff4d4f;
  color: white;
}

.close-btn {
  display: none;
  font-size: 24px;
  line-height: 1;
}

.menu-btn {
  display: none;
  font-size: 24px;
  margin-right: 12px;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header {
  background: white;
  padding: 16px 24px;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  flex: 1;
  text-align: center;
}

.room-info {
  color: #666;
  font-size: 14px;
  width: 150px;
  text-align: right;
}

.chat-container {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.message-wrapper {
  display: flex;
  gap: 12px;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-wrapper.user {
  flex-direction: row-reverse;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 500;
  flex-shrink: 0;
}

.avatar.ai {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.avatar.user {
  background: #52c41a;
  color: white;
}

.message-bubble {
  max-width: 60%;
  padding: 12px 16px;
  border-radius: 12px;
  word-wrap: break-word;
  line-height: 1.6;
  display: flex;
  flex-direction: column;
}

.message-wrapper.ai .message-bubble {
  background: white;
  border: 1px solid #e8e8e8;
}

.message-wrapper.user .message-bubble {
  background: #1890ff;
  color: white;
}

.message-content {
  flex: 1;
}

.message-time {
  font-size: 11px;
  color: #999;
  text-align: right;
  margin-top: 4px;
}

.message-wrapper.user .message-time {
  color: rgba(255, 255, 255, 0.8);
}

.message-bubble.loading {
  display: flex;
  gap: 6px;
  padding: 12px 20px;
  flex-direction: row;
  align-items: center;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #999;
  animation: bounce 1.4s infinite ease-in-out both;
}

.dot:nth-child(1) {
  animation-delay: -0.32s;
}

.dot:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

.input-area {
  background: white;
  padding: 16px 24px;
  border-top: 1px solid #e8e8e8;
}

.action-buttons {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  align-items: center;
}

.save-status {
  font-size: 12px;
  color: #52c41a;
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
}

.input-group {
  display: flex;
  gap: 12px;
}

.input-group :deep(.ant-input) {
  flex: 1;
}

.welcome-message {
  text-align: center;
  padding: 40px 20px;
  color: #666;
  background: #f8f9fa;
  border-radius: 10px;
  margin: 20px;
}

.welcome-message p {
  margin-bottom: 10px;
  font-size: 16px;
}

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    height: 100vh;
    z-index: 1000;
    transform: translateX(-100%);
  }

  .sidebar.show {
    transform: translateX(0);
  }

  .close-btn {
    display: block;
  }

  .menu-btn {
    display: block;
  }

  .room-info {
    display: none;
  }

  .message-bubble {
    max-width: 75%;
  }

  .input-area {
    padding: 12px 16px;
  }

  .action-buttons {
    flex-wrap: wrap;
  }
  
  .save-status {
    width: 100%;
    justify-content: center;
    margin: 8px 0 0 0;
  }
}
</style>