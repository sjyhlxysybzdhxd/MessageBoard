<template>
  <main class="p-4 bg-gray-50 min-h-screen">
    <div class="max-w-screen-xl mx-auto bg-white p-8 rounded-lg shadow-2xl">
      <h2 class="text-3xl my-6">评论</h2>
      
      <!-- 回复 -->
      <CommentBox @submit="addNewComment"/>

      <!-- 分割 -->
      <DivideHorizontal/>

      <!-- 遍历来显示 添加的话也就是在数组里添加类 -->
      <div v-for="comment in comments" :key="comment.id">
        <!-- 留言 -->
        <CommentItem
          :user="comment.user"
          :avatar="comment.avatar"
          :time="comment.time"
          :content="comment.content"
        />

        <!-- 回复列表 -->
        <ReplyContainer v-if="comment.replies">
          <CommentItem 
            v-for="reply in comment.replies"
            :key="reply.id"
            :user="reply.user"
            :avatar="reply.avatar"
            :content="reply.content"
            :time="reply.time"
          />
        </ReplyContainer>

        <!-- 回复框 -->
        <ReplyBox @submit="addNewComment($event, comment.id)"/>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import CommentBox from './components/CommentBox.vue'; 
import DivideHorizontal from './components/DivideHorizontal.vue';
import CommentItem from './components/Commentltem.vue'
import ReplyBox from './components/ReplyBox.vue';
import ReplyContainer from './components/ReplyContainer.vue';
import { onMounted, ref } from 'vue';

interface Comment {
  id: string;
  user: string;
  avatar: string;
  time: string;
  content: string;
  replies?: Reply[];
}

interface Reply {
  id: string;
  user: string;
  avatar: string;
  time: string;
  content: string;
}

const comments = ref<Comment[]>([]);

async function getAllComments() {
  try {
    const res = await fetch("/api/comments");
    comments.value = await res.json();
  } catch (error) {
    console.error('Error fetching comments:', error);
  }
}

onMounted(() => {
  getAllComments();
});

const addNewComment = async (content: string, replyTo?: string) => {
  try {
    const res = await fetch(`/api/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content,
        ...(replyTo && { replyTo })
      })
    });

    if (!res.ok) {
      throw new Error(`HTTP error! Status: ${res.status}`);
    }

    const newComment = await res.json();
    if (!replyTo) {
      comments.value.unshift(newComment);
    } else {
      const parentComment = comments.value.find(c => c.id === replyTo);
      if (parentComment) {
        parentComment.replies = [newComment, ...(parentComment.replies || [])];
      }
    }
  } catch (error) {
    console.error('Error adding comment:', error);
  }
};
</script>

<style scoped>
</style>
