const WebSocket = require('ws');

// 在 8080 端口创建 WebSocket 服务器
const wss = new WebSocket.Server({ port: 8080, host: '0.0.0.0' });

// 监听连接事件
wss.on('connection', (ws) => {
  console.log('客户端已连接');

  // 监听来自客户端的消息
  ws.on('message', (message) => {
    console.log(`接收到的消息: ${message}`);
    
    // 解析弹幕内容
    const danmu = JSON.parse(message);

    // 将弹幕转发给所有连接的客户端
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(danmu));
      }
    });
  });

  // 监听关闭事件
  ws.on('close', () => {
    console.log('客户端已断开连接');
  });
});

console.log('WebSocket 服务器在 ws://localhost:8080 上运行');
