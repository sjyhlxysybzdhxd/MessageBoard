const { Client } = require('@notionhq/client');
require('dotenv').config();
const express = require('express');
const app = express();
app.use(express.json());
const port = 3001;

const NOTION_KEY = process.env.NOTION_KEY;
const NOTION_DB_ID = process.env.NOTION_DB_ID;
const NOTION_CURR_USER_ID = process.env.NOTION_CURR_USER_ID;

// 创建 Notion 客户端实例
const notion = new Client({ auth: NOTION_KEY });

// 获取所有评论
async function getAllComments() {
  try {
    const result = await notion.databases.query({ database_id: NOTION_DB_ID });
    const comments = new Map();

    result?.results?.forEach((page) => {
      comments.set(page.id, transforPageObject(page));
    });

    const commentsPopulated = [...comments.values()].reduce((acc, curr) => {
      if (!curr.replyTo) {
        curr.replies = curr.replies.map(reply => comments.get(reply.id) || {});
        acc.push(curr);
      }
      return acc;
    }, []);

    return commentsPopulated;
  } catch (error) {
    console.error('Error fetching comments:', error);
    throw error;
  }
}

// 添加评论
async function addComment({ content = "", replyTo = "" }) {
  if (typeof content !== 'string' || content.trim() === '') {
    throw new Error('Content cannot be empty');
  }

  // 获取数据库中的条目数并生成新的评论编号
  const result = await notion.databases.query({ database_id: NOTION_DB_ID });
  const no = result.results.length + 1;

  // 获取当前用户信息
  const user = await notion.users.retrieve({ user_id: NOTION_CURR_USER_ID });
  const { avatar_url, name } = user;

  // 创建新页面
  const response = await notion.pages.create({
    parent: { database_id: NOTION_DB_ID },
    properties: {
      no: {
        title: [{ text: { content: no.toString() } }],
      },
      user: {
        rich_text: [{ text: { content: name } }],
      },
      avatar: {
        url: avatar_url,
      },
      content: {
        rich_text: [{ text: { content } }],
      },
      ...(replyTo && {
        replyTo: {
          relation: [{ id: replyTo }],
        },
      }),
    },
  });

  return transforPageObject(response);
}

// GET 路由：获取所有评论
app.get("/comments", async (req, res) => {
  try {
    const comments = await getAllComments();
    res.json(comments);
  } catch (error) {
    console.error('Error handling /comments request:', error);
    res.sendStatus(500);
  }
});

// POST 路由：添加评论
app.post("/comments", async (req, res) => {
  try {
    const newPage = await addComment(req.body);
    res.status(201).json(newPage);
  } catch (error) {
    console.error('Error handling /comments request:', error);
    res.status(500).send('Internal Server Error');
  }
});

// 启动服务器
app.listen(port, () => {
  console.log(`Server is listening at http://localhost:${port}`);
});

// 转换页面对象
function transforPageObject(page) {
  return {
    id: page.id,
    user: page.properties.user?.rich_text[0]?.text?.content || '',
    time: getRelativeTimeDesc(page.properties.time?.created_time || ''),
    content: page.properties.content?.rich_text[0]?.text?.content || '',
    avatar: page.properties.avatar?.url || '',
    replies: page.properties.replies?.relation || [],
    replyTo: page.properties.replyTo?.relation[0]?.id || null,
  };
}

// 获取相对时间描述
function getRelativeTimeDesc(time) {
  const currentInMs = new Date().getTime();
  const timeInMs = new Date(time).getTime();
  const diffInMs = currentInMs - timeInMs;

  const minuteInMs = 60 * 1000;
  const hourInMs = 60 * minuteInMs;
  const dayInMs = 24 * hourInMs;
  const monthInMs = 30 * dayInMs;
  const yearInMs = 365 * dayInMs;

  if (diffInMs < minuteInMs) {
    const seconds = Math.floor(diffInMs / 1000);
    return seconds <= 5 ? 'just now' : `${seconds} second${seconds > 1 ? 's' : ''} ago`;
  } else if (diffInMs < hourInMs) {
    const minutes = Math.floor(diffInMs / minuteInMs);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (diffInMs < dayInMs) {
    const hours = Math.floor(diffInMs / hourInMs);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (diffInMs < monthInMs) {
    const days = Math.floor(diffInMs / dayInMs);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else if (diffInMs < yearInMs) {
    const months = Math.floor(diffInMs / monthInMs);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  } else {
    const years = Math.floor(diffInMs / yearInMs);
    return `${years} year${years > 1 ? 's' : ''} ago`;
  }
}
