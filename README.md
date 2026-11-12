# 点名考勤 PWA

计算机242班的点名考勤工具。免登录、断网可用、数据存本机，可添加到 iPhone 主屏幕当 App 用。

## 线上地址

**https://dianming-bcc.pages.dev/** （Cloudflare Pages 自动部署）

## 目录结构

| 路径 | 作用 |
| --- | --- |
| `index.html` / `app.js` / `style.css` / `sw.js` / `manifest.json` | 应用本体（必须留在根目录） |
| `icons/` | 主屏图标 |
| `sounds/` | 自定义梗音效（in / out / out-alt / leave.mp3） |
| `vendor/xlsx.full.min.js` | Excel 解析库（导入名册时懒加载，不占首屏） |
| `docs/使用说明.md` | 完整使用说明（导入名册、iPhone 安装等） |
| `tools/make-deploy.ps1` | 一键生成干净的部署副本 `deploy/` |
| `deploy/` | 部署副本（自动生成，不提交） |
| `_archive/` | 历史版本备份（不提交） |

## 更新上线（自动部署）

改完文件后，在项目目录执行：

```powershell
git add .
git commit -m "改了什么"
git push
```

Cloudflare Pages 会自动构建部署，手机联网刷新即可看到新版。

> 注意：本机访问 GitHub 的 **HTTPS(443) 被阻断**，所以 push 走 **SSH(22)**（已配好密钥和远程地址），`git push` 直接用即可，不用再折腾。

## 本地预览

```powershell
py -3 -m http.server 8080
```

浏览器打开 http://localhost:8080/ 即可。
