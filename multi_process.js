const cluster = require('cluster');
const os = require('os');
const WebSocket = require('ws');
const Redis = require('ioredis');

const numCPUs = os.cpus().length;

if (cluster.isMaster) {
  console.log(`主进程 ${process.pid} 正在运行`);

  // 为每个 CPU 核心创建一个工作进程
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`工作进程 ${worker.process.pid} 已退出`);
    cluster.fork(); // 自动重启新的子进程
  });
} else {
  // 子进程：在每个核心上运行 WebSocket 服务器实例
  const redisSubscriber = new Redis();
  const redisPublisher = new Redis();

  // 创建 WebSocket 服务器
  const wss = new WebSocket.Server({ port: 8080, host: '0.0.0.0' });

  // 监听 Redis 订阅频道，接收消息并广播
  redisSubscriber.subscribe('danmu_channel');
  redisSubscriber.on('message', (channel, message) => {
    if (channel === 'danmu_channel') {
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  });

  // 监听 WebSocket 连接事件
  wss.on('connection', (ws) => {
    console.log(`客户端已连接 (进程 ${process.pid})`);

    ws.on('message', (message) => {
      console.log(`接收到的消息: ${message} (进程 ${process.pid})`);
      
      // 将消息发布到 Redis 频道，供所有工作进程广播
      redisPublisher.publish('danmu_channel', message);
    });

    ws.on('close', () => {
      console.log('客户端已断开连接');
    });
  });

  console.log(`WebSocket 服务器在 ws://localhost:8080 上运行 (进程 ${process.pid})`);
}
