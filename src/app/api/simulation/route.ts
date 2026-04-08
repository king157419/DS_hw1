import { NextRequest, NextResponse } from 'next/server';
import {
  BankSimulation,
  RoundRobinSimulation,
  LeastExpectedWaitSimulation,
  RealisticBankSimulation,
  validateInput,
  validateConfig,
  SimulationInput,
  BankConfig,
  generateTestData
} from '@/lib/bank-simulation';
import { BenchmarkEngine } from '@/lib/benchmark-engine';
import { JSQPolicy } from '@/lib/policies/jsq';
import { RoundRobinPolicy } from '@/lib/policies/rr';
import { LeastWorkloadPolicy } from '@/lib/policies/leastWorkload';
import { SingleQueueFCFSPolicy } from '@/lib/policies/singleQueueFcfs';
import { HoldingPoolSPTPolicy } from '@/lib/policies/holdingPoolSpt';
import { benchmarkPresets, getPreset } from '@/lib/benchmark-presets';
import type { BenchmarkConfig } from '@/lib/benchmark-types';

function cloneSimulationInput(data: SimulationInput): SimulationInput {
  return {
    windowCount: data.windowCount,
    customers: data.customers.map((customer) => ({
      arrivalTime: customer.arrivalTime,
      serviceTime: customer.serviceTime,
    })),
  };
}

function cloneBankConfig(data: BankConfig): BankConfig {
  return { ...data };
}

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: '无效的JSON格式' },
        { status: 400 }
      );
    }
    const { action, data } = body;

    if (!action) {
      return NextResponse.json(
        { error: '缺少action参数' },
        { status: 400 }
      );
    }

    // 根据不同的操作类型处理
    switch (action) {
      case 'simulate':
        return handleSimulation(data);

      case 'realistic':
        return handleRealisticSimulation(data);

      case 'validate':
        return handleValidation(data);

      case 'testData':
        return handleTestData(data);

      case 'compareAlgorithms':
        return handleCompareAlgorithms(data);

      case 'benchmarkCompare':
        return handleBenchmarkCompare(data);

      case 'benchmarkSingle':
        return handleBenchmarkSingle(data);

      case 'benchmarkPresets':
        return handleBenchmarkPresets();

      default:
        return NextResponse.json(
          { error: '未知的操作类型' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: '服务器内部错误', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

/**
 * 处理模拟请求
 */
function handleSimulation(data: unknown) {
  // 验证输入
  const validation = validateInput(data);
  if (!validation.isValid) {
    return NextResponse.json(
      { 
        success: false, 
        error: '输入数据验证失败', 
        validation 
      },
      { status: 400 }
    );
  }

  const simulationInput = cloneSimulationInput(data as SimulationInput);

  // 创建模拟实例
  const simulation = new BankSimulation(simulationInput.windowCount);

  // 添加客户
  for (const customer of simulationInput.customers) {
    simulation.addCustomer(customer.arrivalTime, customer.serviceTime);
  }

  // 运行模拟
  const result = simulation.run();

  return NextResponse.json({
    success: true,
    result,
    validation
  });
}

/**
 * 处理真实场景模拟请求
 */
function handleRealisticSimulation(data: unknown) {
  // 验证配置
  const validation = validateConfig(data);
  if (!validation.isValid) {
    return NextResponse.json(
      {
        success: false,
        error: '配置验证失败',
        validation
      },
      { status: 400 }
    );
  }

  const config = cloneBankConfig(data as BankConfig);

  // 创建真实模拟实例
  const simulation = new RealisticBankSimulation(config);

  // 运行模拟
  const result = simulation.run();

  return NextResponse.json({
    success: true,
    result,
    config,
    validation
  });
}

/**
 * 处理验证请求
 */
function handleValidation(data: unknown) {
  const validation = validateInput(data);
  return NextResponse.json({
    success: true,
    validation
  });
}

/**
 * 处理测试数据请求
 */
function handleTestData(data: { type: 'valid' | 'invalid_all' | 'invalid_partial' }) {
  const testData = generateTestData(data.type);
  const validation = validateInput(testData);
  
  return NextResponse.json({
    success: true,
    testData,
    validation
  });
}

/**
 * 对比三种调度算法（使用相同输入数据）
 */
function handleCompareAlgorithms(data: unknown) {
  const validation = validateInput(data);
  if (!validation.isValid) {
    return NextResponse.json(
      {
        success: false,
        error: '输入数据验证失败',
        validation
      },
      { status: 400 }
    );
  }

  const simulationInput = cloneSimulationInput(data as SimulationInput);

  const algorithms = [
    { algorithmName: 'SQF（最短队列优先）', sim: new BankSimulation(simulationInput.windowCount) },
    { algorithmName: 'RR（轮询分配）', sim: new RoundRobinSimulation(simulationInput.windowCount) },
    { algorithmName: 'LEW（最短预期等待）', sim: new LeastExpectedWaitSimulation(simulationInput.windowCount) },
  ];

  const results = algorithms.map(({ algorithmName, sim }) => {
    simulationInput.customers.forEach(c => sim.addCustomer(c.arrivalTime, c.serviceTime));
    return { algorithmName, result: sim.run() };
  });

  return NextResponse.json({ success: true, results, validation });
}

/**
 * Benchmark模式：批量对比多个算法
 */
function handleBenchmarkCompare(data: unknown) {
  const { preset, algorithms } = data as { preset: string; algorithms?: string[] };

  const presetData = getPreset(preset);
  if (!presetData) {
    return NextResponse.json(
      { success: false, error: '未找到指定的预设场景' },
      { status: 400 }
    );
  }

  // 默认对比所有5个算法
  const allPolicies = [
    new JSQPolicy(),
    new RoundRobinPolicy(),
    new LeastWorkloadPolicy(),
    new SingleQueueFCFSPolicy(),
    new HoldingPoolSPTPolicy()
  ];

  const selectedPolicies = algorithms
    ? allPolicies.filter(p => algorithms.includes(p.name))
    : allPolicies;

  const results = selectedPolicies.map(policy => {
    const config: BenchmarkConfig = {
      serverCount: presetData.serverCount,
      jobs: presetData.jobs,
      policy
    };
    const engine = new BenchmarkEngine(config);
    return engine.run();
  });

  return NextResponse.json({
    success: true,
    preset: presetData.name,
    results
  });
}

/**
 * Benchmark模式：运行单个算法
 */
function handleBenchmarkSingle(data: unknown) {
  const { preset, algorithm } = data as { preset: string; algorithm: string };

  const presetData = getPreset(preset);
  if (!presetData) {
    return NextResponse.json(
      { success: false, error: '未找到指定的预设场景' },
      { status: 400 }
    );
  }

  const allPolicies = [
    new JSQPolicy(),
    new RoundRobinPolicy(),
    new LeastWorkloadPolicy(),
    new SingleQueueFCFSPolicy(),
    new HoldingPoolSPTPolicy()
  ];

  const policy = allPolicies.find(p => p.name === algorithm);
  if (!policy) {
    return NextResponse.json(
      { success: false, error: '未找到指定的算法' },
      { status: 400 }
    );
  }

  const config: BenchmarkConfig = {
    serverCount: presetData.serverCount,
    jobs: presetData.jobs,
    policy
  };

  const engine = new BenchmarkEngine(config);
  const result = engine.run();

  return NextResponse.json({
    success: true,
    preset: presetData.name,
    result
  });
}

/**
 * 获取所有预设场景列表
 */
function handleBenchmarkPresets() {
  const presets = Object.entries(benchmarkPresets).map(([key, preset]) => ({
    key,
    name: preset.name,
    description: preset.description,
    serverCount: preset.serverCount,
    jobCount: preset.jobs.length
  }));

  return NextResponse.json({
    success: true,
    presets
  });
}

export async function GET() {
  return NextResponse.json({
    message: 'QueueLab 调度实验平台 API',
    endpoints: {
      'POST /api/simulation': {
        actions: [
          'simulate',
          'realistic',
          'validate',
          'testData',
          'compareAlgorithms',
          'benchmarkCompare',
          'benchmarkSingle',
          'benchmarkPresets'
        ],
        description: '执行模拟、真实场景模拟、验证数据、获取测试数据或运行benchmark实验'
      }
    }
  });
}
