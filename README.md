1. 通过 `brew services start redis` 启动redis服务器
  - 通过 `netstat -an | grep 6379` 确保redis正常监听6379端口，样例输出：
```
tcp6       0      0  ::1.6379               *.*                    LISTEN     
tcp4       0      0  *.6379                 *.*                    LISTEN  
```
2. 通过 `node multi_process.js` 运行多进程websocket服务器
3. 运行 `brew services stop redis`关闭服务器
