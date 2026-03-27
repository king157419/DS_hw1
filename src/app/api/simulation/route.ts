import { NextRequest, NextResponse } from 'next/server';
import {
  BankSimulation,
  RealisticBankSimulation,
  validateInput,
  validateConfig,
  SimulationInput,
  BankConfig,
  generateTestData
} from '@/lib/bank-simulation';

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
function handleSimulation(data: SimulationInput) {
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

  // 创建模拟实例
  const simulation = new BankSimulation(data.windowCount);

  // 添加客户
  for (const customer of data.customers) {
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
function handleRealisticSimulation(data: BankConfig) {
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

  // 创建真实模拟实例
  const simulation = new RealisticBankSimulation(data);

  // 运行模拟
  const result = simulation.run();

  return NextResponse.json({
    success: true,
    result,
    config: data,
    validation
  });
}

/**
 * 处理验证请求
 */
function handleValidation(data: SimulationInput) {
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

export async function GET() {
  return NextResponse.json({
    message: '银行业务模拟API',
    endpoints: {
      'POST /api/simulation': {
        actions: ['simulate', 'realistic', 'validate', 'testData'],
        description: '执行模拟、真实场景模拟、验证数据或获取测试数据'
      }
    }
  });
}
