'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { formatTime } from '@/lib/bank-simulation';

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

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface CustomerInput {
  arrivalTime: string;
  serviceTime: string;
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
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'input' | 'result' | 'timeline' | 'dynamic'>('input');
  const [error, setError] = useState<string | null>(null);

  // 随机模拟配置
  const [bankConfig, setBankConfig] = useState({
    closeTime: 50, // 模拟客户数量
    avgServiceTime: 5 // 平均服务时间
  });

  // 动态可视化状态（统一，所有模拟方式共用）
  const [resultIsPlaying, setResultIsPlaying] = useState(false);
  const [resultCurrentTime, setResultCurrentTime] = useState(0);
  const [resultSpeed, setResultSpeed] = useState(1);

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
        setLoading(false);
        return;
      }

      // 更新界面数据
      setCustomers(testData.testData.customers.map((c: { arrivalTime: number; serviceTime: number }) => ({
        arrivalTime: c.arrivalTime.toString(),
        serviceTime: c.serviceTime.toString(),
      })));
      setValidation(testData.validation);

      // 2. 如果数据合法，自动运行模拟
      if (testData.validation.isValid) {
        const simResponse = await fetch('/api/simulation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'simulate',
            data: {
              windowCount: 4,
              customers: testData.testData.customers,
            },
          }),
        });
        const simData = await simResponse.json();

        if (simData.success) {
          setResult(simData.result);
          setResultCurrentTime(0);
          setResultIsPlaying(false);
          setActiveTab('result');
        } else {
          setError(simData.error || '模拟失败');
        }
      }
    } catch {
      setError('运行失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 运行模拟
  const runSimulation = useCallback(async () => {
    setLoading(true);
    setError(null);
    setValidation(null);

    try {
      const customerData = customers.map(c => ({
        arrivalTime: parseFloat(c.arrivalTime) || 0,
        serviceTime: parseFloat(c.serviceTime) || 0,
      }));

      const response = await fetch('/api/simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'simulate',
          data: {
            windowCount: 4,
            customers: customerData,
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.result);
        setResultCurrentTime(0);
        setResultIsPlaying(false);
        setValidation(data.validation);
        setActiveTab('result');
      } else {
        setValidation(data.validation);
        setError(data.error || '模拟失败');
      }
    } catch {
      setError('运行模拟失败，请检查输入数据');
    } finally {
      setLoading(false);
    }
  }, [customers]);

  // 清空数据
  const clearData = useCallback(() => {
    setCustomers([{ arrivalTime: '', serviceTime: '' }]);
    setResult(null);
    setValidation(null);
    setError(null);
    setActiveTab('input');
  }, []);

  // 运行随机客户模拟
  const runRealisticSimulation = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 生成随机客户数据
      const customerCount = bankConfig.closeTime;
      const avgServiceTime = bankConfig.avgServiceTime;

      // 随机生成客户到达时间和服务时间
      const randomCustomers = [];
      let currentTime = 0;
      for (let i = 0; i < customerCount; i++) {
        // 随机到达间隔 (0-5分钟)
        const arrivalInterval = Math.random() * 5;
        currentTime += arrivalInterval;
        // 随机服务时间 (avgServiceTime的50%-150%)
        const serviceTime = Math.max(1, Math.round(avgServiceTime * (0.5 + Math.random())));
        randomCustomers.push({
          arrivalTime: Math.round(currentTime * 10) / 10,
          serviceTime
        });
      }

      const response = await fetch('/api/simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'simulate',
          data: {
            windowCount: 4, // 固定4个窗口
            customers: randomCustomers
          }
        })
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.result);
        setResultCurrentTime(0);
        setResultIsPlaying(false);
        setActiveTab('dynamic');
      } else {
        setError(data.error || '模拟失败');
      }
    } catch {
      setError('运行模拟失败');
    } finally {
      setLoading(false);
    }
  }, [bankConfig]);

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
                  <h3 className="text-lg font-bold text-gray-800 mb-4">客户数量</h3>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    模拟客户数: <span className="text-indigo-600 text-xl">{bankConfig.closeTime}</span> 人
                  </label>
                  <input
                    type="range" min="10" max="200" step="10"
                    value={bankConfig.closeTime}
                    onChange={(e) => setBankConfig({ ...bankConfig, closeTime: Number(e.target.value) })}
                    className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1"><span>10人</span><span>200人</span></div>
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
                        <span className="font-semibold text-gray-700">{window.totalServed} 人</span>
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
              <DynamicQueueVisualization
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
              <DynamicQueueVisualization
                simulationResult={result}
                isPlaying={resultIsPlaying}
                speed={resultSpeed}
                currentTime={resultCurrentTime}
                onPlayPause={() => setResultIsPlaying(!resultIsPlaying)}
                onSpeedChange={setResultSpeed}
                onTimeChange={setResultCurrentTime}
              />
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

// 动态队列可视化组件
interface DynamicQueueVisualizationProps {
  simulationResult: SimulationResult;
  isPlaying: boolean;
  speed: number;
  currentTime: number;
  onPlayPause: () => void;
  onSpeedChange: (speed: number) => void;
  onTimeChange: (time: number) => void;
}

function DynamicQueueVisualization({
  simulationResult,
  isPlaying,
  speed,
  currentTime,
  onPlayPause,
  onSpeedChange,
  onTimeChange,
}: DynamicQueueVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const currentTimeRef = useRef<number>(currentTime);

  // 同步 currentTime 到 ref，供动画loop读取
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  // 动画循环 — 依赖不含 currentTime，避免每帧重建
  useEffect(() => {
    if (!isPlaying) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      lastTimeRef.current = 0;
      return;
    }

    const totalDuration = simulationResult.statistics.totalSimulationTime;

    const animate = (timestamp: number) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = timestamp;
      }

      const deltaTime = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      const newTime = currentTimeRef.current + (deltaTime * speed) / 1000;

      if (newTime >= totalDuration) {
        onTimeChange(totalDuration);
        onPlayPause();
        return;
      }

      onTimeChange(newTime);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, speed, simulationResult.statistics.totalSimulationTime, onPlayPause, onTimeChange]);

  // 绘制可视化
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 清空画布
    ctx.clearRect(0, 0, width, height);

    // 绘制背景
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    // 计算当前时刻的状态
    const time = currentTime;
    const windows = simulationResult.windows.map(w => {
      // 找出当前正在服务的客户
      const currentCustomer = simulationResult.customers.find(
        c => c.windowId === w.id && c.startTime <= time && c.endTime > time
      );

      // 找出在队列中等待的客户
      const queueCustomers = simulationResult.customers.filter(
        c => c.windowId === w.id && c.arrivalTime <= time && c.startTime > time
      ).sort((a, b) => a.arrivalTime - b.arrivalTime);

      return {
        ...w,
        currentCustomer: currentCustomer || null,
        queue: queueCustomers,
      };
    });

    // 绘制窗口
    const windowCount = windows.length;
    const windowWidth = 90;
    const windowHeight = 110;
    const windowSpacing = (width - windowCount * windowWidth) / (windowCount + 1);

    windows.forEach((windowData, index) => {
      const x = windowSpacing + index * (windowWidth + windowSpacing);
      const y = height - windowHeight - 40;

      // 绘制窗口框
      const gradient = ctx.createLinearGradient(x, y, x, y + windowHeight);
      if (windowData.currentCustomer) {
        gradient.addColorStop(0, '#6366f1');
        gradient.addColorStop(1, '#4f46e5');
      } else {
        gradient.addColorStop(0, '#94a3b8');
        gradient.addColorStop(1, '#64748b');
      }
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, y, windowWidth, windowHeight, 12);
      ctx.fill();

      // 绘制窗口标签
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`窗口${windowData.id}`, x + windowWidth / 2, y + 25);

      // 绘制当前客户
      if (windowData.currentCustomer) {
        drawCustomer(ctx, x + windowWidth / 2, y + 60, '#10b981');
        ctx.fillStyle = '#ffffff';
        ctx.font = '11px sans-serif';
        ctx.fillText(`客户${windowData.currentCustomer.id}`, x + windowWidth / 2, y + 90);
      } else {
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '12px sans-serif';
        ctx.fillText('空闲', x + windowWidth / 2, y + 60);
      }

      // 绘制等待队列（向上垂直延伸）
      const queueCenterX = x + windowWidth / 2;
      const queueRadius = 9;
      const queueSpacing = 20;
      windowData.queue.slice(0, 8).forEach((customer, queueIndex) => {
        const queueX = queueCenterX;
        const queueY = y - 15 - queueIndex * queueSpacing;
        drawCustomer(ctx, queueX, queueY, '#f59e0b', queueRadius);
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${customer.id}`, queueX, queueY + 3);
      });

      // 显示队列溢出数量
      if (windowData.queue.length > 8) {
        const overflowY = y - 15 - 8 * queueSpacing - 8;
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`+${windowData.queue.length - 8}`, queueCenterX, overflowY);
      }
    });

    // 绘制时间进度条
    const progress = simulationResult.statistics.totalSimulationTime > 0
      ? currentTime / simulationResult.statistics.totalSimulationTime
      : 0;
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.roundRect(20, 15, width - 40, 10, 5);
    ctx.fill();

    const progressGradient = ctx.createLinearGradient(20, 0, 20 + (width - 40) * progress, 0);
    progressGradient.addColorStop(0, '#6366f1');
    progressGradient.addColorStop(1, '#8b5cf6');
    ctx.fillStyle = progressGradient;
    ctx.beginPath();
    ctx.roundRect(20, 15, (width - 40) * progress, 10, 5);
    ctx.fill();

    // 绘制时间文本
    const hour = Math.floor((time + 540) / 60);
    const minute = Math.floor((time + 540) % 60);
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`时间: ${hour}:${String(minute).padStart(2, '0')}`, 20, 45);

    // 绘制统计信息
    const activeCustomers = simulationResult.customers.filter(
      c => c.arrivalTime <= time && c.endTime > time
    ).length;
    const completedCustomers = simulationResult.customers.filter(
      c => c.endTime <= time
    ).length;

    ctx.textAlign = 'right';
    ctx.fillText(`在场: ${activeCustomers}人`, width - 20, 45);
    ctx.fillText(`已完成: ${completedCustomers}人`, width - 20, 65);

  }, [currentTime, simulationResult]);

  // 绘制客户图标
  const drawCustomer = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string, radius = 14) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    // 添加高光
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(x - radius * 0.3, y - radius * 0.3, radius * 0.43, 0, Math.PI * 2);
    ctx.fill();
  };

  const totalDuration = simulationResult.statistics.totalSimulationTime;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h3 className="text-lg font-semibold text-gray-700">队列动态可视化</h3>
        <div className="flex items-center gap-4">
          <label className="text-sm text-gray-600">
            速度: {speed}x
          </label>
          <input
            type="range"
            min="0.5"
            max="5"
            step="0.5"
            value={speed}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
            className="w-24"
          />
          <button
            onClick={onPlayPause}
            className="btn-secondary text-sm"
          >
            {isPlaying ? '⏸ 暂停' : '▶ 播放'}
          </button>
          <button
            onClick={() => onTimeChange(0)}
            className="btn-secondary text-sm"
            disabled={currentTime === 0}
          >
            ⏮ 重置
          </button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={900}
        height={500}
        className="w-full bg-white rounded-2xl border border-gray-200 shadow-inner"
      />

      <div className="flex justify-center gap-6 text-sm flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-emerald-500"></div>
          <span>服务中</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-amber-500"></div>
          <span>等待中</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-slate-400"></div>
          <span>空闲窗口</span>
        </div>
      </div>

      {/* 统计信息 */}
      {simulationResult && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="stat-card text-center">
            <div className="stat-value">{simulationResult.statistics.totalCustomers}</div>
            <div className="text-gray-700 text-sm mt-1 font-medium">总客户数</div>
          </div>
          <div className="stat-card text-center">
            <div className="text-3xl font-bold text-emerald-600">{formatTime(simulationResult.statistics.avgWaitTime)}</div>
            <div className="text-gray-700 text-sm mt-1 font-medium">平均等待</div>
          </div>
          <div className="stat-card text-center">
            <div className="text-3xl font-bold text-blue-600">{formatTime(simulationResult.statistics.avgStayTime)}</div>
            <div className="text-gray-700 text-sm mt-1 font-medium">平均逗留</div>
          </div>
          <div className="stat-card text-center">
            <div className="text-3xl font-bold text-purple-600">{simulationResult.statistics.maxQueueLength}</div>
            <div className="text-gray-700 text-sm mt-1 font-medium">最大队列</div>
          </div>
        </div>
      )}
    </div>
  );
}
