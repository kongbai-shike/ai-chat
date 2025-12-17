<script setup lang="ts">
import { useRouter } from 'vue-router';
import { Button } from 'ant-design-vue';

const router = useRouter();

const startGame = () => {
  const roomId = Math.floor(Math.random() * 1000000);
  router.push(`/chat/${roomId}`);
};
</script>

<template>
  <div class="home-page">
    <h1 class="title">AI 脑筋急转弯</h1>
    <Button type="primary" size="large" @click="startGame" class="start-button">
      开始游戏
    </Button>
  </div>
</template>

<style scoped>
.home-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.title {
  color: white;
  font-size: 48px;
  font-weight: 600;
  margin-bottom: 60px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
}

.start-button {
  height: 60px;
  padding: 0 60px;
  font-size: 20px;
  border-radius: 30px;
  font-weight: 500;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
}

.start-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
}

@media (max-width: 768px) {
  .title {
    font-size: 36px;
    margin-bottom: 40px;
  }

  .start-button {
    height: 50px;
    padding: 0 40px;
    font-size: 18px;
  }
}
</style>
