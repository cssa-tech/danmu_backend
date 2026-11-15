// 单进程版 WebSocket 服务器：不需要 Redis，适合本地测试或小规模使用
const WebSocket = require('ws');
const { parseDanmu, createRateLimiter, startHeartbeat, MAX_PAYLOAD_BYTES } = require('./danmu');

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';

const wss = new WebSocket.Server({ port: PORT, host: HOST, maxPayload: MAX_PAYLOAD_BYTES });
startHeartbeat(wss);

// 监听连接事件
wss.on('connection', (ws) => {
  console.log('客户端已连接');
  const allow = createRateLimiter();

  // 单个连接出错（消息过大、数据帧损坏等）只断开这个连接，不能让整个服务器崩溃
  ws.on('error', (err) => console.log(`连接出错已断开: ${err.message}`));

  // 监听来自客户端的消息
  ws.on('message', (message) => {
    // 格式不对或发得太快的消息直接丢弃（以前格式错误会让整个服务器崩溃）
    const danmu = parseDanmu(message);
    if (!danmu || !allow()) return;
    console.log(`接收到的消息: ${JSON.stringify(danmu)}`);

    // 将弹幕转发给所有连接的客户端
    const payload = JSON.stringify(danmu);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  });

  // 监听关闭事件
  ws.on('close', () => {
    console.log('客户端已断开连接');
  });
});

console.log(`WebSocket 服务器在 ws://${HOST}:${PORT} 上运行`);
