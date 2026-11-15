// 弹幕校验与限流，index.js 和 multi_process.js 共用

const MAX_TEXT_LENGTH = 80; // 与手机端的字数限制一致
const MAX_NICKNAME_LENGTH = 20;
const MAX_CLIENT_ID_LENGTH = 64;

// 每个连接的发送频率：最多连发 3 条，之后每秒恢复 1 条
const RATE_BURST = 3;
const RATE_PER_SECOND = 1;

// 单条消息最大字节数，超过直接断开（防止有人发超大数据）
const MAX_PAYLOAD_BYTES = 4 * 1024;

// 把收到的原始消息解析成干净的弹幕对象；格式不对返回 null
function parseDanmu(raw) {
  let data;
  try {
    data = JSON.parse(raw.toString());
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;

  const text = typeof data.text === 'string' ? data.text.trim() : '';
  const nickName = typeof data.nickName === 'string' ? data.nickName.trim() : '';
  if (!text || !nickName) return null;

  // 按字符（而不是字节）截断，中文和 emoji 都算一个字
  const cut = (s, n) => Array.from(s).slice(0, n).join('');

  return {
    nickName: cut(nickName, MAX_NICKNAME_LENGTH),
    text: cut(text, MAX_TEXT_LENGTH),
    clientId: typeof data.clientId === 'string' ? data.clientId.slice(0, MAX_CLIENT_ID_LENGTH) : '',
    timestamp: Number.isFinite(data.timestamp) ? data.timestamp : Date.now(),
  };
}

// 令牌桶限流：每个连接一个，allow() 返回 false 表示发太快了
function createRateLimiter() {
  let tokens = RATE_BURST;
  let last = Date.now();
  return function allow() {
    const now = Date.now();
    tokens = Math.min(RATE_BURST, tokens + ((now - last) / 1000) * RATE_PER_SECOND);
    last = now;
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  };
}

// 每 30 秒 ping 一次所有连接，清理掉已经断掉但没通知的连接，
// 也避免 nginx 等代理因为长时间没数据把连接关掉
function startHeartbeat(wss) {
  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
  });
  const timer = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);
  wss.on('close', () => clearInterval(timer));
}

module.exports = { parseDanmu, createRateLimiter, startHeartbeat, MAX_PAYLOAD_BYTES };
