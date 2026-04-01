/**
 * 银行业务活动模拟系统 - 核心逻辑
 * 
 * 数据结构设计：
 * 1. Customer（客户）: 存储客户信息，包括到达时间、业务办理时间、开始服务时间、离开时间
 * 2. Window（窗口）: 每个窗口维护一个客户队列，记录当前服务的客户和等待队列
 * 3. BankSimulation（银行模拟）: 管理所有窗口，处理客户到达和离开事件
 * 
 * 算法设计：
 * 1. 事件驱动模拟：使用事件队列处理客户到达和离开事件
 * 2. 窗口分配策略：优先分配空闲窗口，否则选择最短队列
 * 3. 时间推进：按事件时间顺序处理，更新系统状态
 */

// 客户接口
export interface Customer {
  id: number;                    // 客户编号
  arrivalTime: number;           // 到达时间（分钟）
  serviceTime: number;           // 业务办理时间（分钟）
  startTime: number;             // 开始服务时间（分钟）
  endTime: number;               // 离开时间（分钟）
  windowId: number;              // 服务窗口编号（-1表示未分配）
  waitTime: number;              // 等待时间（分钟）
  status: 'waiting' | 'serving' | 'completed';  // 客户状态
}

// 窗口接口
export interface Window {
  id: number;                    // 窗口编号
  queue: Customer[];             // 等待队列
  currentCustomer: Customer | null;  // 当前服务的客户
  totalServed: number;           // 已服务客户数
  totalWaitTime: number;         // 累计等待时间
  totalServiceTime: number;      // 累计服务时间
  idleTime: number;              // 空闲时间
  isOnBreak: boolean;            // 是否正在休息
  breakEndTime: number;          // 休息结束时间
  breakType: 'none' | 'lunch' | 'window' | 'toilet'; // 休息类型
  nextWindowBreakTime: number;   // 下次轮休时间
  nextToiletBreakTime: number;   // 下次上厕所时间
}

// 事件类型
export type EventType = 'arrival' | 'departure' | 'break_end';

// 事件接口
export interface Event {
  type: EventType;
  time: number;
  customer: Customer;
  windowId?: number;
}

// 模拟结果接口
export interface SimulationResult {
  customers: Customer[];          // 所有客户记录
  windows: Window[];              // 最终窗口状态
  statistics: {
    totalCustomers: number;       // 总客户数
    avgWaitTime: number;          // 平均等待时间
    avgStayTime: number;          // 平均逗留时间
    avgServiceTime: number;       // 平均服务时间
    maxWaitTime: number;          // 最大等待时间
    maxQueueLength: number;       // 最大队列长度
    totalSimulationTime: number;  // 总模拟时间
    windowUtilization: number[];  // 各窗口利用率
  };
  timeline: TimelineEvent[];      // 时间线事件记录
}

// 时间线事件
export interface TimelineEvent {
  time: number;
  type: 'arrival' | 'start_service' | 'end_service';
  customerId: number;
  windowId?: number;
  description: string;
}

// 输入数据接口
export interface SimulationInput {
  windowCount: number;           // 窗口数量
  customers: Array<{
    arrivalTime: number;
    serviceTime: number;
  }>;
}

// 验证结果接口
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 银行模拟类
 */
export class BankSimulation {
  protected windows: Window[] = [];
  protected events: Event[] = [];
  protected currentTime: number = 0;
  protected customers: Customer[] = [];
  protected timeline: TimelineEvent[] = [];
  protected maxQueueLength: number = 0;
  protected customerIdCounter: number = 1;

  constructor(windowCount: number = 4) {
    // 初始化窗口
    for (let i = 0; i < windowCount; i++) {
      this.windows.push({
        id: i + 1,
        queue: [],
        currentCustomer: null,
        totalServed: 0,
        totalWaitTime: 0,
        totalServiceTime: 0,
        idleTime: 0,
        isOnBreak: false,
        breakEndTime: 0,
        breakType: 'none',
        nextWindowBreakTime: Infinity,
        nextToiletBreakTime: Infinity,
      });
    }
  }

  /**
   * 添加客户到达事件
   */
  addCustomer(arrivalTime: number, serviceTime: number): void {
    const customer: Customer = {
      id: this.customerIdCounter++,
      arrivalTime,
      serviceTime,
      startTime: -1,
      endTime: -1,
      windowId: -1,
      waitTime: 0,
      status: 'waiting'
    };

    this.customers.push(customer);
    this.events.push({
      type: 'arrival',
      time: arrivalTime,
      customer
    });
  }

  /**
   * 获取空闲窗口
   */
  protected getIdleWindow(): Window | null {
    return this.windows.find(w => w.currentCustomer === null) || null;
  }

  /**
   * 获取最短队列窗口（按队列人数）
   */
  protected getShortestQueueWindow(): Window {
    if (this.windows.length === 0) throw new Error('没有可用的窗口');
    let shortest = this.windows[0];
    for (const w of this.windows) {
      if (w.queue.length < shortest.queue.length) shortest = w;
    }
    return shortest;
  }

  /**
   * 直接服务客户（窗口空闲时）
   */
  protected serveCustomerAt(customer: Customer, window: Window): void {
    customer.windowId = window.id;
    customer.startTime = this.currentTime;
    customer.endTime = this.currentTime + customer.serviceTime;
    customer.waitTime = 0;
    customer.status = 'serving';
    window.currentCustomer = customer;
    this.events.push({ type: 'departure', time: customer.endTime, customer, windowId: window.id });
    this.timeline.push({
      time: this.currentTime, type: 'start_service',
      customerId: customer.id, windowId: window.id,
      description: `客户${customer.id}在窗口${window.id}开始办理业务`
    });
  }

  /**
   * 将客户加入等待队列
   */
  protected enqueueCustomerAt(customer: Customer, window: Window): void {
    customer.windowId = window.id;
    customer.status = 'waiting';
    window.queue.push(customer);
    const currentMax = Math.max(...this.windows.map(w => w.queue.length));
    if (currentMax > this.maxQueueLength) this.maxQueueLength = currentMax;
    this.timeline.push({
      time: this.currentTime, type: 'arrival',
      customerId: customer.id, windowId: window.id,
      description: `客户${customer.id}加入窗口${window.id}的等待队列`
    });
  }

  /**
   * 分配客户到窗口（SQF策略：空闲优先，否则最短队列）
   */
  protected assignCustomerToWindow(customer: Customer): void {
    const idleWindow = this.getIdleWindow();
    if (idleWindow) {
      this.serveCustomerAt(customer, idleWindow);
    } else {
      this.enqueueCustomerAt(customer, this.getShortestQueueWindow());
    }
  }

  /**
   * 处理客户离开事件
   */
  private processDeparture(windowId: number): void {
    const window = this.windows.find(w => w.id === windowId);
    if (!window || !window.currentCustomer) return;

    const customer = window.currentCustomer;
    customer.status = 'completed';

    // 更新窗口统计
    window.totalServed++;
    window.totalWaitTime += customer.waitTime;
    window.totalServiceTime += customer.serviceTime;

    // 记录时间线
    this.timeline.push({
      time: this.currentTime,
      type: 'end_service',
      customerId: customer.id,
      windowId: window.id,
      description: `客户${customer.id}在窗口${window.id}完成业务办理，逗留${customer.endTime - customer.arrivalTime}分钟`
    });

    // 处理队列中的下一个客户
    if (window.queue.length > 0) {
      const nextCustomer = window.queue.shift()!;
      nextCustomer.startTime = this.currentTime;
      nextCustomer.endTime = this.currentTime + nextCustomer.serviceTime;
      nextCustomer.waitTime = this.currentTime - nextCustomer.arrivalTime;
      nextCustomer.status = 'serving';
      
      window.currentCustomer = nextCustomer;

      // 添加离开事件
      this.events.push({
        type: 'departure',
        time: nextCustomer.endTime,
        customer: nextCustomer,
        windowId: window.id
      });

      // 记录时间线
      this.timeline.push({
        time: this.currentTime,
        type: 'start_service',
        customerId: nextCustomer.id,
        windowId: window.id,
        description: `客户${nextCustomer.id}在窗口${window.id}开始办理业务，等待了${nextCustomer.waitTime}分钟`
      });
    } else {
      window.currentCustomer = null;
    }
  }

  /**
   * 运行模拟
   */
  run(): SimulationResult {
    while (this.events.length > 0) {
      this.events.sort((a, b) => a.time - b.time);
      const event = this.events.shift()!;
      this.currentTime = event.time;

      if (event.type === 'arrival') {
        this.assignCustomerToWindow(event.customer);
      } else if (event.type === 'departure' && event.windowId) {
        this.processDeparture(event.windowId);
      }
    }

    // 计算统计数据
    const completedCustomers = this.customers.filter(c => c.status === 'completed');
    const totalWaitTime = completedCustomers.reduce((sum, c) => sum + c.waitTime, 0);
    const totalStayTime = completedCustomers.reduce((sum, c) => sum + (c.endTime - c.arrivalTime), 0);
    const totalServiceTime = completedCustomers.reduce((sum, c) => sum + c.serviceTime, 0);

    // 安全计算最大值，避免空数组问题
    const maxWaitTime = completedCustomers.length > 0
      ? Math.max(...completedCustomers.map(c => c.waitTime))
      : 0;
    const totalSimulationTime = completedCustomers.length > 0
      ? Math.max(...completedCustomers.map(c => c.endTime))
      : 0;

    // 计算各窗口空闲时间和利用率
    this.windows.forEach(w => {
      w.idleTime = Math.max(0, totalSimulationTime - w.totalServiceTime);
    });
    const windowUtilization = this.windows.map(w => {
      if (totalSimulationTime === 0) return 0;
      return Math.min(w.totalServiceTime / totalSimulationTime, 1);
    });

    return {
      customers: this.customers,
      windows: this.windows,
      statistics: {
        totalCustomers: this.customers.length,
        avgWaitTime: completedCustomers.length > 0 ? totalWaitTime / completedCustomers.length : 0,
        avgStayTime: completedCustomers.length > 0 ? totalStayTime / completedCustomers.length : 0,
        avgServiceTime: completedCustomers.length > 0 ? totalServiceTime / completedCustomers.length : 0,
        maxWaitTime,
        maxQueueLength: this.maxQueueLength,
        totalSimulationTime,
        windowUtilization
      },
      timeline: this.timeline.sort((a, b) => a.time - b.time)
    };
  }

  /**
   * 获取当前窗口状态（用于动态显示）
   */
  getWindowStatus(): Window[] {
    return this.windows.map(w => ({
      ...w,
      queue: [...w.queue],
      currentCustomer: w.currentCustomer ? { ...w.currentCustomer } : null
    }));
  }
}

/**
 * 验证输入数据
 */
export function validateInput(input: SimulationInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 验证窗口数量
  if (input.windowCount < 1) {
    errors.push('窗口数量必须大于0');
  }
  if (input.windowCount > 10) {
    warnings.push('窗口数量超过10个，可能影响显示效果');
  }

  // 验证客户数据
  if (!input.customers || input.customers.length === 0) {
    errors.push('客户数据不能为空');
  }

  let prevArrivalTime = -1;
  for (let i = 0; i < input.customers.length; i++) {
    const customer = input.customers[i];

    // 验证到达时间
    if (typeof customer.arrivalTime !== 'number' || isNaN(customer.arrivalTime)) {
      errors.push(`第${i + 1}个客户的到达时间无效`);
    } else if (customer.arrivalTime < 0) {
      errors.push(`第${i + 1}个客户的到达时间不能为负数`);
    } else if (customer.arrivalTime < prevArrivalTime) {
      warnings.push(`第${i + 1}个客户的到达时间早于前一个客户，建议按时间顺序输入`);
    }
    prevArrivalTime = customer.arrivalTime;

    // 验证服务时间
    if (typeof customer.serviceTime !== 'number' || isNaN(customer.serviceTime)) {
      errors.push(`第${i + 1}个客户的服务时间无效`);
    } else if (customer.serviceTime <= 0) {
      errors.push(`第${i + 1}个客户的服务时间必须大于0`);
    } else if (customer.serviceTime > 120) {
      warnings.push(`第${i + 1}个客户的服务时间超过120分钟，可能不合理`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * 生成测试数据
 */
export function generateTestData(type: 'valid' | 'invalid_all' | 'invalid_partial'): SimulationInput {
  switch (type) {
    case 'valid':
      // 全部合法数据
      return {
        windowCount: 4,
        customers: [
          { arrivalTime: 0, serviceTime: 5 },
          { arrivalTime: 1, serviceTime: 8 },
          { arrivalTime: 2, serviceTime: 3 },
          { arrivalTime: 3, serviceTime: 6 },
          { arrivalTime: 5, serviceTime: 4 },
          { arrivalTime: 7, serviceTime: 7 },
          { arrivalTime: 8, serviceTime: 2 },
          { arrivalTime: 10, serviceTime: 5 },
          { arrivalTime: 12, serviceTime: 6 },
          { arrivalTime: 15, serviceTime: 3 }
        ]
      };

    case 'invalid_all':
      // 整体非法数据
      return {
        windowCount: 0,
        customers: []
      };

    case 'invalid_partial':
      // 局部非法数据
      return {
        windowCount: 4,
        customers: [
          { arrivalTime: 0, serviceTime: 5 },
          { arrivalTime: -1, serviceTime: 8 },      // 非法到达时间
          { arrivalTime: 2, serviceTime: -3 },      // 非法服务时间
          { arrivalTime: 3, serviceTime: 6 },
          { arrivalTime: 5, serviceTime: 0 },       // 非法服务时间
          { arrivalTime: 7, serviceTime: 7 }
        ]
      };
  }
}

/**
 * 格式化时间（分钟转时分格式）
 */
export function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  if (hours > 0) {
    return `${hours}小时${mins}分钟`;
  }
  return `${mins}分钟`;
}

// ============================================
// 真实场景模拟 - 新增接口和类
// ============================================

/**
 * 银行运营配置接口
 */
export interface BankConfig {
  // 基础配置
  baseWindowCount: number;           // 基础窗口数量 (默认4)
  maxWindowCount: number;             // 最大窗口数量 (默认8)
  elasticThreshold: number;           // 弹性扩展队列阈值 (默认5人)

  // 营业时间
  openTime: number;                   // 开门时间 (分钟，0=9:00)
  closeTime: number;                  // 关门时间 (分钟，480=17:00)

  // 午休配置
  lunchBreakEnabled: boolean;         // 是否启用午休
  lunchStart: number;                 // 午休开始时间 (分钟)
  lunchDuration: number;              // 午休时长 (分钟)

  // 客户流量配置
  baseArrivalRate: number;            // 基础到达率 (人/分钟)
  peakHoursMultiplier: number;        // 高峰时段倍数
  peakHoursStart: number;             // 高峰开始时间
  peakHoursEnd: number;               // 高峰结束时间

  // 服务时间配置
  avgServiceTime: number;             // 平均服务时间 (分钟)
  serviceTimeStdDev: number;          // 服务时间标准差

  // 养老金日配置
  isPensionDay: boolean;              // 是否为养老金日
  pensionDayMultiplier: number;       // 养老金日流量倍数
  elderlyRatio: number;               // 老年客户比例 (0-1)

  // 窗口轮休配置
  windowBreakEnabled: boolean;        // 是否启用窗口轮休
  windowBreakInterval: number;        // 轮休间隔（分钟，默认120）
  windowBreakDuration: number;        // 轮休时长（分钟，默认10）

  // 上厕所配置
  toiletBreakEnabled: boolean;        // 是否启用上厕所
  toiletBreakProbability: number;     // 每小时触发概率（默认0.3）
  toiletBreakDuration: number;        // 上厕所时长（分钟，默认5）

  // 随机种子 (用于可重现结果)
  seed?: number;
}

/**
 * 时段流量配置
 */
export interface HourlyTrafficPattern {
  hour: number;                       // 小时 (0-23)
  trafficMultiplier: number;          // 流量倍数
}

/**
 * 模拟快照接口
 */
export interface SimulationSnapshot {
  time: number;
  windows: Window[];
  totalCustomers: number;
  completedCustomers: number;
}

/**
 * 带种子的随机数生成器 (LCG - 线性同余生成器)
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number = Date.now()) {
    this.seed = seed;
  }

  /**
   * 生成 [0, 1) 之间的随机数
   */
  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  /**
   * 生成正态分布随机数 (Box-Muller 变换)
   */
  nextNormal(mean: number, stdDev: number): number {
    const u1 = this.next();
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z * stdDev + mean;
  }

  /**
   * 生成泊松分布的到达间隔 (指数分布)
   */
  nextPoissonInterval(rate: number): number {
    return -Math.log(1 - this.next()) / rate;
  }
}

/**
 * 真实场景银行模拟类
 * 支持泊松到达过程、正态分布服务时间、弹性窗口、养老金日等特性
 */
export class RealisticBankSimulation {
  private config: BankConfig;
  private rng: SeededRandom;
  private windows: Window[] = [];
  private customers: Customer[] = [];
  private events: Event[] = [];
  private timeline: TimelineEvent[] = [];
  private currentTime: number = 0;
  private customerIdCounter: number = 1;
  private activeWindowCount: number = 0;
  private hourlyTraffic: HourlyTrafficPattern[] = [];
  private maxQueueLength: number = 0;

  constructor(config: BankConfig) {
    this.config = config;
    this.rng = new SeededRandom(config.seed ?? Date.now());
    this.activeWindowCount = config.baseWindowCount;
    this.initializeWindows();
    this.initializeTrafficPattern();
  }

  /**
   * 初始化窗口
   */
  private initializeWindows(): void {
    for (let i = 0; i < this.config.baseWindowCount; i++) {
      // 错开各窗口的轮休时间，避免同时休息
      const staggerOffset = i * (this.config.windowBreakInterval / this.config.baseWindowCount);
      this.windows.push({
        id: i + 1,
        queue: [],
        currentCustomer: null,
        totalServed: 0,
        totalWaitTime: 0,
        totalServiceTime: 0,
        idleTime: 0,
        isOnBreak: false,
        breakEndTime: 0,
        breakType: 'none',
        nextWindowBreakTime: this.config.openTime + staggerOffset + this.config.windowBreakInterval,
        nextToiletBreakTime: this.config.openTime + this.rng.next() * 60,
      });
    }
  }

  /**
   * 初始化默认时段流量模式 (基于真实银行客流规律)
   */
  private initializeTrafficPattern(): void {
    // 银行典型流量模式：
    // - 开门时较高 (9-10点)
    // - 午前高峰 (10-11点)
    // - 午休低谷 (12-14点)
    // - 午后高峰 (14-16点)
    // - 关门前回落
    this.hourlyTraffic = [
      { hour: 9, trafficMultiplier: 1.2 },
      { hour: 10, trafficMultiplier: 1.5 },
      { hour: 11, trafficMultiplier: 1.3 },
      { hour: 12, trafficMultiplier: 0.6 },  // 午休
      { hour: 13, trafficMultiplier: 0.7 },
      { hour: 14, trafficMultiplier: 1.4 },
      { hour: 15, trafficMultiplier: 1.6 },
      { hour: 16, trafficMultiplier: 1.2 },
      { hour: 17, trafficMultiplier: 0.5 },
    ];
  }

  /**
   * 获取当前时段流量倍数
   */
  private getCurrentTrafficMultiplier(): number {
    // 将模拟时间转换为小时 (加上9点作为基准)
    const hour = Math.floor((this.currentTime + this.config.openTime) / 60) + 9;
    const pattern = this.hourlyTraffic.find(p => p.hour === hour);
    return pattern?.trafficMultiplier ?? 1.0;
  }

  /**
   * 生成客户到达 (使用泊松过程)
   */
  private generateArrivals(): void {
    let time = this.config.openTime;

    while (time < this.config.closeTime) {
      // 获取当前时段流量倍数
      const trafficMult = this.getCurrentTrafficMultiplier();

      // 养老金日倍数
      const pensionMult = this.config.isPensionDay ? this.config.pensionDayMultiplier : 1.0;

      // 计算实际到达率
      const actualRate = this.config.baseArrivalRate * trafficMult * pensionMult;

      // 避免除以零
      if (actualRate <= 0) {
        time += 1;
        continue;
      }

      // 生成到达间隔 (指数分布)
      const interval = this.rng.nextPoissonInterval(actualRate);
      time += interval;

      if (time >= this.config.closeTime) break;

      // 跳过午休时段的到达
      if (this.config.lunchBreakEnabled) {
        const lunchEnd = this.config.lunchStart + this.config.lunchDuration;
        if (time >= this.config.lunchStart && time < lunchEnd) {
          time = lunchEnd; // 跳到午休结束
          continue;
        }
      }

      // 生成服务时间 (正态分布，确保非负)
      let serviceTime = this.rng.nextNormal(
        this.config.avgServiceTime,
        this.config.serviceTimeStdDev
      );
      serviceTime = Math.max(1, Math.round(serviceTime)); // 最小1分钟

      // 判断是否为老年客户 (养老金日)
      const isElderly = this.config.isPensionDay &&
                        this.rng.next() < this.config.elderlyRatio;

      // 老年客户服务时间更长
      if (isElderly) {
        serviceTime = Math.round(serviceTime * 1.3);
      }

      this.addCustomer(time, serviceTime);
    }
  }

  /**
   * 弹性窗口管理
   */
  private manageElasticWindows(): void {
    // 计算所有窗口的队列长度
    const maxQueueLength = Math.max(...this.windows.map(w => w.queue.length));

    // 扩展窗口：队列超过阈值且未达最大窗口数
    if (maxQueueLength >= this.config.elasticThreshold &&
        this.activeWindowCount < this.config.maxWindowCount) {
      this.addWindow();
    }

    // 收缩窗口：所有窗口空闲且超过基础窗口数
    const totalQueueLength = this.windows.reduce((sum, w) => sum + w.queue.length, 0);
    if (totalQueueLength === 0 &&
        this.activeWindowCount > this.config.baseWindowCount) {
      const idleWindow = this.windows.find(w =>
        w.id > this.config.baseWindowCount &&
        w.currentCustomer === null &&
        w.queue.length === 0
      );
      if (idleWindow) {
        this.removeWindow(idleWindow.id);
      }
    }
  }

  /**
   * 添加新窗口
   */
  private addWindow(): void {
    this.activeWindowCount++;
    const newWindow: Window = {
      id: this.activeWindowCount,
      queue: [],
      currentCustomer: null,
      totalServed: 0,
      totalWaitTime: 0,
      totalServiceTime: 0,
      idleTime: 0,
      isOnBreak: false,
      breakEndTime: 0,
      breakType: 'none',
      nextWindowBreakTime: this.currentTime + this.config.windowBreakInterval,
      nextToiletBreakTime: this.currentTime + this.rng.next() * 60,
    };
    this.windows.push(newWindow);

    this.timeline.push({
      time: this.currentTime,
      type: 'start_service',
      customerId: 0,
      windowId: this.activeWindowCount,
      description: `窗口${this.activeWindowCount}因客流增加而开放`
    });
  }

  /**
   * 移除窗口
   */
  private removeWindow(windowId: number): void {
    const index = this.windows.findIndex(w => w.id === windowId);
    if (index !== -1) {
      this.windows.splice(index, 1);

      this.timeline.push({
        time: this.currentTime,
        type: 'end_service',
        customerId: 0,
        windowId: windowId,
        description: `窗口${windowId}因客流减少而关闭`
      });
    }
  }

  /**
   * 添加客户到达事件
   */
  private addCustomer(arrivalTime: number, serviceTime: number): void {
    const customer: Customer = {
      id: this.customerIdCounter++,
      arrivalTime,
      serviceTime,
      startTime: -1,
      endTime: -1,
      windowId: -1,
      waitTime: 0,
      status: 'waiting'
    };

    this.customers.push(customer);
    this.events.push({
      type: 'arrival',
      time: arrivalTime,
      customer
    });
  }

  /**
   * 获取空闲窗口
   */
  private getIdleWindow(): Window | null {
    return this.windows.find(w => w.currentCustomer === null) || null;
  }

  /**
   * 获取最短队列窗口
   */
  private getShortestQueueWindow(): Window {
    if (this.windows.length === 0) {
      throw new Error('没有可用的窗口');
    }
    let shortest = this.windows[0];
    for (const window of this.windows) {
      if (window.queue.length < shortest.queue.length) {
        shortest = window;
      }
    }
    return shortest;
  }

  /**
   * 分配客户到窗口
   */
  private assignCustomerToWindow(customer: Customer): void {
    // 在分配前尝试弹性扩展
    this.manageElasticWindows();

    const idleWindow = this.getIdleWindow();

    if (idleWindow) {
      // 直接服务
      customer.windowId = idleWindow.id;
      customer.startTime = this.currentTime;
      customer.endTime = this.currentTime + customer.serviceTime;
      customer.waitTime = 0;
      customer.status = 'serving';

      idleWindow.currentCustomer = customer;

      // 添加离开事件
      this.events.push({
        type: 'departure',
        time: customer.endTime,
        customer,
        windowId: idleWindow.id
      });

      // 记录时间线
      this.timeline.push({
        time: this.currentTime,
        type: 'start_service',
        customerId: customer.id,
        windowId: idleWindow.id,
        description: `客户${customer.id}在窗口${idleWindow.id}开始办理业务`
      });
    } else {
      // 加入最短队列
      const shortestWindow = this.getShortestQueueWindow();
      customer.windowId = shortestWindow.id;
      customer.status = 'waiting';
      shortestWindow.queue.push(customer);

      // 更新最大队列长度
      const currentMaxLength = Math.max(...this.windows.map(w => w.queue.length));
      if (currentMaxLength > this.maxQueueLength) {
        this.maxQueueLength = currentMaxLength;
      }

      // 记录时间线
      this.timeline.push({
        time: this.currentTime,
        type: 'arrival',
        customerId: customer.id,
        windowId: shortestWindow.id,
        description: `客户${customer.id}加入窗口${shortestWindow.id}的等待队列`
      });
    }
  }

  /**
   * 处理客户离开事件
   */
  private processDeparture(windowId: number): void {
    const window = this.windows.find(w => w.id === windowId);
    if (!window || !window.currentCustomer) return;

    const customer = window.currentCustomer;
    customer.status = 'completed';

    // 更新窗口统计
    window.totalServed++;
    window.totalWaitTime += customer.waitTime;
    window.totalServiceTime += customer.serviceTime;

    // 记录时间线
    this.timeline.push({
      time: this.currentTime,
      type: 'end_service',
      customerId: customer.id,
      windowId: window.id,
      description: `客户${customer.id}在窗口${window.id}完成业务办理`
    });

    // 处理队列中的下一个客户
    if (window.queue.length > 0) {
      const nextCustomer = window.queue.shift()!;
      nextCustomer.startTime = this.currentTime;
      nextCustomer.endTime = this.currentTime + nextCustomer.serviceTime;
      nextCustomer.waitTime = this.currentTime - nextCustomer.arrivalTime;
      nextCustomer.status = 'serving';

      window.currentCustomer = nextCustomer;

      // 添加离开事件
      this.events.push({
        type: 'departure',
        time: nextCustomer.endTime,
        customer: nextCustomer,
        windowId: window.id
      });

      // 记录时间线
      this.timeline.push({
        time: this.currentTime,
        type: 'start_service',
        customerId: nextCustomer.id,
        windowId: window.id,
        description: `客户${nextCustomer.id}在窗口${window.id}开始办理业务，等待了${nextCustomer.waitTime}分钟`
      });
    } else {
      window.currentCustomer = null;
      // 尝试收缩窗口
      this.manageElasticWindows();
    }
  }

  /**
   * 检查并触发窗口休息
   */
  private processWindowBreaks(): void {
    for (const window of this.windows) {
      if (window.isOnBreak) continue;
      if (this.config.windowBreakEnabled &&
          this.currentTime >= window.nextWindowBreakTime &&
          window.currentCustomer === null) {
        this.startWindowBreak(window, 'window', this.config.windowBreakDuration);
        continue;
      }
      if (this.config.toiletBreakEnabled &&
          this.currentTime >= window.nextToiletBreakTime &&
          window.currentCustomer === null) {
        this.startWindowBreak(window, 'toilet', this.config.toiletBreakDuration);
      }
    }
  }

  private startWindowBreak(window: Window, type: 'lunch' | 'window' | 'toilet', duration: number): void {
    window.isOnBreak = true;
    window.breakType = type;
    window.breakEndTime = this.currentTime + duration;
    const typeLabel = type === 'lunch' ? '午休' : type === 'window' ? '轮休' : '如厕';
    this.timeline.push({ time: this.currentTime, type: 'start_service', customerId: 0, windowId: window.id, description: `窗口${window.id}开始${typeLabel}（${duration}分钟），队列客户转移` });
    while (window.queue.length > 0) {
      const c = window.queue.shift()!;
      const others = this.windows.filter(w => w.id !== window.id && !w.isOnBreak);
      if (others.length === 0) { window.queue.unshift(c); break; }
      const target = others.reduce((a, b) => a.queue.length <= b.queue.length ? a : b);
      c.windowId = target.id;
      target.queue.push(c);
    }
    const dummy: Customer = { id: -window.id, arrivalTime: 0, serviceTime: 0, startTime: 0, endTime: 0, windowId: window.id, waitTime: 0, status: 'waiting' };
    this.events.push({ type: 'break_end', time: window.breakEndTime, customer: dummy, windowId: window.id });
  }

  private processBreakEnd(windowId: number): void {
    const window = this.windows.find(w => w.id === windowId);
    if (!window) return;
    const typeLabel = window.breakType === 'lunch' ? '午休' : window.breakType === 'window' ? '轮休' : '如厕';
    window.isOnBreak = false;
    window.breakType = 'none';
    if (this.config.windowBreakEnabled) window.nextWindowBreakTime = this.currentTime + this.config.windowBreakInterval;
    if (this.config.toiletBreakEnabled) window.nextToiletBreakTime = this.currentTime + 30 + this.rng.next() * 60;
    this.timeline.push({ time: this.currentTime, type: 'end_service', customerId: 0, windowId: window.id, description: `窗口${window.id}${typeLabel}结束，恢复服务` });
    if (window.queue.length > 0) {
      const next = window.queue.shift()!;
      next.startTime = this.currentTime;
      next.endTime = this.currentTime + next.serviceTime;
      next.waitTime = this.currentTime - next.arrivalTime;
      next.status = 'serving';
      window.currentCustomer = next;
      this.events.push({ type: 'departure', time: next.endTime, customer: next, windowId: window.id });
    }
  }

  /**
   * 运行模拟
   */
  run(): SimulationResult {
    // 生成客户到达
    this.generateArrivals();

    // 按时间排序事件
    this.events.sort((a, b) => a.time - b.time);

    // 处理事件
    while (this.events.length > 0) {
      const event = this.events.shift()!;
      this.currentTime = event.time;

      // 检查各窗口休息状态
      this.processWindowBreaks();

      if (event.type === 'arrival') {
        this.assignCustomerToWindow(event.customer);
      } else if (event.type === 'departure' && event.windowId) {
        this.processDeparture(event.windowId);
      } else if (event.type === 'break_end' && event.windowId) {
        this.processBreakEnd(event.windowId);
      }
    }

    // 计算统计数据
    const completedCustomers = this.customers.filter(c => c.status === 'completed');
    const totalWaitTime = completedCustomers.reduce((sum, c) => sum + c.waitTime, 0);
    const totalStayTime = completedCustomers.reduce((sum, c) => sum + (c.endTime - c.arrivalTime), 0);
    const totalServiceTime = completedCustomers.reduce((sum, c) => sum + c.serviceTime, 0);

    const maxWaitTime = completedCustomers.length > 0
      ? Math.max(...completedCustomers.map(c => c.waitTime))
      : 0;
    const totalSimulationTime = completedCustomers.length > 0
      ? Math.max(...completedCustomers.map(c => c.endTime))
      : 0;

    const windowUtilization = this.windows.map(w => {
      if (totalSimulationTime === 0) return 0;
      return Math.min(w.totalServiceTime / totalSimulationTime, 1);
    });

    return {
      customers: this.customers,
      windows: this.windows,
      statistics: {
        totalCustomers: this.customers.length,
        avgWaitTime: completedCustomers.length > 0 ? totalWaitTime / completedCustomers.length : 0,
        avgStayTime: completedCustomers.length > 0 ? totalStayTime / completedCustomers.length : 0,
        avgServiceTime: completedCustomers.length > 0 ? totalServiceTime / completedCustomers.length : 0,
        maxWaitTime,
        maxQueueLength: this.maxQueueLength,
        totalSimulationTime,
        windowUtilization
      },
      timeline: this.timeline.sort((a, b) => a.time - b.time)
    };
  }

  /**
   * 获取模拟快照 (用于动态可视化)
   */
  getSnapshot(time: number): SimulationSnapshot {
    return {
      time,
      windows: this.windows.map(w => ({
        ...w,
        queue: [...w.queue],
        currentCustomer: w.currentCustomer ? { ...w.currentCustomer } : null
      })),
      totalCustomers: this.customers.length,
      completedCustomers: this.customers.filter(c => c.status === 'completed').length
    };
  }
}

/**
 * 验证银行配置
 */
export function validateConfig(config: BankConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (config.baseWindowCount < 1) {
    errors.push('基础窗口数量必须大于0');
  }
  if (config.maxWindowCount < config.baseWindowCount) {
    errors.push('最大窗口数不能小于基础窗口数');
  }
  if (config.openTime < 0) {
    errors.push('开门时间不能为负');
  }
  if (config.closeTime <= config.openTime) {
    errors.push('关门时间必须晚于开门时间');
  }
  if (config.avgServiceTime <= 0) {
    errors.push('平均服务时间必须大于0');
  }
  if (config.baseArrivalRate <= 0) {
    errors.push('基础到达率必须大于0');
  }
  if (config.elasticThreshold < 1) {
    warnings.push('弹性扩展阈值过小，可能导致频繁开关窗口');
  }
  if (config.isPensionDay && config.pensionDayMultiplier > 6) {
    warnings.push('养老金日流量倍数过高，可能导致极端拥堵');
  }

  return { isValid: errors.length === 0, errors, warnings };
}

/**
 * 获取默认银行配置
 */
export function getDefaultConfig(): BankConfig {
  return {
    baseWindowCount: 4,
    maxWindowCount: 8,
    elasticThreshold: 5,
    openTime: 0,
    closeTime: 480,
    lunchBreakEnabled: true,
    lunchStart: 180,
    lunchDuration: 90,
    baseArrivalRate: 0.5,
    peakHoursMultiplier: 1.5,
    peakHoursStart: 60,
    peakHoursEnd: 180,
    avgServiceTime: 5,
    serviceTimeStdDev: 2,
    isPensionDay: false,
    pensionDayMultiplier: 4,
    elderlyRatio: 0.6,
    windowBreakEnabled: false,
    windowBreakInterval: 120,
    windowBreakDuration: 10,
    toiletBreakEnabled: false,
    toiletBreakProbability: 0.3,
    toiletBreakDuration: 5,
    seed: undefined
  };
}

/**
 * 轮询调度模拟（Round Robin）
 * 所有窗口均有客户时，按轮询顺序分配，不考虑队列长度
 */
export class RoundRobinSimulation extends BankSimulation {
  private rrIndex = 0;

  protected override assignCustomerToWindow(customer: Customer): void {
    const idleWindow = this.getIdleWindow();
    if (idleWindow) {
      this.serveCustomerAt(customer, idleWindow);
    } else {
      const win = this.windows[this.rrIndex % this.windows.length];
      this.rrIndex++;
      this.enqueueCustomerAt(customer, win);
    }
  }
}

/**
 * 最短预期等待调度（Least Expected Wait）
 * 选择预期等待时间最短的窗口：当前服务剩余时间 + 队列中所有客户服务时间之和
 * 理论上优于 SQF，因为考虑了服务时间的差异
 */
export class LeastExpectedWaitSimulation extends BankSimulation {
  private getLEWWindow(): Window {
    if (this.windows.length === 0) throw new Error('没有可用的窗口');
    let best = this.windows[0];
    let bestWait = Infinity;
    for (const w of this.windows) {
      const remaining = w.currentCustomer
        ? Math.max(0, w.currentCustomer.endTime - this.currentTime)
        : 0;
      const queueWait = w.queue.reduce((s, c) => s + c.serviceTime, 0);
      const expectedWait = remaining + queueWait;
      if (expectedWait < bestWait) { bestWait = expectedWait; best = w; }
    }
    return best;
  }

  protected override assignCustomerToWindow(customer: Customer): void {
    const idleWindow = this.getIdleWindow();
    if (idleWindow) {
      this.serveCustomerAt(customer, idleWindow);
    } else {
      this.enqueueCustomerAt(customer, this.getLEWWindow());
    }
  }
}
