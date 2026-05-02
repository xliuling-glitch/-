# 欧信售前客服作战台

## 技术栈
Next.js 14 + TypeScript + Tailwind + Prisma + SQLite + Recharts + lucide-react

## 启动
```bash
npm install
cp .env.example .env
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

访问 `http://localhost:3000/login`

默认账号：`admin / 123456`、`manager / 123456`、`zhouchen / 123456`

## 已实现模块
- 登录、角色（admin/manager/service/trainee）
- 后台布局（左侧17导航 + 顶栏）
- 工作台首页（核心卡片 + KPI + 图表）
- 今日任务中心（含“生成今日任务”）
- 客户管理、跟进、电联、KPI、排班等列表页框架
- Prisma 全量核心模型
- 种子数据（用户、客户、任务规则）

## 目录
- `app/dashboard/*` 各业务页面
- `app/api/*` API路由
- `prisma/schema.prisma` 数据库模型
- `prisma/seed.ts` 种子
- `components/*` UI组件

## 后续扩展
- Excel/CSV 导入导出 API 预留
- 将 SQLite 切换 PostgreSQL / MySQL 仅需改 `schema.prisma` datasource 与 `DATABASE_URL`
