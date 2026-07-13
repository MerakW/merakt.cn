# 编辑网站文案

绝大多数固定文案都在 `src/content/site-copy.ts`：导航、页脚、首页、人物页、博客、Astronix、Merak Airways 和毛五页的标题与说明都能在这里直接改。

毛五的每张照片与配文在 `src/content/fursuitfriday/`：一张照片对应一个 JSON 文件，编辑 `caption`、`time`、`tags` 或 `image` 即可。

`src/content/site-settings.ts` 管理暂时隐藏的页面入口。把 `astronix` 或 `airways` 改为 `true`，即可恢复它们在导航和首页中的入口；页面本身的路由没有删除。

改完后：

1. 本地开发时保存文件，页面会自动刷新。
2. 发布前运行 `npm run build`。

不要编辑 `dist/`，它是构建时自动生成的文件。
