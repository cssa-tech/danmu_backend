# 弹幕系统部署教程（AWS Lightsail，从零开始）

这份教程面向第一次用 AWS 的同学。做完以后：

- 观众用手机打开 `http://服务器IP/` 发弹幕（可以做成二维码让大家扫）
- 大屏幕打开 `http://服务器IP/screen/` 显示弹幕
- 三个部分（手机端、大屏幕端、后端）都在同一台服务器上

> 为什么用 Lightsail 而不是 EC2：Lightsail 是 AWS 里最简单的服务器产品，价格固定、界面简单，
> 网络和防火墙都在一个页面里设置，适合这种小项目。EC2 也可以，只是设置步骤多一些。

---

## 第 0 步：上线前确认

部署脚本会从 GitHub 下载 `danmu_backend`、`danmu_mobile`、`danmu_screen` 三个仓库的代码。
**所有修改要先合并（或推送到某个分支）到 GitHub，服务器上才能用到。**

---

## 第 1 步：注册 AWS 账号

1. 打开 <https://aws.amazon.com>，点 **Create an AWS Account**。
2. 按提示填写邮箱、密码、联系方式，绑定一张信用卡（AWS 用来扣费和验证身份）。
3. 选 **Basic support（免费）** 即可。

> 费用：最便宜够用的 Lightsail 服务器大约每月几美元，新账号常有免费额度或试用，
> **以创建时页面显示的价格为准**。不用的时候记得删掉服务器（见第 8 步），否则会一直计费。
> 建议用社团公用的邮箱注册，并把登录方式写进交接文档，避免以后人毕业了没人能管。

## 第 2 步：创建服务器

1. 登录 AWS 后，在顶部搜索框搜 **Lightsail**，进入 Lightsail 控制台。
2. 点 **Create instance（创建实例）**。
3. 依次选择：
   - **Region（地区）**：选离你们近的，比如美国中部的 **Ohio (us-east-2)**。
   - **Platform（平台）**：**Linux/Unix**
   - **Blueprint（蓝图）**：点 **OS Only（仅操作系统）**，选 **Ubuntu 24.04 LTS**
     （⚠️ 一定要 24.04，旧版本的 Node.js 太老，脚本会报错）
   - **Plan（套餐）**：内存 **1 GB** 或以上（512 MB 打包网页时可能内存不够）
   - **Name（名字）**：比如 `danmu`
4. 点 **Create instance**，等一两分钟，状态变成 **Running（正在运行）**。

## 第 3 步：固定 IP 和开放端口

**固定 IP**（不然服务器重启后 IP 会变，二维码就失效了）：

1. 在 Lightsail 首页点 **Networking（联网）** 标签 → **Create static IP（创建静态 IP）**。
2. 选择刚才的 `danmu` 实例，起个名字，点创建。
3. 记下这个 IP，比如 `3.15.123.45`，后面都用它。

**开放网页端口**：

1. 回到实例页面，点 `danmu` → **Networking（联网）** 标签。
2. 在 **IPv4 Firewall** 里确认有 **HTTP（80）**；点 **Add rule（添加规则）** 加上 **HTTPS（443）**。
   （SSH 22 默认就有，不要删。）

## 第 4 步：连上服务器

在实例页面点 **Connect using SSH（使用 SSH 连接）**，会在浏览器里打开一个黑色的终端窗口。
接下来的命令都在这个窗口里粘贴、回车执行。

## 第 5 步：一键部署

依次执行这两条命令（第二条要跑几分钟）：

```bash
git clone https://github.com/cssa-tech/danmu_backend.git ~/danmu/danmu_backend
```

```bash
bash ~/danmu/danmu_backend/deploy/setup.sh
```

脚本会自动完成：安装 nginx / Redis / Node.js → 下载三个仓库 → 打包手机端和大屏幕 → 配置 nginx → 用 pm2 启动后端（服务器重启后会自动启动）。

最后看到类似这样的输出就成功了：

```
==== 6/6 完成 ====
  手机端（观众扫码打开）:  http://3.15.123.45/
  大屏幕端（投屏打开）:    http://3.15.123.45/screen/
```

## 第 6 步：测试

1. 电脑浏览器打开 `http://你的IP/screen/`，按 **F11** 全屏，这就是大屏幕。
2. 手机打开 `http://你的IP/`，设个昵称，发一条弹幕，看大屏幕上有没有出现。
3. 用微信扫码测一下（微信可能提示"非微信官方网页"，点继续访问即可）。
4. 把 `http://你的IP/` 做成二维码，放到大屏幕或海报上。

## 第 7 步：以后怎么更新

代码改完、推到 GitHub 之后，SSH 连上服务器，再跑一次：

```bash
bash ~/danmu/danmu_backend/deploy/setup.sh
```

脚本会拉最新代码、重新打包、重启后端。正在看大屏幕的页面会自动重连，不用手动刷新
（如果改了网页本身，刷新一下才能看到新界面）。

想先试某个分支（还没合并到 main 的修改）：

```bash
BRANCH=分支名 bash ~/danmu/danmu_backend/deploy/setup.sh
```

## 第 8 步：活动结束后

- **暂时不用**：在 Lightsail 里 **Stop（停止）** 实例。注意停止后可能仍有少量费用。
- **彻底不用**：**Delete（删除）** 实例，并在 Networking 里 **删除静态 IP**
  （没绑定实例的静态 IP 也会收费）。

---

## 常用命令

| 想做什么 | 命令 |
|---|---|
| 看后端日志（收到了哪些弹幕） | `pm2 logs danmu-backend` |
| 看后端是否在运行 | `pm2 status` |
| 重启后端 | `pm2 restart danmu-backend` |
| 检查 nginx 配置 | `sudo nginx -t` |
| 检查 Redis | `redis-cli ping`（应输出 `PONG`） |

## 可选：配置域名和 HTTPS

有域名后（比如 `danmu.你们的域名`），在域名的 DNS 里加一条 **A 记录** 指向静态 IP，然后在服务器上执行：

```bash
sudo apt-get install -y certbot python3-certbot-nginx
```

```bash
sudo certbot --nginx -d danmu.你们的域名
```

按提示填邮箱、同意条款即可，证书会自动续期。之后用 `https://danmu.你们的域名/` 访问，
网页会自动改用加密的 `wss://` 连接后端。以后再跑部署脚本也不会覆盖 HTTPS 配置。
将来做微信小程序时，也必须用这种 HTTPS 域名。

## 出问题了怎么办

| 现象 | 可能原因 / 解决 |
|---|---|
| 网页打不开 | 防火墙没开 80 端口（第 3 步）；或者 `sudo systemctl status nginx` 看 nginx 是否在运行 |
| 网页能打开，但发弹幕没反应 | `pm2 logs danmu-backend` 看后端有没有报错；`redis-cli ping` 看 Redis 是否正常 |
| 脚本报 "Node.js 版本太旧" | 服务器不是 Ubuntu 24.04，删掉重新按第 2 步创建 |
| 打包时卡住或被 Killed | 内存不够，换 1 GB 以上的套餐 |
