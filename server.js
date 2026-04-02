const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const app = express();

app.use(express.json());
app.use(express.static('public'));

const users = {
  "13800138000": { code: "1234", remain: 5, nickname: "测试用户", isAdmin: false, history: [] },
  "admin": { code: "1234", remain: 9999, nickname: "管理员", isAdmin: true, history: [] }
};

const sessions = {};

function makeToken() {
  return Math.random().toString(36).slice(2) + Date.now();
}

app.post('/api/login/sms', (req, res) => {
  const { phone, code } = req.body;
  const user = users[phone];
  if (!user || user.code !== code) return res.json({ code: 1, msg: "验证码错误" });
  const token = makeToken();
  sessions[token] = phone;
  res.json({ code: 0, token, remain: user.remain });
});

function checkAuth(req, res, next) {
  const token = req.headers.token;
  if (!token || !sessions[token]) return res.json({ code: 401, msg: "请登录" });
  req.account = sessions[token];
  next();
}

app.get('/api/user/info', checkAuth, (req, res) => {
  const u = users[req.account];
  res.json({ code: 0, data: { nickname: u.nickname, remain: u.remain } });
});

// ==============================
// 豆包 API 生成 UI
// ==============================
app.post('/api/generate/ui', checkAuth, async (req, res) => {
  const { prompt } = req.body;
  const u = users[req.account];
  if (u.remain <= 0) return res.json({ code: 1, msg: "次数不足，请充值" });

  try {
    const resp = await axios({
      method: "POST",
      url: "https://ark.cn-beijing.aliyuncs.com/api/v1/endpoints/yi-34b-chat-infer/infer",
      headers: {
        "Authorization": "Bearer 这里替换成你的豆包API Key",
        "Content-Type": "application/json"
      },
      data: {
        model: "yi-34b-chat",
        messages: [
          {
            role: "system",
            content: `你是顶级UI工程师。
只返回完整可直接运行的HTML+TailwindCSS代码。
不要解释、不要markdown、不要代码块、不要多余内容。
界面要求：美观、现代、响应式、商用级、配色高级、布局干净、带卡片、导航、表格、按钮、表单、弹窗。`
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 5000,
        temperature: 0.6
      }
    });

    let html = resp.data.choices[0].message.content || "";
    html = html.replace(/```html|```/g, "").trim();

    u.history.push({ prompt, html, time: new Date().toLocaleString() });
    u.remain -= 1;

    res.json({ code: 0, data: { html, remain: u.remain } });
  } catch (e) {
    res.json({ code: 1, msg: "生成失败：" + e.message });
  }
});

app.get('/api/user/history', checkAuth, (req, res) => {
  res.json({ code: 0, data: users[req.account].history });
});

app.post('/api/pay/wxpay', checkAuth, (req, res) => {
  const { times } = req.body;
  const u = users[req.account];
  u.remain += Number(times);
  res.json({ code: 0, msg: "支付成功", remain: u.remain });
});

app.get('/api/export/html', checkAuth, (req, res) => {
  const html = req.query.html || "";
  const zip = archiver('zip');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename=UI代码.zip');
  zip.pipe(res);
  zip.append(html, { name: 'index.html' });
  zip.finalize();
});

app.get('/api/admin/users', checkAuth, (req, res) => {
  if (!users[req.account].isAdmin) return res.json({ code: 403, msg: "无权限" });
  res.json({ code: 0, data: users });
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