# 午夜片单

记录看过和想看的恐怖电影。手机和电脑共用一套代码，手机上可以"添加到主屏幕"当 App 用。

- 搜索片名添加电影，自带海报、年份和简介（数据来自 TMDB）
- 两个片单：看过、想看
- 评级：S 噩梦级 / A 毛骨悚然 / B 有点东西 / C 不痛不痒 / D 笑场了
- 吓人指数（1 到 5 个骷髅），和评级分开记
- 观影方式：一个人或和朋友、深夜或白天、影院或在家
- 子类型标签（砍杀、伪纪录片、丧尸等），自动生成，可手动增删，可按标签筛选
- 评级墙：按档位排列海报
- 系列追踪：看了系列里的哪几部、还差哪几部
- 今晚看什么：从想看片单里随机抽一部
- 统计、导出和导入备份
- 可选的云同步（Supabase），手机和电脑的片单保持一致

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
3. 把 API Key 或 Read Access Token 填到 `.env.local` 的 `VITE_TMDB_KEY`，然后重启 `npm run dev`。

key 只在这里配置，网页里没有填写入口。`.env.local` 已在 `.gitignore` 里，不会被提交。部署到线上时，在托管平台的环境变量里填同一个变量。

注意：带 `VITE_` 前缀的变量会被打包进前端代码，任何打开你网站的人都能在浏览器里看到这个 key。个人自用问题不大；如果介意，可以自己搭一个代理，把 `VITE_TMDB_API` 指向它，所有请求都从 `src/lib/tmdb.ts` 发出，只需要改这一个文件。

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

TMDB 和 Supabase 在中国大陆的连通性不稳定。如果需要在大陆使用，可以用 Cloudflare Workers 之类的服务做一层反向代理，然后设置 `VITE_TMDB_API` 和 `VITE_TMDB_IMG` 指向代理地址。

## 部署

这是纯静态网站，任何静态托管都可以。以 Vercel 为例：

1. 把代码推到 GitHub。
2. 在 Vercel 里导入这个仓库，框架会自动识别为 Vite。
3. 在项目的环境变量里填上面的 `VITE_` 变量，然后部署。

之后每次推送到 GitHub，Vercel 会自动重新部署。Cloudflare Pages 的流程相同：构建命令 `npm run build`，输出目录 `dist`。

## 代码结构

```
src/
  lib/
    types.ts       数据结构（一条片单记录长什么样）
    constants.ts   评级名称和颜色、子类型标签对照表、观影方式选项
    tmdb.ts        所有 TMDB 请求
    store.ts       片单数据（保存在 localStorage）和界面状态
    sync.ts        云同步和登录
    actions.ts     添加电影、弹层的通用逻辑
  components/
    Shell.tsx          导航和顶部搜索入口
    Library.tsx        看过和想看片单
    TierWall.tsx       评级墙
    Series.tsx         系列追踪
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

## 数据来源

本应用使用 TMDB API 提供的电影数据和图片，但未获得 TMDB 的认可或认证。
This product uses the TMDB API but is not endorsed or certified by TMDB.
