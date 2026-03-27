# 银行业务活动模拟系统

## 项目简介

本项目是一个银行业务活动模拟系统，用于模拟银行多窗口业务活动，计算客户平均逗留时间。

## 功能特点

1. **数据输入**：支持设置窗口数量和客户数据输入
2. **模拟运行**：事件驱动模拟，支持动态显示
3. **结果展示**：统计概览、窗口状态、客户详情、时间线
4. **数据验证**：完善的输入验证和错误提示
5. **测试数据**：提供合法/非法测试数据快速加载

## 技术栈

- Next.js 15
- React 18
- TypeScript
- Tailwind CSS

## 安装与运行

```bash
# 安装依赖
bun install

# 开发模式运行
bun run dev

# 构建生产版本
bun run build

# 运行生产版本
bun run start
```

## 项目结构

```
bank-simulation/
├── src/
│   ├── app/
│   │   ├── api/simulation/route.ts  # API路由
│   │   ├── globals.css              # 全局样式
│   │   ├── layout.tsx               # 布局组件
│   │   └── page.tsx                 # 主页面
│   └── lib/
│       └── bank-simulation.ts       # 核心逻辑
├── 设计文档.md                       # 设计说明文档
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── postcss.config.js
```

## 使用说明

1. 打开浏览器访问 http://localhost:3000
2. 在"数据输入"标签页设置窗口数量和客户数据
3. 点击"开始模拟"按钮运行模拟
4. 在"模拟结果"标签页查看统计结果
5. 在"时间线"标签页查看事件序列

## 作者

数据结构课程研讨项目
