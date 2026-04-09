# QueueLab · 银行服务调度实验平台

## 项目简介

本项目是一个**理想化调度算法对比实验平台**，源于数据结构课程中的银行排队模拟题。

通过统一的benchmark框架，在理想条件下对比不同调度算法的性能，帮助理解算法设计的权衡。重点展示**数据结构**和**算法理解**。

## 核心功能

### 1. 调度算法对比（5种）
- **JSQ（最短队列优先）**：选择当前队列最短的窗口
- **RR（轮询分配）**：按窗口编号轮流分配
- **Least Workload（最小工作量）**：选择剩余工作量最小的窗口
- **Single Queue FCFS（共享队列先进先出）**：所有客户进入共享队列，空闲窗口取队首
- **Holding Pool + SPT（待派池+最短业务优先）**：客户先进入待派池，空闲窗口优先取最短业务

### 2. 评价指标（9个）
- **效率指标**：平均等待时间、95分位等待时间、平均逗留时间
- **服务指标**：服务水平（5分钟内）、峰值队列长度、最大等待时间
- **公平性指标**：Jain公平性指数、负载不均衡度、饥饿客户数

### 3. 实验场景（9个）
- balanced_baseline（均衡负载基准）
- burst_peak（突发高峰）
- long_short_mixed（长短业务混合）
- convoy_effect（车队效应）
- overload_equal_jobs（过载等长任务）
- late_short_jobs（后到短任务）
- fairness_stress（公平性压力）
- shared_queue_advantage（共享队列优势）
- short_jobs_after_longs（短作业后到）

### 4. 数据结构体现
- **MinHeap优先队列**：事件调度从O(n²log n)优化到O(n log n)
- **事件优先队列**：正确的tie-breaking（departure优先于arrival）
- **策略模式**：算法可插拔，易扩展

### 5. 可视化功能
- **动态回放**：支持三种队列结构（dedicated/shared/holding）
- **决策审计**：实时显示算法决策过程和原因
- **指标对比**：多算法并行对比
- **趋势图**：实时状态演化

## 技术栈

- **前端框架**：Next.js 15 + React 18 + TypeScript
- **样式方案**：Tailwind CSS
- **可视化**：p5.js
- **开发工具**：Node.js / Bun

## 安装与运行

```bash
# 安装依赖
npm install
# 或
bun install

# 开发模式运行
npm run dev
# 或
bun run dev

# 访问应用
打开浏览器访问 http://localhost:3000

# 构建生产版本
npm run build

# 运行生产版本
npm run start
```

## 项目结构

```
queuelab/
├── src/
│   ├── app/
│   │   ├── api/simulation/route.ts  # API路由（支持benchmark模式）
│   │   ├── globals.css              # 全局样式
│   │   ├── layout.tsx               # 布局组件
│   │   └── page.tsx                 # 主页面
│   ├── components/
│   │   ├── BenchmarkStatusBar.tsx   # 状态栏
│   │   ├── DecisionAuditPanel.tsx   # 决策审计面板
│   │   ├── MetricsComparisonPanel.tsx # 指标对比面板
│   │   ├── MiniTrendPanel.tsx       # 趋势图
│   │   └── P5QueueVisualization.tsx # 可视化组件
│   └── lib/
│       ├── bank-simulation.ts       # Legacy课设逻辑
│       ├── benchmark-types.ts       # Benchmark类型定义
│       ├── benchmark-engine.ts      # 统一模拟引擎
│       ├── benchmark-metrics.ts     # 指标计算
│       ├── benchmark-presets.ts     # 预设场景
│       ├── benchmark-regression.ts  # 回归测试
│       └── policies/                # 调度策略
│           ├── jsq.ts
│           ├── rr.ts
│           ├── leastWorkload.ts
│           ├── singleQueueFcfs.ts
│           └── holdingPoolSpt.ts
├── 设计文档.md
├── 作业提交说明.md
└── package.json
```

## 使用说明

### Ideal Benchmark模式
1. 选择预设场景（如"长短业务混合"）
2. 选择要对比的算法（可多选）
3. 点击"批量对比"按钮
4. 查看指标对比表和可视化动画
5. 观察决策审计面板了解算法决策过程

### 手动输入模式
1. 设置窗口数量
2. 手动输入客户到达时间和服务时间
3. 选择算法运行单次模拟

## 算法说明

### 1. JSQ (Join the Shortest Queue)
- 客户到达时选择队列最短的窗口
- 经典的负载均衡策略

### 2. RR (Round Robin)
- 轮询分配到各个窗口
- 保证负载均匀分布

### 3. Least Workload
- 选择预期工作量最小的窗口
- 考虑当前服务剩余时间和队列总服务时间

### 4. Single Queue FCFS
- 所有客户进入一条共享队列
- 窗口空闲时取队首
- 减少碎片化，提高利用率

### 5. Holding Pool + SPT
- 客户进入待派池
- 窗口空闲时选择服务时间最短的客户
- 最小化平均逗留时间，但可能牺牲公平性

## 评价指标

1. **平均等待时间**：客户从到达到开始服务的平均时间（越小越好）
2. **95分位等待时间**：95%的客户等待时间不超过此值（越小越好）
3. **平均逗留时间**：客户从到达到离开的平均时间（越小越好）
4. **服务水平**：5分钟内开始服务的客户比例（越大越好）
5. **公平性指数**：Jain指数，衡量等待时间分布的公平性（越大越好）
6. **负载均衡度**：窗口利用率的标准差（越小越好）

## 回归测试

运行算法验证测试：

```bash
# 在浏览器控制台或Node环境中
import { runAllRegressionTests } from '@/lib/benchmark-regression';
const result = runAllRegressionTests();
console.log(result);
```

## 课程项目来源

本项目源于数据结构课程的银行排队模拟题，要求实现：
- 事件驱动模拟
- 最短队列优先策略
- 平均逗留时间计算
- 动态可视化展示

现已扩展为通用的调度实验平台，支持多种算法和场景。

## 作者

数据结构课程研讨项目 → QueueLab调度实验平台
