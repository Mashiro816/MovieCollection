# 午夜时光

记录看过和想看的恐怖电影。手机和电脑共用一套代码，手机上可以"添加到主屏幕"当 App 用。

- 搜索片名添加电影，自带海报、年份和简介（数据来源于 TMDB）
- 两个片单：看过、想看
- 评级：S 噩梦级 / A 毛骨悚然 / B 有点东西 / C 不痛不痒 / D 笑场了
- 吓人指数（1 到 5 个骷髅），和评级分开记
- 观影方式：一个人或和朋友、影院或在家；另有观看日期和一句话短评
- 子类型标签（砍杀、伪纪录片、丧尸等），自动生成，可手动增删，可按标签筛选
- 今晚看什么：从想看片单里随机抽一部，可限定子类型和片长
- 统计、导出和导入备份
- 可选的云同步（Supabase），手机和电脑的片单保持一致

## 各个页面

**片单**：看过和想看两个片单，可以按评级、子类型筛选，按观看时间、评级、吓人指数、上映年份排序。右上角的按钮在两种展示方式之间切换：

- 海报墙：按评级、吓人指数或年份排序时，会在海报之间插入分段牌；按观看时间排序时不分段。
- 环形展台：海报排成一个可以转动的 3D 圆环。拖动或滑动旋转，也可以用方向键、触控板横滑、两侧按钮；点侧面的海报转到正面，点正面的海报打开详情。电脑上底部有一条缩略图，点哪张转到哪张。

**评级墙**：看过的电影按 S 到 D 分档排列。一档超过二十来部时默认只显示前面一部分，点"显示全部"展开。

**系列**：片单里的电影属于某个系列时，这里列出整个系列。右上角的按钮在两种展示方式之间切换：

- 海报：每个系列一排海报，看过的是彩色，没看的是灰色。
- 评级走势：每个系列一条折线，横轴是系列里的每一部（按上映先后），纵轴是你给的评级，一眼能看出这个系列是越拍越好还是越拍越差。没评级、想看、没看过的电影落在底部的基线上。点任意一个点打开详情。

**统计**：评级分布、最常看的子类型、吓人指数分布、观影方式。

**设置**：云同步的登录、导出和导入备份。

## 在手机上使用

部署到线上之后（见下面的"部署"），用手机浏览器打开你的网址，然后添加到主屏幕：iPhone 用 Safari 的分享按钮，安卓用 Chrome 的菜单。之后从桌面图标打开，和普通 App 一样全屏显示。

记录保存在各自设备的浏览器里，手机和电脑默认是两份。想让它们互通，需要配置云同步并在两边登录同一个账号。

## 本地运行

需要 Node.js 20 或更新的版本。

```bash
npm install
cp .env.example .env.local   # 然后按下面的说明填写
npm run dev                  # 打开终端里显示的地址
```

其他命令：`npm run build` 做类型检查并打包到 `dist/`，`npm run preview` 预览打包结果。

## 配置

所有配置都在 `.env.local`（本地）或托管平台的环境变量（线上）里，变量名见 `.env.example`。

### 1. TMDB key（必需，否则搜不到电影）

1. 在 [themoviedb.org](https://www.themoviedb.org/) 注册账号。
2. 进入账号设置里的 API 页面，申请一个 key（个人用途免费）。
3. 把 API Key 或 Read Access Token 填到 `.env.local` 的 `TMDB_KEY`，然后重启 `npm run dev`。

key 只在服务端使用：浏览器请求自己网站的 `/api/tmdb`，由服务端带上 key 去访问 TMDB，所以 key 不会出现在前端代码和浏览器的网络请求里。本地运行时这层转发由 Vite 的开发服务器承担，线上由 Vercel 的服务端函数承担，两边用的是同一份代码（`server/tmdb-proxy.js`）。

`.env.local` 已在 `.gitignore` 里，不会被提交。

### 2. 云同步（可选）

不配置的话，记录只保存在当前设备的浏览器里，可以用"导出备份"手动搬运。

配置步骤（Supabase 后台的菜单位置可能会调整，以它的实际界面为准）：

1. 在 [supabase.com](https://supabase.com/) 注册并新建一个项目。
2. 打开 SQL Editor，把 `supabase/schema.sql` 的内容整段粘贴进去运行一次。
3. 在项目的 API 设置里找到 Project URL 和 anon（或 publishable）key，分别填到 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`。这个 key 本来就是公开用的，数据靠 `schema.sql` 里的行级安全策略保护：每个账号只能读写自己的记录。
4. 重新启动或重新部署后，在应用的"设置 > 云同步"里注册账号并登录。两台设备登录同一个账号即可。

两点说明：

- Supabase 默认要求验证邮箱：注册后要先点邮件里的确认链接才能登录。部署到线上后，记得在 Supabase 的 Authentication 设置里把 Site URL 改成你的线上地址，否则确认链接会跳到 localhost。只有自己用的话，也可以在 Email 登录方式的设置里关掉邮箱确认。
- 同步规则：每部电影一条记录，两台设备都改了同一部时，后改的覆盖先改的。

### 3. 网络

TMDB 和 Supabase 在中国大陆的连通性不稳定。接口请求是从服务端发出的，部署在 Vercel 上时不受影响；海报图片仍由浏览器直接从 TMDB 加载，如果在大陆显示不出来，可以用 Cloudflare Workers 之类的服务给图片做一层反向代理，然后设置 `VITE_TMDB_IMG` 指向代理地址。

## 部署

推荐部署到 Vercel，`api/` 目录会被自动部署成服务端函数。

1. 把代码推到 GitHub。
2. 在 Vercel 里导入这个仓库，框架会自动识别为 Vite。
3. 在项目的环境变量里添加 `TMDB_KEY`（以及云同步用的两个 `VITE_SUPABASE_` 变量，如果配置了的话），然后部署。

之后每次推送到 GitHub，Vercel 会自动重新部署。修改环境变量后需要重新部署一次才会生效。

部署到其他平台时，需要让 `/api/tmdb` 这个地址运行 `server/tmdb-proxy.js` 里的转发逻辑，写法参考 `api/tmdb.js`。纯静态托管（没有服务端函数）无法搜索电影。

## 代码结构

```
api/tmdb.js            Vercel 的服务端函数入口，地址是 /api/tmdb
server/tmdb-proxy.js   TMDB 转发的实现（线上和本地共用）
src/
  lib/
    types.ts       数据结构（一条片单记录长什么样）
    constants.ts   评级名称和颜色、子类型标签对照表、观影方式选项
    tmdb.ts        所有 TMDB 请求（发往 /api/tmdb）
    store.ts       片单数据（保存在 localStorage）和界面状态
    sync.ts        云同步和登录
    actions.ts     添加电影、弹层的通用逻辑
  components/
    Shell.tsx          导航和顶部搜索入口
    Library.tsx        看过和想看片单
    Ring.tsx           片单的环形展台视图
    TierWall.tsx       评级墙
    Series.tsx         系列（海报和评级走势两种视图）
    Stats.tsx          统计
    Settings.tsx       设置（云同步、备份）
    SearchDialog.tsx   搜索并添加电影
    DetailSheet.tsx    电影详情和评级
    TonightDialog.tsx  今晚看什么
    ui.tsx             海报、评级字母块、骷髅等小组件
  index.css        颜色、字体等设计变量
supabase/schema.sql  云同步用的数据表
```

常见改动在哪里做：

- 改评级的名字或颜色：`src/lib/constants.ts` 里的 `TIERS`
- 加子类型标签：`src/lib/constants.ts` 里的 `KEYWORD_TO_TAG`（左边是 TMDB 的英文关键词，右边是中文标签）
- 改配色和字体：`src/index.css` 顶部的 `@theme`

## 用到的库

- [Motion](https://motion.dev/)：过渡动画（弹层进出、导航和评级的滑动高亮、卡片入场）
- [Radix UI](https://www.radix-ui.com/) 的 Select：下拉选择
- [Sonner](https://sonner.emilkowal.ski/)：操作提示（加入想看、移出片单后可撤销）
- [Lucide](https://lucide.dev/)：图标
- Noto Serif SC：标题字体，随项目打包，不依赖系统字体

系统开启"减少动态效果"时，位移和缩放动画会自动关闭。

## 数据来源

本应用使用 TMDB API 提供的电影数据和图片，但未获得 TMDB 的认可或认证。
This product uses the TMDB API but is not endorsed or certified by TMDB.
