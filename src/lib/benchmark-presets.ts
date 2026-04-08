/**
 * QueueLab Benchmark Presets
 * 7个deterministic预设场景，用于算法对比实验
 */

import type { BenchmarkPreset } from './benchmark-types';

export const benchmarkPresets: Record<string, BenchmarkPreset> = {
  /**
   * 1. 均衡负载基准
   * 客户均匀到达，服务时间适中
   */
  balanced_baseline: {
    name: '均衡负载基准',
    description: '客户均匀到达，服务时间适中，用于验证基本功能',
    serverCount: 4,
    jobs: [
      { arrivalTime: 0, serviceTime: 5 },
      { arrivalTime: 2, serviceTime: 6 },
      { arrivalTime: 4, serviceTime: 5 },
      { arrivalTime: 6, serviceTime: 7 },
      { arrivalTime: 8, serviceTime: 5 },
      { arrivalTime: 10, serviceTime: 6 },
      { arrivalTime: 12, serviceTime: 5 },
      { arrivalTime: 14, serviceTime: 6 },
      { arrivalTime: 16, serviceTime: 5 },
      { arrivalTime: 18, serviceTime: 7 },
      { arrivalTime: 20, serviceTime: 5 },
      { arrivalTime: 22, serviceTime: 6 }
    ]
  },

  /**
   * 2. 突发高峰
   * 短时间内大量客户同时到达
   */
  burst_peak: {
    name: '突发高峰',
    description: '16个客户在0-2分钟内集中到达，测试算法应对突发流量的能力',
    serverCount: 4,
    jobs: [
      { arrivalTime: 0, serviceTime: 5 },
      { arrivalTime: 0, serviceTime: 6 },
      { arrivalTime: 0, serviceTime: 4 },
      { arrivalTime: 0, serviceTime: 7 },
      { arrivalTime: 1, serviceTime: 5 },
      { arrivalTime: 1, serviceTime: 6 },
      { arrivalTime: 1, serviceTime: 5 },
      { arrivalTime: 1, serviceTime: 4 },
      { arrivalTime: 2, serviceTime: 6 },
      { arrivalTime: 2, serviceTime: 5 },
      { arrivalTime: 2, serviceTime: 7 },
      { arrivalTime: 2, serviceTime: 5 },
      { arrivalTime: 2, serviceTime: 6 },
      { arrivalTime: 2, serviceTime: 4 },
      { arrivalTime: 2, serviceTime: 5 },
      { arrivalTime: 2, serviceTime: 6 }
    ]
  },

  /**
   * 3. 长短业务混合
   * 长业务和短业务交错到达，测试SPT优势
   */
  long_short_mixed: {
    name: '长短业务混合',
    description: '长业务（12分钟）和短业务（1-2分钟）混合，测试SPT对平均逗留时间的优化',
    serverCount: 4,
    jobs: [
      { arrivalTime: 0, serviceTime: 12 },
      { arrivalTime: 0, serviceTime: 1 },
      { arrivalTime: 0, serviceTime: 12 },
      { arrivalTime: 0, serviceTime: 2 },
      { arrivalTime: 1, serviceTime: 12 },
      { arrivalTime: 1, serviceTime: 1 },
      { arrivalTime: 1, serviceTime: 12 },
      { arrivalTime: 1, serviceTime: 2 },
      { arrivalTime: 2, serviceTime: 1 },
      { arrivalTime: 2, serviceTime: 2 },
      { arrivalTime: 2, serviceTime: 1 },
      { arrivalTime: 2, serviceTime: 2 },
      { arrivalTime: 3, serviceTime: 1 },
      { arrivalTime: 3, serviceTime: 2 },
      { arrivalTime: 3, serviceTime: 1 },
      { arrivalTime: 3, serviceTime: 2 }
    ]
  },

  /**
   * 4. 车队效应
   * 一个长业务阻塞后续短业务
   */
  convoy_effect: {
    name: '车队效应',
    description: '一个长业务（20分钟）后跟随多个短业务（1分钟），测试队列结构对车队效应的影响',
    serverCount: 4,
    jobs: [
      { arrivalTime: 0, serviceTime: 20 },
      { arrivalTime: 0, serviceTime: 1 },
      { arrivalTime: 0, serviceTime: 1 },
      { arrivalTime: 0, serviceTime: 1 },
      { arrivalTime: 1, serviceTime: 20 },
      { arrivalTime: 1, serviceTime: 1 },
      { arrivalTime: 1, serviceTime: 1 },
      { arrivalTime: 1, serviceTime: 1 },
      { arrivalTime: 2, serviceTime: 20 },
      { arrivalTime: 2, serviceTime: 1 },
      { arrivalTime: 2, serviceTime: 1 },
      { arrivalTime: 2, serviceTime: 1 },
      { arrivalTime: 3, serviceTime: 20 },
      { arrivalTime: 3, serviceTime: 1 },
      { arrivalTime: 3, serviceTime: 1 },
      { arrivalTime: 3, serviceTime: 1 }
    ]
  },

  /**
   * 5. 过载等长任务
   * 大量相同服务时间的任务，测试负载均衡
   */
  overload_equal_jobs: {
    name: '过载等长任务',
    description: '20个服务时间相同（5分钟）的任务同时到达，测试负载均衡能力',
    serverCount: 4,
    jobs: Array.from({ length: 20 }, (_, i) => ({
      arrivalTime: 0,
      serviceTime: 5
    }))
  },

  /**
   * 6. 后到短任务
   * 前期长任务，后期短任务，测试SPT和公平性权衡
   */
  late_short_jobs: {
    name: '后到短任务',
    description: '前8个长任务（10分钟），后8个短任务（1分钟），测试SPT效率和公平性权衡',
    serverCount: 4,
    jobs: [
      { arrivalTime: 0, serviceTime: 10 },
      { arrivalTime: 0, serviceTime: 10 },
      { arrivalTime: 0, serviceTime: 10 },
      { arrivalTime: 0, serviceTime: 10 },
      { arrivalTime: 1, serviceTime: 10 },
      { arrivalTime: 1, serviceTime: 10 },
      { arrivalTime: 1, serviceTime: 10 },
      { arrivalTime: 1, serviceTime: 10 },
      { arrivalTime: 5, serviceTime: 1 },
      { arrivalTime: 5, serviceTime: 1 },
      { arrivalTime: 5, serviceTime: 1 },
      { arrivalTime: 5, serviceTime: 1 },
      { arrivalTime: 6, serviceTime: 1 },
      { arrivalTime: 6, serviceTime: 1 },
      { arrivalTime: 6, serviceTime: 1 },
      { arrivalTime: 6, serviceTime: 1 }
    ]
  },

  /**
   * 7. 公平性压力测试
   * 极端服务时间差异，测试公平性指标
   */
  fairness_stress: {
    name: '公平性压力测试',
    description: '服务时间从1到15分钟递增，测试算法对不同客户的公平性',
    serverCount: 4,
    jobs: [
      { arrivalTime: 0, serviceTime: 1 },
      { arrivalTime: 0, serviceTime: 3 },
      { arrivalTime: 0, serviceTime: 5 },
      { arrivalTime: 0, serviceTime: 7 },
      { arrivalTime: 1, serviceTime: 9 },
      { arrivalTime: 1, serviceTime: 11 },
      { arrivalTime: 1, serviceTime: 13 },
      { arrivalTime: 1, serviceTime: 15 },
      { arrivalTime: 2, serviceTime: 2 },
      { arrivalTime: 2, serviceTime: 4 },
      { arrivalTime: 2, serviceTime: 6 },
      { arrivalTime: 2, serviceTime: 8 },
      { arrivalTime: 3, serviceTime: 10 },
      { arrivalTime: 3, serviceTime: 12 },
      { arrivalTime: 3, serviceTime: 14 },
      { arrivalTime: 3, serviceTime: 1 }
    ]
  }
};

/**
 * 获取所有预设名称列表
 */
export function getPresetNames(): string[] {
  return Object.keys(benchmarkPresets);
}

/**
 * 获取预设
 */
export function getPreset(name: string): BenchmarkPreset | undefined {
  return benchmarkPresets[name];
}
