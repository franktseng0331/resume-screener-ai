# 数据库设置指南

本项目使用 Neon Postgres 数据库实现跨设备数据同步。

## 设置步骤

### 1. 创建 Neon 数据库

1. 访问 [Neon Console](https://console.neon.tech/)
2. 创建新项目
3. 复制数据库连接字符串（DATABASE_URL）

### 2. 配置环境变量

在 Vercel 项目设置中添加环境变量：

```
DATABASE_URL=postgresql://[user]:[password]@[host]/[database]?sslmode=require
DEEPSEEK_API_KEY=your_deepseek_api_key
```

### 3. 初始化数据库表

使用 Neon SQL Editor 或任何 PostgreSQL 客户端执行 `db/schema.sql` 文件中的 SQL 语句。

或者使用命令行：

```bash
psql $DATABASE_URL -f db/schema.sql
```

### 4. 部署到 Vercel

```bash
git add .
git commit -m "添加数据库支持"
git push origin main
```

Vercel 会自动部署更新。

## 数据同步说明

- 所有数据（用户、职位、历史记录）都存储在 Postgres 数据库中
- localStorage 作为本地缓存，提升性能
- 当 API 请求失败时，会回退到使用本地缓存
- 登录后会自动从数据库加载最新数据

## 数据库表结构

### users 表
- 存储用户信息和认证数据

### positions 表
- 存储职位列表

### history_records 表
- 存储筛查历史记录
- 支持记录流转和分配

## 本地开发

本地开发时，需要配置 `.env.local` 文件：

```
DATABASE_URL=your_neon_database_url
DEEPSEEK_API_KEY=your_deepseek_api_key
```
