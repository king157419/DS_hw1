# 🚀 QueueLab 快速启动指南

## 立即开始

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev

# 3. 打开浏览器
# 访问 http://localhost:3000
```

---

## 核心功能速览

### 1️⃣ 使用Benchmark API对比算法

```bash
# 在浏览器控制台或使用curl测试
curl -X POST http://localhost:3000/api/simulation \
  -H "Content-Type: application/json" \
  -d '{
    "action": "benchmarkCompare",
    "data": {
      "preset": "long_short_mixed",
      "algorithms": [
        "JSQ（最短队列优先）",
        "Single Queue FCFS（单队列先来先服务）",
        "Holding Pool + SPT（待派池+最短处理时间）"
      ]
    }
  }'
```

### 2️⃣ 获取所有预设场景

```bash
curl -X POST http://localhost:3000/api/simulation \
  -H "Content-Type: application/json" \
  -d '{"action": "benchmarkPresets"}'
```

### 3️⃣ 运行单个算法

```bash
curl -X POST http://localhost:3000/api/simulation \
  -H "Content-Type: application/json" \
  -d '{
    "action": "benchmarkSingle",
    "data": {
      "preset": "burst_peak",
      "algorithm": "Holding Pool + SPT（待派池+最短处理时间）"
    }
  }'
```

---

## 📊 7个预设场景

| 场景 | 描述 | 测试目标 |
|------|------|---------|
| `balanced_baseline` | 均衡负载基准 | 验证基本功能 |
| `burst_peak` | 16客户集中到达 | 测试突发流量应对 |
| `long_short_mixed` | 长短业务混合 | 测试SPT优势 |
| `convoy_effect` | 长业务阻塞短业务 | 测试队列结构影响 |
| `overload_equal_jobs` | 20个相同任务 | 测试负载均衡 |
| `late_short_jobs` | 后到短任务 | 测试公平性权衡 |
| `fairness_stress` | 极端服务时间差异 | 测试公平性指标 |

---

## 🎯 5个调度算法

| 算法 | 队列结构 | 核心逻辑 |
|------|---------|---------|
| **JSQ** | Dedicated | 选择队列最短的窗口 |
| **RR** | Dedicated | 轮询分配到各窗口 |
| **Least Workload** | Dedicated | 选择预期工作量最小的窗口 |
| **Single Queue FCFS** | Shared | 单队列，窗口空闲时取队首 |
| **Holding Pool + SPT** | Holding | 待派池，选服务时间最短者 |

---

## 📈 6个评价指标

| 指标 | 公式 | 方向 |
|------|------|------|
| avgWait | mean(startTime - arrivalTime) | ↓ 越小越好 |
| p95Wait | 95th percentile of waitTime | ↓ 越小越好 |
| avgStay | mean(endTime - arrivalTime) | ↓ 越小越好 |
| serviceLevel5m | count(wait ≤ 5) / N | ↑ 越大越好 |
| jainFairnessWait | (Σw)² / (n·Σw²) | ↑ 越大越好 |
| utilizationStd | std(busyTime / totalTime) | ↓ 越小越好 |

---

## 🧪 验证算法实现

创建测试文件 `test-algorithms.js`:

```javascript
// 需要先构建项目: npm run build
import { runAllRegressionTests } from './src/lib/benchmark-regression.js';

const result = runAllRegressionTests();

console.log('\n=== Regression Test Results ===\n');
result.results.forEach(r => {
  console.log(`${r.pass ? '✓' : '✗'} ${r.name}`);
  console.log(`  ${r.message}\n`);
});

console.log(`Total: ${result.passed} passed, ${result.failed} failed`);
process.exit(result.failed > 0 ? 1 : 0);
```

---

## 📦 项目结构

```
queuelab/
├── src/
│   ├── lib/
│   │   ├── benchmark-types.ts       # 类型定义
│   │   ├── benchmark-engine.ts      # 模拟引擎
│   │   ├── benchmark-metrics.ts     # 指标计算
│   │   ├── benchmark-presets.ts     # 7个场景
│   │   ├── benchmark-regression.ts  # 4组测试
│   │   └── policies/                # 5个算法
│   ├── components/                  # UI组件
│   └── app/api/simulation/          # API端点
├── COMPLETION_REPORT.md             # 完成报告
├── IMPLEMENTATION_SUMMARY.md        # 实施总结
└── README.md                        # 项目文档
```

---

## 🎓 课程作业检查清单

- ✅ 事件驱动模拟
- ✅ 最短队列优先策略
- ✅ 平均逗留时间计算
- ✅ 动态可视化
- ✅ 数据验证
- ⭐ 额外：5种算法对比
- ⭐ 额外：6个科学指标
- ⭐ 额外：决策审计系统

---

## 🐛 常见问题

### Q: 构建失败？
```bash
# 清理缓存重新构建
rm -rf .next node_modules
npm install
npm run build
```

### Q: 如何测试API？
```bash
# 使用内置的API测试
npm run dev
# 然后访问 http://localhost:3000/api/simulation
```

### Q: 如何添加新算法？
1. 在 `src/lib/policies/` 创建新文件
2. 实现 `SchedulingPolicy` 接口
3. 在 `route.ts` 中注册

---

## 📚 相关文档

- `README.md` - 完整项目文档
- `COMPLETION_REPORT.md` - 完成报告
- `IMPLEMENTATION_SUMMARY.md` - 实施总结
- `设计文档.md` - 原始设计文档
- `作业提交说明.md` - 课程作业说明

---

## 🎉 成功标志

如果你看到以下输出，说明一切正常：

```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Generating static pages (5/5)

Route (app)                              Size  First Load JS
┌ ○ /                                 10.3 kB         113 kB
└ ƒ /api/simulation                    123 B         102 kB
```

**恭喜！QueueLab已经准备就绪！** 🚀
