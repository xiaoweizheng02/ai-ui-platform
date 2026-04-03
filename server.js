const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const app = express();

app.use(express.json());
app.use(express.static('public'));

// 模拟用户数据，无需登录
const defaultUser = { nickname: "访客", remain: 9999, history: [] };

// ==============================
// 豆包 API 生成 UI
// ==============================
app.post('/api/generate/ui', async (req, res) => {
  const { prompt } = req.body;

  try {
    const apiKey = process.env.DOUBAO_API_KEY || "953c9670-b77b-4650-8aff-6d0ce472241b";
    const resp = await axios({
      method: "POST",
      url: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      data: {
        model: "ep-m-20260320153951-8x8wk",
        messages: [
          {
            role: "system",
            content: "你是顶级UI工程师。只返回完整可直接运行的HTML+TailwindCSS代码。不要解释、不要markdown、不要代码块、不要多余内容。界面要求：美观、现代、响应式、商用级、配色高级、布局干净、带卡片、导航、表格、按钮、表单、弹窗。"
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 5000,
        temperature: 0.6
      }
    });

    let html = resp.data.choices[0].message.content || "";
    html = html.replace(/```html|```/g, "").trim();

    defaultUser.history.push({ prompt, html, time: new Date().toLocaleString() });

    res.json({ code: 0, data: { html, remain: defaultUser.remain } });
  } catch (e) {
    res.json({ code: 1, msg: "生成失败：" + e.message });
  }
});

app.get('/api/user/info', (req, res) => {
  res.json({ code: 0, data: { nickname: defaultUser.nickname, remain: defaultUser.remain } });
});

app.get('/api/user/history', (req, res) => {
  res.json({ code: 0, data: defaultUser.history });
});

app.post('/api/pay/wxpay', (req, res) => {
  const { times } = req.body;
  defaultUser.remain += Number(times);
  res.json({ code: 0, msg: "支付成功", remain: defaultUser.remain });
});

app.get('/api/export/html', (req, res) => {
  const html = req.query.html || "";
  const zip = archiver('zip');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename=UI代码.zip');
  zip.pipe(res);
  zip.append(html, { name: 'index.html' });
  zip.finalize();
});

app.get('/api/admin/users', (req, res) => {
  res.json({ code: 0, data: { "guest": defaultUser } });
});

// ==============================
// Figma 集成
// ==============================
app.post('/api/figma/open', async (req, res) => {
  const { html } = req.body;
  try {
    // 直接打开Figma的最近文件页面
    // 避免API权限问题
    const figmaUrl = "https://www.figma.com/files/recent";

    res.json({ 
      code: 0, 
      data: { 
        figmaUrl: figmaUrl 
      } 
    });
  } catch (e) {
    res.json({ code: 1, msg: "打开Figma失败：" + e.message });
  }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public/login.html')));
app.get('/pay', (req, res) => res.sendFile(path.join(__dirname, 'public/pay.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));
app.get('/history', (req, res) => res.sendFile(path.join(__dirname, 'public/history.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('✅ 服务已启动：http://localhost:' + PORT);
});