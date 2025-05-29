1. 通过 `brew services start redis` 启动redis服务器
  - 通过 `netstat -an | grep 6379` 确保redis正常监听6379端口，样例输出：
```
tcp6       0      0  ::1.6379               *.*                    LISTEN     
tcp4       0      0  *.6379                 *.*                    LISTEN  
```
2. 通过 `node multi_process.js` 运行多进程websocket服务器
3. 运行 `brew services stop redis`关闭服务器

# aws部署
## 后端部署
在ec2 instance上部署后端和redis服务器（可以分开在不同instance上部署或在同一个instance上部署）。
1. 安装并启动redis
``` bash
$ sudo apt install -y nodejs npm redis
$ systemctl list-unit-files | grep redis
$ sudo systemctl start redis-server
$ sudo systemctl enable redis-server
```
2. 检查redis成功运行并且监听6379端
``` bash
$ redis-cli ping
$ sudo apt install net-tools
$ netstat -an | grep 6379
```
3. 在instance上clone下来后端的代码后运行（注意dependency）
``` bash
$ pm2 start multi_process.js #pm2后台运行
$ node multi_process.js #直接运行
```

## 手机端与大屏幕端部署
静态网页可以用S3部署或者ec2上nginx部署，这里只写nginx部署方法
 
1. 在生成静态网页前要主页修改`src/App.vue`中的websocket的ip address，改为instance的公网ip address。如果启动了多个instances运行后端，应该有一个类似负载均衡或者group服务生成一个统一的公网ip address然后在group内部分配websocket client连接
2. 生成静态网页到`dist`文件夹中
``` bash
$ npm run build
```
3. 将静态网页copy到nginx的文件夹
``` bash
$ sudo apt update
$ sudo apt install nginx -y
$ sudo rm -rf /var/www/html/*
$ sudo cp -r danmu_mobile/dist/* /var/www/html/
$ sudo systemctl restart nginx
```
网页端同理，需要注意的是如果你在一台instance上同时用nginx部署大屏幕端和手机端，你可能需要将大屏幕端的`dist`文件夹放到比如`/var/www/html/screen`中，此时需要你更改大屏幕端配置文件中的`base`并重新生成静态网页然后重新部署
``` javascript
// in file vite.config.js
import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  base: '/screen/', //add this line
})
