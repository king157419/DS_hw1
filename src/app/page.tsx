'use client';

import { useState, useCallback } from 'react';
import { formatTime, validateConfig, validateInput, type BankConfig, type SimulationInput, type ValidationResult } from '@/lib/bank-simulation';
import dynamic from 'next/dynamic';

const P5QueueVisualization = dynamic(() => import('@/components/P5QueueVisualization'), { ssr: false });
const AlgorithmicArt = dynamic(() => import('@/components/AlgorithmicArt'), { ssr: false });

// 类型定义
interface Customer {
  id: number;
  arrivalTime: number;
  serviceTime: number;
  startTime: number;
  endTime: number;
  windowId: number;
  waitTime: number;
  status: 'waiting' | 'serving' | 'completed';
}

interface Window {
  id: number;
  queue: Customer[];
  currentCustomer: Customer | null;
  totalServed: number;
  totalWaitTime: number;
  totalServiceTime: number;
  idleTime: number;
}

interface Statistics {
  totalCustomers: number;
  avgWaitTime: number;
  avgStayTime: number;
  avgServiceTime: number;
  maxWaitTime: number;
  maxQueueLength: number;
  totalSimulationTime: number;
  windowUtilization: number[];
}

interface TimelineEvent {
  time: number;
  type: 'arrival' | 'start_service' | 'end_service';
  customerId: number;
  windowId?: number;
  description: string;
}

interface SimulationResult {
  customers: Customer[];
  windows: Window[];
  statistics: Statistics;
  timeline: TimelineEvent[];
}

interface CustomerInput {
  arrivalTime: string;
  serviceTime: string;
}

interface RealisticSimulationForm {
  customersPerHour: number;
  avgServiceTime: number;
  lunchBreakEnabled: boolean;
  lunchStart: number;
  lunchDuration: number;
  windowBreakEnabled: boolean;
  windowBreakInterval: number;
  windowBreakDuration: number;
  toiletBreakEnabled: boolean;
  toiletBreakProbability: number;
  toiletBreakDuration: number;
}

const BUSINESS_DURATION_MINUTES = 480;
const BUSINESS_DURATION_HOURS = BUSINESS_DURATION_MINUTES / 60;

function parseNumericField(value: string): number {
  const trimmed = value.trim();
  if (trimmed === '') {
    return Number.NaN;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function buildSimulationInput(customers: CustomerInput[], windowCount: number): SimulationInput {
  return {
    windowCount,
    customers: customers.map((customer) => ({
      arrivalTime: parseNumericField(customer.arrivalTime),
      serviceTime: parseNumericField(customer.serviceTime),
    })),
  };
}

function buildSimulationInputFromResult(result: SimulationResult, windowCount: number): SimulationInput {
  return {
    windowCount,
    customers: result.customers.map((customer) => ({
      arrivalTime: customer.arrivalTime,
      serviceTime: customer.serviceTime,
    })),
  };
}

function buildRealisticConfig(bankConfig: RealisticSimulationForm, windowCount: number): BankConfig {
  return {
    baseWindowCount: windowCount,
    maxWindowCount: Math.min(10, windowCount + 2),
    elasticThreshold: 5,
    openTime: 0,
    closeTime: BUSINESS_DURATION_MINUTES,
    lunchBreakEnabled: bankConfig.lunchBreakEnabled,
    lunchStart: bankConfig.lunchStart,
    lunchDuration: bankConfig.lunchDuration,
    baseArrivalRate: bankConfig.customersPerHour / 60,
    peakHoursMultiplier: 1.5,
    peakHoursStart: 60,
    peakHoursEnd: 180,
    avgServiceTime: bankConfig.avgServiceTime,
    serviceTimeStdDev: bankConfig.avgServiceTime * 0.3,
    isPensionDay: false,
    pensionDayMultiplier: 3,
    elderlyRatio: 0.3,
    windowBreakEnabled: bankConfig.windowBreakEnabled,
    windowBreakInterval: bankConfig.windowBreakInterval,
    windowBreakDuration: bankConfig.windowBreakDuration,
    toiletBreakEnabled: bankConfig.toiletBreakEnabled,
    toiletBreakProbability: bankConfig.toiletBreakProbability,
    toiletBreakDuration: bankConfig.toiletBreakDuration,
    seed: Date.now(),
  };
}

function getValidationErrorMessage(validation: ValidationResult, fallback: string): string {
  return validation.errors[0] || fallback;
}

export default function BankSimulationPage() {
  // 状态管理
  const [customers, setCustomers] = useState<CustomerInput[]>([
    { arrivalTime: '0', serviceTime: '5' },
    { arrivalTime: '1', serviceTime: '8' },
    { arrivalTime: '2', serviceTime: '3' },
  ]);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [lastSimulationInput, setLastSimulationInput] = useState<SimulationInput | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'input' | 'result' | 'timeline' | 'dynamic'>('input');
  const [error, setError] = useState<string | null>(null);
  const [windowCount, setWindowCount] = useState(4);

  // 随机模拟配置
  const [bankConfig, setBankConfig] = useState<RealisticSimulationForm>({
    customersPerHour: 20,   // 每小时客户数
    avgServiceTime: 5,      // 平均服务时间
    // 真实情况参数
    lunchBreakEnabled: false,
    lunchStart: 180,        // 开门后180分钟（12:00）
    lunchDuration: 60,
    windowBreakEnabled: false,
    windowBreakInterval: 120,
    windowBreakDuration: 10,
    toiletBreakEnabled: false,
    toiletBreakProbability: 0.3,
    toiletBreakDuration: 5,
  });

  // 算法对比结果
  const [comparisonResults, setComparisonResults] = useState<{algorithmName: string; result: SimulationResult}[] | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  // 动态可视化状态（统一，所有模拟方式共用）
  const [resultIsPlaying, setResultIsPlaying] = useState(false);
  const [resultCurrentTime, setResultCurrentTime] = useState(0);
  const [resultSpeed, setResultSpeed] = useState(1);
  const estimatedCustomers = Math.round(bankConfig.customersPerHour * BUSINESS_DURATION_HOURS);
  const lunchStartMax = BUSINESS_DURATION_MINUTES - Math.max(bankConfig.lunchDuration, 15);
  const lunchDurationMax = Math.max(15, BUSINESS_DURATION_MINUTES - bankConfig.lunchStart);

  // 添加客户
  const addCustomer = useCallback(() => {
    setCustomers(prev => [...prev, { arrivalTime: '', serviceTime: '' }]);
  }, []);

  // 删除客户
  const removeCustomer = useCallback((index: number) => {
    setCustomers(prev => prev.filter((_, i) => i !== index));
  }, []);

  // 更新客户数据
  const updateCustomer = useCallback((index: number, field: 'arrivalTime' | 'serviceTime', value: string) => {
    setCustomers(prev => {
      const newCustomers = [...prev];
      newCustomers[index] = { ...newCustomers[index], [field]: value };
      return newCustomers;
    });
  }, []);

  // 加载测试数据并运行
  const loadTestDataAndRun = useCallback(async (type: 'valid' | 'invalid_all' | 'invalid_partial') => {
    setLoading(true);
    setError(null);
    setValidation(null);

    try {
      // 1. 先加载测试数据
      const testResponse = await fetch('/api/simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'testData', data: { type } }),
      });
      const testData = await testResponse.json();

      if (!testData.success) {
        setError('加载测试数据失败');
        return;
      }

      // 更新界面数据
      const simulationInput: SimulationInput = {
        windowCount: testData.testData.windowCount,
        customers: testData.testData.customers.map((c: { arrivalTime: number; serviceTime: number }) => ({
          arrivalTime: c.arrivalTime,
          serviceTime: c.serviceTime,
        })),
      };
      const localValidation = validateInput(simulationInput);

      setWindowCount(simulationInput.windowCount);
      setCustomers(simulationInput.customers.map((c) => ({
        arrivalTime: c.arrivalTime.toString(),
        serviceTime: c.serviceTime.toString(),
      })));
      setValidation(localValidation);

      // 2. 如果数据合法，自动运行模拟
      if (!localValidation.isValid) {
        setError(getValidationErrorMessage(localValidation, '测试数据验证失败'));
        return;
      }

      if (localValidation.isValid) {
        const simResponse = await fetch('/api/simulation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'simulate',
            data: simulationInput,
          }),
        });
        const simData = await simResponse.json();

        if (simData.success) {
          setResult(simData.result);
          setLastSimulationInput(simulationInput);
          setComparisonResults(null);
          setResultCurrentTime(0);
          setResultIsPlaying(false);
          setValidation(simData.validation ?? localValidation);
          setActiveTab('result');
        } else {
          setValidation(simData.validation ?? localValidation);
          setError(simData.error || '模拟失败');
        }
      }
    } catch {
      setError('运行失败');
    } finally {
      setLoading(false);
    }
  }, [windowCount]);

  // 运行模拟
  const runSimulation = useCallback(async () => {
    setLoading(true);
    setError(null);
    setValidation(null);

    try {
      const simulationInput = buildSimulationInput(customers, windowCount);
      const localValidation = validateInput(simulationInput);
      setValidation(localValidation);

      if (!localValidation.isValid) {
        setError(getValidationErrorMessage(localValidation, '输入数据验证失败'));
        return;
      }

      const response = await fetch('/api/simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'simulate',
          data: simulationInput,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.result);
        setLastSimulationInput(simulationInput);
        setComparisonResults(null);
        setResultCurrentTime(0);
        setResultIsPlaying(false);
        setValidation(data.validation ?? localValidation);
        setActiveTab('result');
      } else {
        setValidation(data.validation ?? localValidation);
        setError(data.error || '模拟失败');
      }
    } catch {
      setError('运行模拟失败，请检查输入数据');
    } finally {
      setLoading(false);
    }
  }, [customers, windowCount]);

  // 清空数据
  const clearData = useCallback(() => {
    setCustomers([{ arrivalTime: '', serviceTime: '' }]);
    setResult(null);
    setValidation(null);
    setLastSimulationInput(null);
    setComparisonResults(null);
    setError(null);
    setActiveTab('input');
  }, []);

  // 运行随机客户模拟
  const runRealisticSimulation = useCallback(async () => {
    setLoading(true);
    setError(null);
    setValidation(null);
    try {
      const config = buildRealisticConfig(bankConfig, windowCount);
      const localValidation = validateConfig(config);
      setValidation(localValidation);

      if (!localValidation.isValid) {
        setError(getValidationErrorMessage(localValidation, '随机模拟参数验证失败'));
        return;
      }
      const response = await fetch('/api/simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'realistic', data: config })
      });
      const data = await response.json();
      if (data.success) {
        setResult(data.result);
        setLastSimulationInput(buildSimulationInputFromResult(data.result, config.baseWindowCount));
        setComparisonResults(null);
        setResultCurrentTime(0);
        setResultIsPlaying(false);
        setValidation(data.validation ?? localValidation);
        setActiveTab('dynamic');
      } else {
        setValidation(data.validation ?? localValidation);
        setError(data.error || '模拟失败');
      }
    } catch {
      setError('运行模拟失败');
    } finally {
      setLoading(false);
    }
  }, [bankConfig, windowCount]);

  // 对比三种调度算法
  const runComparison = useCallback(async () => {
    if (!lastSimulationInput) {
      setError('请先运行一次有效模拟');
      return;
    }

    setComparisonLoading(true);
    setError(null);
    try {
      // 使用最近一次成功模拟的原始输入做算法对比，避免混入未提交或自动生成的数据
      const comparisonInput: SimulationInput = {
        windowCount: lastSimulationInput.windowCount,
        customers: lastSimulationInput.customers.map((customer) => ({
          arrivalTime: customer.arrivalTime,
          serviceTime: customer.serviceTime,
        })),
      };
      const localValidation = validateInput(comparisonInput);
      setValidation(localValidation);

      if (!localValidation.isValid) {
        setError(getValidationErrorMessage(localValidation, '对比数据验证失败'));
        return;
      }

      const response = await fetch('/api/simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'compareAlgorithms', data: comparisonInput }),
      });
      const data = await response.json();
      if (data.success) {
        setComparisonResults(data.results);
        setValidation(data.validation ?? localValidation);
      } else {
        setValidation(data.validation ?? localValidation);
        setError(data.error || '对比失败');
      }
    } catch {
      setError('对比算法失败');
    } finally {
      setComparisonLoading(false);
    }
  }, [lastSimulationInput]);

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* 标题 */}
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-block mb-4">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <span className="text-4xl">🏦</span>
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-3">
            <span className="gradient-text">银行业务活动模拟系统</span>
          </h1>
          <p className="text-gray-700 font-medium text-lg">
            模拟银行多窗口业务活动，计算客户平均逗留时间
          </p>
        </div>

        {/* 标签页 */}
        <div className="flex justify-center mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-1.5 flex gap-1 flex-wrap justify-center">
            {[
              { key: 'input', label: '数据输入', icon: '📝' },
              { key: 'result', label: '模拟结果', icon: '📊' },
              { key: 'timeline', label: '时间线', icon: '⏱️' },
              { key: 'dynamic', label: '动态演示', icon: '🎬' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 flex items-center gap-2 ${
                  activeTab === tab.key
                    ? 'tab-active'
                    : 'tab-inactive'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 text-red-700 px-6 py-4 rounded-2xl mb-6 shadow-sm animate-slide-up">
            <div className="flex items-center gap-2">
              <span className="text-xl">❌</span>
              <span className="font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* 验证警告 */}
        {validation && !validation.isValid && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 text-amber-800 px-6 py-4 rounded-2xl mb-6 shadow-sm animate-slide-up">
            <div className="font-bold mb-2 flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              数据验证问题
            </div>
            <ul className="list-disc list-inside space-y-1">
              {validation.errors.map((err, i) => (
                <li key={i} className="text-red-600">{err}</li>
              ))}
            </ul>
            {validation.warnings.length > 0 && (
              <>
                <div className="font-bold mt-3 mb-2 flex items-center gap-2">
                  <span>💡</span>
                  警告
                </div>
                <ul className="list-disc list-inside space-y-1">
                  {validation.warnings.map((warn, i) => (
                    <li key={i} className="text-amber-700">{warn}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {/* 数据输入面板 */}
        {activeTab === 'input' && (
          <div className="space-y-6 animate-slide-up">

            {/* 手动输入区 */}
            <div className="card p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <span className="text-2xl">✏️</span> 手动输入数据
              </h2>

              {/* 窗口数量 */}
              <div className="flex items-center gap-4 mb-6">
                <label className="text-sm font-semibold text-gray-700">窗口数量</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setWindowCount(w => Math.max(1, w - 1))}
                    className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 font-bold hover:bg-indigo-200 flex items-center justify-center"
                  >−</button>
                  <span className="w-8 text-center font-bold text-lg text-indigo-700">{windowCount}</span>
                  <button
                    onClick={() => setWindowCount(w => Math.min(8, w + 1))}
                    className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 font-bold hover:bg-indigo-200 flex items-center justify-center"
                  >+</button>
                </div>
                <span className="text-xs text-gray-400">（1–8 个，影响所有模拟方式）</span>
              </div>

              {/* 客户数据表格 */}
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-indigo-200">
                      <th className="px-4 py-2 text-left text-gray-700 font-bold">客户</th>
                      <th className="px-4 py-2 text-left text-gray-700 font-bold">到达时间（分钟）</th>
                      <th className="px-4 py-2 text-left text-gray-700 font-bold">服务时间（分钟）</th>
                      <th className="px-4 py-2 text-left text-gray-700 font-bold">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-indigo-50/30">
                        <td className="px-4 py-2 font-medium text-gray-600">#{i + 1}</td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={c.arrivalTime}
                            onChange={(e) => updateCustomer(i, 'arrivalTime', e.target.value)}
                            className="w-28 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            placeholder="0"
                            min="0"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={c.serviceTime}
                            onChange={(e) => updateCustomer(i, 'serviceTime', e.target.value)}
                            className="w-28 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            placeholder="1"
                            min="1"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <button
                            onClick={() => removeCustomer(i)}
                            disabled={customers.length <= 1}
                            className="text-red-500 hover:text-red-700 disabled:opacity-30 font-bold px-2 py-1 rounded"
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 添加/运行按钮 */}
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={addCustomer}
                  className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all"
                >
                  + 添加客户
                </button>
                <button
                  onClick={runSimulation}
                  disabled={loading}
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-50 shadow-md transition-all"
                >
                  {loading ? '运行中...' : '▶ 开始模拟'}
                </button>
              </div>
            </div>

            {/* 测试数据区 */}
            <div className="card p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">程序测试</h2>
              <p className="text-gray-600 mb-8 text-lg">
                使用三种测试数据验证程序的稳定性（固定4个窗口）
              </p>

            {/* 三个测试按钮 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* 合法数据 */}
              <div className="bg-white rounded-2xl p-6 border-2 border-emerald-400 shadow-lg hover:shadow-xl transition-all">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-emerald-500 rounded-2xl flex items-center justify-center">
                    <span className="text-3xl">✅</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">全部合法数据</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    10个客户，所有数据均合法
                  </p>
                  <button
                    onClick={() => loadTestDataAndRun('valid')}
                    disabled={loading}
                    className="w-full py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 disabled:opacity-50"
                  >
                    {loading ? '运行中...' : '运行测试'}
                  </button>
                </div>
              </div>

              {/* 整体非法数据 */}
              <div className="bg-white rounded-2xl p-6 border-2 border-red-400 shadow-lg hover:shadow-xl transition-all">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-red-500 rounded-2xl flex items-center justify-center">
                    <span className="text-3xl">❌</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">整体非法数据</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    窗口数为0，客户数据为空
                  </p>
                  <button
                    onClick={() => loadTestDataAndRun('invalid_all')}
                    disabled={loading}
                    className="w-full py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 disabled:opacity-50"
                  >
                    {loading ? '运行中...' : '运行测试'}
                  </button>
                </div>
              </div>

              {/* 局部非法数据 */}
              <div className="bg-white rounded-2xl p-6 border-2 border-amber-400 shadow-lg hover:shadow-xl transition-all">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-amber-500 rounded-2xl flex items-center justify-center">
                    <span className="text-3xl">⚠️</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">局部非法数据</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    部分客户数据非法（负数、零值）
                  </p>
                  <button
                    onClick={() => loadTestDataAndRun('invalid_partial')}
                    disabled={loading}
                    className="w-full py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 disabled:opacity-50"
                  >
                    {loading ? '运行中...' : '运行测试'}
                  </button>
                </div>
              </div>
            </div>

            {/* 当前测试数据预览 — 三种测试数据均显示 */}
            {validation && (
              <div className="bg-gray-50 rounded-2xl p-6">
                <h3 className="font-semibold text-gray-700 mb-4">
                  测试数据内容（{customers.length} 个客户）
                </h3>
                {customers.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <div className="text-4xl mb-2">📭</div>
                    <div>测试数据集为空（整体非法：无客户数据）</div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-300">
                          <th className="px-4 py-2 text-left text-gray-800 font-bold">客户</th>
                          <th className="px-4 py-2 text-left text-gray-800 font-bold">到达时间（分钟）</th>
                          <th className="px-4 py-2 text-left text-gray-800 font-bold">服务时间（分钟）</th>
                          <th className="px-4 py-2 text-left text-gray-800 font-bold">状态</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customers.map((c, i) => {
                          const isInvalid = parseFloat(c.arrivalTime) < 0 || parseFloat(c.serviceTime) <= 0;
                          return (
                            <tr key={i} className={`border-b ${isInvalid ? 'bg-red-50' : 'bg-white'}`}>
                              <td className="px-4 py-2 text-gray-800 font-medium">#{i + 1}</td>
                              <td className={`px-4 py-2 ${isInvalid && parseFloat(c.arrivalTime) < 0 ? 'text-red-600 font-bold' : 'text-gray-700'}`}>
                                {c.arrivalTime}
                              </td>
                              <td className={`px-4 py-2 ${isInvalid && parseFloat(c.serviceTime) <= 0 ? 'text-red-600 font-bold' : 'text-gray-700'}`}>
                                {c.serviceTime}
                              </td>
                              <td className="px-4 py-2">
                                {isInvalid ? (
                                  <span className="text-red-600 font-bold">❌ 非法</span>
                                ) : (
                                  <span className="text-green-600 font-bold">✓ 合法</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            </div>

            {/* Section C — 随机生成 */}
            <div className="card p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
                <span className="text-2xl">🎲</span> 随机生成模拟
              </h2>
              <p className="text-gray-600 mb-6">自动生成随机客户数据并立即运行模拟，结果可在「模拟结果」和「动态演示」Tab 查看</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-white rounded-2xl p-6 border-2 border-indigo-300 shadow">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">人流密度</h3>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    每小时客户数: <span className="text-indigo-600 text-xl">{bankConfig.customersPerHour}</span> 人/小时
                  </label>
                  <input
                    type="range" min="10" max="60" step="5"
                    value={bankConfig.customersPerHour}
                    onChange={(e) => setBankConfig({ ...bankConfig, customersPerHour: Number(e.target.value) })}
                    className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1"><span>10 人/小时</span><span>60 人/小时</span></div>
                  <div className="mt-3 rounded-xl bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
                    营业时长固定为 8 小时，预计到达约 <span className="font-bold">{estimatedCustomers}</span> 人
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-6 border-2 border-emerald-300 shadow">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">平均服务时间</h3>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    平均服务时间: <span className="text-emerald-600 text-xl">{bankConfig.avgServiceTime}</span> 分钟
                  </label>
                  <input
                    type="range" min="2" max="15"
                    value={bankConfig.avgServiceTime}
                    onChange={(e) => setBankConfig({ ...bankConfig, avgServiceTime: Number(e.target.value) })}
                    className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1"><span>2分钟</span><span>15分钟</span></div>
                </div>
              </div>
            {/* 真实情况开关面板 */}
            <div className="bg-white rounded-2xl border-2 border-gray-200 shadow">
              <div className="p-4 border-b border-gray-100">
                <h3 className="text-base font-bold text-gray-800">🔧 真实情况模拟参数</h3>
                <p className="text-xs text-gray-500 mt-1">开启后模拟更接近真实银行运营</p>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 午休 */}
                <div className="rounded-xl border border-gray-200 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-gray-700 text-sm">🍱 午休</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={bankConfig.lunchBreakEnabled}
                        onChange={e => setBankConfig({...bankConfig, lunchBreakEnabled: e.target.checked})}
                        className="sr-only peer" />
                      <div className="w-9 h-5 bg-gray-200 peer-checked:bg-indigo-500 rounded-full peer transition-colors"></div>
                      <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform"></div>
                    </label>
                  </div>
                  {bankConfig.lunchBreakEnabled && (
                    <div className="space-y-1 mt-2">
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>开始（开门后）</span>
                        <span className="font-bold text-indigo-600">{bankConfig.lunchStart}分钟</span>
                      </div>
                      <input type="range" min="60" max={lunchStartMax} step="10" value={bankConfig.lunchStart}
                        onChange={e => setBankConfig({...bankConfig, lunchStart: Number(e.target.value)})}
                        className="w-full h-2" />
                      <div className="flex justify-between text-xs text-gray-600 mt-1">
                        <span>时长</span>
                        <span className="font-bold text-indigo-600">{bankConfig.lunchDuration}分钟</span>
                      </div>
                      <input type="range" min="15" max={Math.min(90, lunchDurationMax)} step="5" value={bankConfig.lunchDuration}
                        onChange={e => setBankConfig({...bankConfig, lunchDuration: Number(e.target.value)})}
                        className="w-full h-2" />
                    </div>
                  )}
                </div>
                {/* 轮休 */}
                <div className="rounded-xl border border-gray-200 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-gray-700 text-sm">💤 窗口轮休</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={bankConfig.windowBreakEnabled}
                        onChange={e => setBankConfig({...bankConfig, windowBreakEnabled: e.target.checked})}
                        className="sr-only peer" />
                      <div className="w-9 h-5 bg-gray-200 peer-checked:bg-indigo-500 rounded-full peer transition-colors"></div>
                      <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform"></div>
                    </label>
                  </div>
                  {bankConfig.windowBreakEnabled && (
                    <div className="space-y-1 mt-2">
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>间隔</span>
                        <span className="font-bold text-indigo-600">{bankConfig.windowBreakInterval}分钟</span>
                      </div>
                      <input type="range" min="60" max="240" step="10" value={bankConfig.windowBreakInterval}
                        onChange={e => setBankConfig({...bankConfig, windowBreakInterval: Number(e.target.value)})}
                        className="w-full h-2" />
                      <div className="flex justify-between text-xs text-gray-600 mt-1">
                        <span>时长</span>
                        <span className="font-bold text-indigo-600">{bankConfig.windowBreakDuration}分钟</span>
                      </div>
                      <input type="range" min="5" max="30" step="5" value={bankConfig.windowBreakDuration}
                        onChange={e => setBankConfig({...bankConfig, windowBreakDuration: Number(e.target.value)})}
                        className="w-full h-2" />
                    </div>
                  )}
                </div>
                {/* 上厕所 */}
                <div className="rounded-xl border border-gray-200 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-gray-700 text-sm">🚻 如厕休息</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={bankConfig.toiletBreakEnabled}
                        onChange={e => setBankConfig({...bankConfig, toiletBreakEnabled: e.target.checked})}
                        className="sr-only peer" />
                      <div className="w-9 h-5 bg-gray-200 peer-checked:bg-indigo-500 rounded-full peer transition-colors"></div>
                      <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform"></div>
                    </label>
                  </div>
                  {bankConfig.toiletBreakEnabled && (
                    <div className="space-y-1 mt-2">
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>时长</span>
                        <span className="font-bold text-indigo-600">{bankConfig.toiletBreakDuration}分钟</span>
                      </div>
                      <input type="range" min="3" max="15" step="1" value={bankConfig.toiletBreakDuration}
                        onChange={e => setBankConfig({...bankConfig, toiletBreakDuration: Number(e.target.value)})}
                        className="w-full h-2" />
                    </div>
                  )}
                </div>
              </div>
            </div>
              <button
                onClick={runRealisticSimulation}
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-lg font-bold rounded-xl hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 shadow-lg"
              >
                {loading ? '运行中...' : '🎲 生成随机客户并模拟'}
              </button>
            </div>
          </div>
        )}

        {/* 结果面板 */}
        {activeTab === 'result' && (
          result ? (
          <div className="space-y-6 animate-slide-up">
            {/* 统计概览 */}
            <div className="card p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <span className="text-2xl">📈</span> 统计概览
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="stat-card text-center">
                  <div className="stat-value">{result.statistics.totalCustomers}</div>
                  <div className="text-gray-700 mt-1 font-medium">总客户数</div>
                </div>
                <div className="stat-card text-center" style={{ background: 'linear-gradient(to bottom right, #f0fdf4, #dcfce7)' }}>
                  <div className="text-3xl font-bold text-emerald-600">{formatTime(result.statistics.avgWaitTime)}</div>
                  <div className="text-gray-700 mt-1 font-medium">平均等待时间</div>
                </div>
                <div className="stat-card text-center" style={{ background: 'linear-gradient(to bottom right, #eff6ff, #dbeafe)' }}>
                  <div className="text-3xl font-bold text-blue-600">{formatTime(result.statistics.avgStayTime)}</div>
                  <div className="text-gray-700 mt-1 font-medium">平均逗留时间</div>
                </div>
                <div className="stat-card text-center" style={{ background: 'linear-gradient(to bottom right, #faf5ff, #f3e8ff)' }}>
                  <div className="text-3xl font-bold text-purple-600">{formatTime(result.statistics.totalSimulationTime)}</div>
                  <div className="text-gray-700 mt-1 font-medium">总模拟时间</div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                <div className="bg-gray-50 rounded-xl p-4 text-center hover:bg-gray-100 transition-colors">
                  <div className="text-xl font-bold text-gray-700">{formatTime(result.statistics.avgServiceTime)}</div>
                  <div className="text-gray-700 text-sm font-medium">平均服务时间</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center hover:bg-gray-100 transition-colors">
                  <div className="text-xl font-bold text-gray-700">{formatTime(result.statistics.maxWaitTime)}</div>
                  <div className="text-gray-700 text-sm font-medium">最大等待时间</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center hover:bg-gray-100 transition-colors">
                  <div className="text-xl font-bold text-gray-700">{result.statistics.maxQueueLength}</div>
                  <div className="text-gray-700 text-sm font-medium">最大队列长度</div>
                </div>
              </div>
            </div>

            {/* 窗口状态 */}
            <div className="card p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <span className="text-2xl">🪟</span> 窗口状态
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {result.windows.map((window) => (
                  <div key={window.id} className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-2xl p-5 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-lg font-bold text-gray-700">窗口 {window.id}</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        window.currentCustomer ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {window.currentCustomer ? '服务中' : '空闲'}
                      </span>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-700">已服务客户</span>
                        <span className="font-semibold text-gray-700">
                          {window.totalServed} 人
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-700 font-medium">累计等待时间</span>
                        <span className="font-semibold text-gray-700">{formatTime(window.totalWaitTime)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-700 font-medium">累计服务时间</span>
                        <span className="font-semibold text-gray-700">{formatTime(window.totalServiceTime)}</span>
                      </div>
                      <div className="mt-4">
                        <div className="flex justify-between mb-2">
                          <span className="text-gray-700 text-xs font-medium">窗口利用率</span>
                          <span className="text-xs font-semibold text-indigo-600">
                            {((result.statistics.windowUtilization[window.id - 1] ?? 0) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="progress-bar"
                            style={{ width: `${((result.statistics.windowUtilization[window.id - 1] ?? 0) * 100).toFixed(1)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 客户详情 */}
            <div className="card p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <span className="text-2xl">👥</span> 客户详情
              </h2>
              <div className="overflow-x-auto rounded-2xl border border-gray-200">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="table-header">
                      <th className="px-4 py-3 text-center font-semibold">客户编号</th>
                      <th className="px-4 py-3 text-center font-semibold">到达时间</th>
                      <th className="px-4 py-3 text-center font-semibold">服务时间</th>
                      <th className="px-4 py-3 text-center font-semibold">开始时间</th>
                      <th className="px-4 py-3 text-center font-semibold">离开时间</th>
                      <th className="px-4 py-3 text-center font-semibold">等待时间</th>
                      <th className="px-4 py-3 text-center font-semibold">逗留时间</th>
                      <th className="px-4 py-3 text-center font-semibold">服务窗口</th>
                      <th className="px-4 py-3 text-center font-semibold">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.customers.map((customer) => (
                      <tr key={customer.id} className="table-row border-t border-gray-100">
                        <td className="px-4 py-3 text-center font-medium">{customer.id}</td>
                        <td className="px-4 py-3 text-center">{customer.arrivalTime}</td>
                        <td className="px-4 py-3 text-center">{customer.serviceTime}</td>
                        <td className="px-4 py-3 text-center">{customer.startTime}</td>
                        <td className="px-4 py-3 text-center">{customer.endTime}</td>
                        <td className="px-4 py-3 text-center">{customer.waitTime}</td>
                        <td className="px-4 py-3 text-center font-medium">
                          {customer.status === 'completed'
                            ? customer.endTime - customer.arrivalTime
                            : customer.status === 'serving'
                            ? <span className="text-blue-600">服务中</span>
                            : <span className="text-amber-600">等待中</span>}
                        </td>
                        <td className="px-4 py-3 text-center">窗口{customer.windowId}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            customer.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                            customer.status === 'serving' ? 'bg-blue-100 text-blue-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {customer.status === 'completed' ? '已完成' :
                             customer.status === 'serving' ? '服务中' : '等待中'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 动态窗口可视化 */}
            <div className="card p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="text-2xl">🎬</span> 窗口动态演示
              </h2>
              <P5QueueVisualization
                simulationResult={result}
                isPlaying={resultIsPlaying}
                speed={resultSpeed}
                currentTime={resultCurrentTime}
                onPlayPause={() => setResultIsPlaying(p => !p)}
                onSpeedChange={setResultSpeed}
                onTimeChange={setResultCurrentTime}
              />
            </div>
          </div>
          ) : (
            <div className="card p-16 text-center animate-fade-in">
              <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-3xl flex items-center justify-center">
                <span className="text-5xl">📊</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-700 mb-3">暂无模拟结果</h3>
              <p className="text-gray-700 font-medium text-lg">请先在"数据输入"标签页手动输入数据或选择测试类型并运行模拟</p>
            </div>
          )
        )}

        {/* 时间线面板 */}
        {activeTab === 'timeline' && (
          result ? (
          <div className="card p-8 animate-slide-up">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <span className="text-2xl">⏱️</span> 事件时间线
            </h2>
            <div className="relative pl-8">
              {/* 时间线 */}
              <div className="absolute left-3 top-2 bottom-2 w-1 bg-gradient-to-b from-indigo-300 via-purple-300 to-pink-300 rounded-full" />

              <div className="space-y-4">
                {result.timeline.map((event, index) => (
                  <div key={index} className="relative animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                    {/* 时间点标记 */}
                    <div className={`absolute -left-5 timeline-dot ${
                      event.type === 'arrival' ? 'bg-blue-500 border-blue-300' :
                      event.type === 'start_service' ? 'bg-emerald-500 border-emerald-300' :
                      'bg-rose-500 border-rose-300'
                    }`} />

                    {/* 事件内容 */}
                    <div className={`timeline-card ${
                      event.type === 'arrival' ? 'bg-gradient-to-r from-blue-50 to-indigo-50' :
                      event.type === 'start_service' ? 'bg-gradient-to-r from-emerald-50 to-green-50' :
                      'bg-gradient-to-r from-rose-50 to-red-50'
                    }`}>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-sm bg-white px-3 py-1 rounded-lg shadow-sm font-semibold">
                          T={event.time}
                        </span>
                        <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                          event.type === 'arrival' ? 'bg-blue-200 text-blue-800' :
                          event.type === 'start_service' ? 'bg-emerald-200 text-emerald-800' :
                          'bg-rose-200 text-rose-800'
                        }`}>
                          {event.type === 'arrival' ? '🚶 客户到达' :
                           event.type === 'start_service' ? '▶️ 开始服务' : '✅ 完成服务'}
                        </span>
                      </div>
                      <div className="text-gray-700 font-medium">{event.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          ) : (
            <div className="card p-16 text-center animate-fade-in">
              <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-3xl flex items-center justify-center">
                <span className="text-5xl">⏱️</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-700 mb-3">暂无时间线数据</h3>
              <p className="text-gray-700 font-medium text-lg">请先在"数据输入"标签页手动输入数据或选择测试类型并运行模拟</p>
            </div>
          )
        )}

        {/* 动态演示面板 */}
        {activeTab === 'dynamic' && (
          <div className="card p-8 animate-slide-up">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">动态队列演示</h2>
            <p className="text-gray-600 mb-6 text-lg">
              实时演示客户排队与服务过程 — 可在「数据输入」Tab 触发模拟后查看
            </p>


            {/* 可视化区域 */}
            {result ? (
              <div className="space-y-10">
                <P5QueueVisualization
                  simulationResult={result}
                  isPlaying={resultIsPlaying}
                  speed={resultSpeed}
                  currentTime={resultCurrentTime}
                  onPlayPause={() => setResultIsPlaying(!resultIsPlaying)}
                  onSpeedChange={setResultSpeed}
                  onTimeChange={setResultCurrentTime}
                />
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-700">算法艺术可视化 · 等待的代价</h3>
                    <div className="flex gap-2">
                      {comparisonResults && (
                        <button
                          onClick={() => setComparisonResults(null)}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-300 flex items-center gap-2"
                        >
                          ← 返回普通视图
                        </button>
                      )}
                      <button
                        onClick={runComparison}
                        disabled={comparisonLoading}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                      >
                        {comparisonLoading ? '对比中…' : '📊 对比三种调度算法'}
                      </button>
                    </div>
                  </div>
                  <AlgorithmicArt
                    statistics={{
                      totalCustomers: result.statistics.totalCustomers,
                      avgWaitTime: result.statistics.avgWaitTime,
                      totalSimulationTime: result.statistics.totalSimulationTime,
                    }}
                    windows={result.windows.map(w => ({
                      id: w.id,
                      totalServed: w.totalServed,
                      totalServiceTime: w.totalServiceTime,
                      idleTime: w.idleTime,
                    }))}
                    customers={result.customers.map(c => ({
                      id: c.id,
                      arrivalTime: c.arrivalTime,
                      waitTime: c.waitTime,
                      serviceTime: c.serviceTime,
                      windowId: c.windowId,
                      endTime: c.endTime,
                    }))}
                    comparisonResults={comparisonResults ?? undefined}
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-gray-400">
                <div className="text-6xl mb-4">🎬</div>
                <p className="text-lg font-medium">请先运行一次模拟（数据输入 Tab 或随机生成）</p>
              </div>
            )}
          </div>
        )}

        {/* 设计说明 */}
        <div className="mt-10 card p-8 animate-fade-in">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <span className="text-2xl">📖</span> 设计说明
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6">
              <h3 className="font-semibold text-gray-700 mb-4 text-lg flex items-center gap-2">
                <span className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white text-sm">📦</span>
                数据结构设计
              </h3>
              <ul className="text-gray-600 space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-indigo-500 mt-0.5">•</span>
                  <span><strong className="text-gray-700">Customer（客户）</strong>：存储客户编号、到达时间、服务时间、开始时间、离开时间、等待时间、状态</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-500 mt-0.5">•</span>
                  <span><strong className="text-gray-700">Window（窗口）</strong>：每个窗口维护一个客户队列，记录当前服务客户、已服务数量、累计时间</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-500 mt-0.5">•</span>
                  <span><strong className="text-gray-700">Event（事件）</strong>：事件驱动模拟，包含到达事件和离开事件</span>
                </li>
              </ul>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-6">
              <h3 className="font-semibold text-gray-700 mb-4 text-lg flex items-center gap-2">
                <span className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white text-sm">⚙️</span>
                算法设计
              </h3>
              <ul className="text-gray-600 space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">•</span>
                  <span><strong className="text-gray-700">窗口分配策略</strong>：优先分配空闲窗口，否则选择最短队列</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">•</span>
                  <span><strong className="text-gray-700">事件驱动模拟</strong>：按时间顺序处理客户到达和离开事件</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">•</span>
                  <span><strong className="text-gray-700">逗留时间计算</strong>：离开时间 - 到达时间</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* 页脚 */}
        <div className="text-center mt-10 text-gray-700 font-medium text-sm">
          <div className="inline-flex items-center gap-2 bg-white/50 backdrop-blur-sm px-6 py-3 rounded-full">
            <span>🏦</span>
            <span>银行业务活动模拟系统</span>
            <span className="text-gray-500">|</span>
            <span>数据结构课程研讨项目</span>
          </div>
        </div>
      </div>
    </div>
  );
}
