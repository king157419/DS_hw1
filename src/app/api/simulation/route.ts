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

export async function GET() {
  return NextResponse.json({
    message: '银行业务模拟API',
    endpoints: {
      'POST /api/simulation': {
        actions: ['simulate', 'realistic', 'validate', 'testData', 'compareAlgorithms'],
        description: '执行模拟、真实场景模拟、验证数据或获取测试数据'
      }
    }
  });
}
