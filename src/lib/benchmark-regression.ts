/**
 * QueueLab Benchmark Regression Tests
 * 4组算法分歧验证测试，确保算法实现正确
 */

import { BenchmarkEngine } from './benchmark-engine';
import { JSQPolicy } from './policies/jsq';
import { LeastWorkloadPolicy } from './policies/leastWorkload';
import { SingleQueueFCFSPolicy } from './policies/singleQueueFcfs';
import { HoldingPoolSPTPolicy } from './policies/holdingPoolSpt';
import type { BenchmarkConfig } from './benchmark-types';

/**
 * Case A: Single Queue应该在碎片化场景下优于Dedicated Queues
 *
 * 场景：16个客户同时到达，服务时长交错
 * 预期：Single Queue FCFS的平均等待时间应该低于JSQ
 */
export function testSingleQueueBeatsFragmentation(): { pass: boolean; message: string } {
  const jobs = [
    { arrivalTime: 0, serviceTime: 8 },
    { arrivalTime: 0, serviceTime: 2 },
    { arrivalTime: 0, serviceTime: 8 },
    { arrivalTime: 0, serviceTime: 2 },
    { arrivalTime: 0, serviceTime: 8 },
    { arrivalTime: 0, serviceTime: 2 },
    { arrivalTime: 0, serviceTime: 8 },
    { arrivalTime: 0, serviceTime: 2 },
    { arrivalTime: 0, serviceTime: 8 },
    { arrivalTime: 0, serviceTime: 2 },
    { arrivalTime: 0, serviceTime: 8 },
    { arrivalTime: 0, serviceTime: 2 },
    { arrivalTime: 0, serviceTime: 8 },
    { arrivalTime: 0, serviceTime: 2 },
    { arrivalTime: 0, serviceTime: 8 },
    { arrivalTime: 0, serviceTime: 2 }
  ];

  const jsqConfig: BenchmarkConfig = {
    serverCount: 4,
    jobs,
    policy: new JSQPolicy()
  };

  const sqConfig: BenchmarkConfig = {
    serverCount: 4,
    jobs,
    policy: new SingleQueueFCFSPolicy()
  };

  const jsqResult = new BenchmarkEngine(jsqConfig).run();
  const sqResult = new BenchmarkEngine(sqConfig).run();

  const jsqAvgWait = jsqResult.metrics.avgWait;
  const sqAvgWait = sqResult.metrics.avgWait;

  const pass = sqAvgWait < jsqAvgWait;

  return {
    pass,
    message: pass
      ? `✓ Single Queue (${sqAvgWait.toFixed(2)}) < JSQ (${jsqAvgWait.toFixed(2)})`
      : `✗ Single Queue (${sqAvgWait.toFixed(2)}) >= JSQ (${jsqAvgWait.toFixed(2)}) - 预期Single Queue更优`
  };
}

/**
 * Case B: Holding Pool + SPT应该显著降低平均逗留时间
 *
 * 场景：前面几个长业务，后面一串短业务
 * 预期：SPT的平均逗留时间应该明显低于FCFS类规则
 */
export function testHoldingPoolSPTReducesAvgStay(): { pass: boolean; message: string } {
  const jobs = [
    { arrivalTime: 0, serviceTime: 15 },
    { arrivalTime: 0, serviceTime: 15 },
    { arrivalTime: 0, serviceTime: 15 },
    { arrivalTime: 0, serviceTime: 15 },
    { arrivalTime: 1, serviceTime: 1 },
    { arrivalTime: 1, serviceTime: 1 },
    { arrivalTime: 1, serviceTime: 1 },
    { arrivalTime: 1, serviceTime: 1 },
    { arrivalTime: 2, serviceTime: 1 },
    { arrivalTime: 2, serviceTime: 1 },
    { arrivalTime: 2, serviceTime: 1 },
    { arrivalTime: 2, serviceTime: 1 },
    { arrivalTime: 3, serviceTime: 1 },
    { arrivalTime: 3, serviceTime: 1 },
    { arrivalTime: 3, serviceTime: 1 },
    { arrivalTime: 3, serviceTime: 1 }
  ];

  const sqConfig: BenchmarkConfig = {
    serverCount: 4,
    jobs,
    policy: new SingleQueueFCFSPolicy()
  };

  const sptConfig: BenchmarkConfig = {
    serverCount: 4,
    jobs,
    policy: new HoldingPoolSPTPolicy()
  };

  const sqResult = new BenchmarkEngine(sqConfig).run();
  const sptResult = new BenchmarkEngine(sptConfig).run();

  const sqAvgStay = sqResult.metrics.avgStay;
  const sptAvgStay = sptResult.metrics.avgStay;

  // SPT应该至少降低10%
  const improvement = (sqAvgStay - sptAvgStay) / sqAvgStay;
  const pass = improvement > 0.1;

  return {
    pass,
    message: pass
      ? `✓ SPT (${sptAvgStay.toFixed(2)}) 比 FCFS (${sqAvgStay.toFixed(2)}) 降低 ${(improvement * 100).toFixed(1)}%`
      : `✗ SPT (${sptAvgStay.toFixed(2)}) vs FCFS (${sqAvgStay.toFixed(2)}) 改进不足10%`
  };
}

/**
 * Case C: JSQ vs Least Workload应该在特定场景下分叉
 *
 * 场景：两窗口队列人数一样，但剩余工作量不同
 * 预期：Least Workload选择工作量小的，JSQ选择队列短的（可能不同）
 */
export function testJSQvsLeastWorkloadDiverge(): { pass: boolean; message: string } {
  // 构造场景：窗口1有2个短任务(2+2)，窗口2有2个长任务(8+8)
  // 队列长度相同，但工作量不同
  const jobs = [
    // 先让4个窗口都忙起来
    { arrivalTime: 0, serviceTime: 10 },
    { arrivalTime: 0, serviceTime: 10 },
    { arrivalTime: 0, serviceTime: 10 },
    { arrivalTime: 0, serviceTime: 10 },
    // 窗口1的队列：2个短任务
    { arrivalTime: 1, serviceTime: 2 },
    { arrivalTime: 1, serviceTime: 2 },
    // 窗口2的队列：2个长任务
    { arrivalTime: 1, serviceTime: 8 },
    { arrivalTime: 1, serviceTime: 8 },
    // 关键任务：到达时窗口1和2队列长度相同(都是2)，但工作量不同
    { arrivalTime: 2, serviceTime: 5 }
  ];

  const jsqConfig: BenchmarkConfig = {
    serverCount: 4,
    jobs,
    policy: new JSQPolicy()
  };

  const lwConfig: BenchmarkConfig = {
    serverCount: 4,
    jobs,
    policy: new LeastWorkloadPolicy()
  };

  const jsqResult = new BenchmarkEngine(jsqConfig).run();
  const lwResult = new BenchmarkEngine(lwConfig).run();

  // 检查关键任务(id=9)的分配是否不同
  const jsqJob9 = jsqResult.jobs.find(j => j.id === 9);
  const lwJob9 = lwResult.jobs.find(j => j.id === 9);

  const pass = !!(jsqJob9 && lwJob9 && jsqJob9.assignedServerId !== lwJob9.assignedServerId);

  return {
    pass,
    message: pass
      ? `✓ JSQ分配到窗口${jsqJob9?.assignedServerId}, LW分配到窗口${lwJob9?.assignedServerId} - 决策分叉`
      : `✗ JSQ和LW都分配到窗口${jsqJob9?.assignedServerId} - 未能分叉`
  };
}

/**
 * Case D: 公平性权衡应该显现
 *
 * 场景：服务时间差异大的任务
 * 预期：SPT效率更高，但Jain公平性更差
 */
export function testFairnessTradeoff(): { pass: boolean; message: string } {
  const jobs = [
    { arrivalTime: 0, serviceTime: 1 },
    { arrivalTime: 0, serviceTime: 15 },
    { arrivalTime: 0, serviceTime: 1 },
    { arrivalTime: 0, serviceTime: 15 },
    { arrivalTime: 1, serviceTime: 1 },
    { arrivalTime: 1, serviceTime: 15 },
    { arrivalTime: 1, serviceTime: 1 },
    { arrivalTime: 1, serviceTime: 15 },
    { arrivalTime: 2, serviceTime: 1 },
    { arrivalTime: 2, serviceTime: 15 },
    { arrivalTime: 2, serviceTime: 1 },
    { arrivalTime: 2, serviceTime: 15 }
  ];

  const sqConfig: BenchmarkConfig = {
    serverCount: 4,
    jobs,
    policy: new SingleQueueFCFSPolicy()
  };

  const sptConfig: BenchmarkConfig = {
    serverCount: 4,
    jobs,
    policy: new HoldingPoolSPTPolicy()
  };

  const sqResult = new BenchmarkEngine(sqConfig).run();
  const sptResult = new BenchmarkEngine(sptConfig).run();

  // SPT应该效率更高（avgStay更低）
  const sptMoreEfficient = sptResult.metrics.avgStay < sqResult.metrics.avgStay;

  // SPT应该公平性更差（Jain指数更低）
  const sptLessFair = sptResult.metrics.jainFairnessWait < sqResult.metrics.jainFairnessWait;

  const pass = sptMoreEfficient && sptLessFair;

  return {
    pass,
    message: pass
      ? `✓ SPT更高效(${sptResult.metrics.avgStay.toFixed(2)} < ${sqResult.metrics.avgStay.toFixed(2)})但更不公平(${sptResult.metrics.jainFairnessWait.toFixed(3)} < ${sqResult.metrics.jainFairnessWait.toFixed(3)})`
      : `✗ 效率: SPT=${sptResult.metrics.avgStay.toFixed(2)} vs FCFS=${sqResult.metrics.avgStay.toFixed(2)}, 公平性: SPT=${sptResult.metrics.jainFairnessWait.toFixed(3)} vs FCFS=${sqResult.metrics.jainFairnessWait.toFixed(3)}`
  };
}

/**
 * 运行所有回归测试
 */
export function runAllRegressionTests(): { passed: number; failed: number; results: Array<{ name: string; pass: boolean; message: string }> } {
  const tests = [
    { name: 'Single Queue vs Fragmentation', fn: testSingleQueueBeatsFragmentation },
    { name: 'Holding Pool SPT Reduces AvgStay', fn: testHoldingPoolSPTReducesAvgStay },
    { name: 'JSQ vs Least Workload Diverge', fn: testJSQvsLeastWorkloadDiverge },
    { name: 'Fairness Tradeoff', fn: testFairnessTradeoff }
  ];

  const results = tests.map(test => ({
    name: test.name,
    ...test.fn()
  }));

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;

  return { passed, failed, results };
}
