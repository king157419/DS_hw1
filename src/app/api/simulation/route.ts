import { NextRequest, NextResponse } from 'next/server';
import {
  BankSimulation,
  LeastExpectedWaitSimulation,
  RealisticBankSimulation,
  RoundRobinSimulation,
  generateTestData,
  validateConfig,
  validateInput,
  type BankConfig,
  type SimulationInput,
} from '@/lib/bank-simulation';
import { BenchmarkEngine } from '@/lib/benchmark-engine';
import { getPreset, type PresetId } from '@/lib/benchmark-presets';
import type { BenchmarkConfig } from '@/lib/benchmark-types';
import {
  createPolicyById,
  getAlgorithmMeta,
  getAllPresetMetas,
  isAlgorithmId,
  isPresetId,
  type AlgorithmId,
} from '@/lib/benchmark-registry';

type JsonRecord = Record<string, unknown>;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!isRecord(body)) {
      return errorResponse('Request body must be valid JSON.');
    }

    const action = body.action;
    const data = body.data;

    if (typeof action !== 'string' || action.trim() === '') {
      return errorResponse('action is required.');
    }

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
        return errorResponse(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown server error.',
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'QueueLab simulation API',
    actions: [
      'simulate',
      'realistic',
      'validate',
      'testData',
      'compareAlgorithms',
      'benchmarkCompare',
      'benchmarkSingle',
      'benchmarkPresets',
    ],
  });
}

function handleSimulation(data: unknown) {
  const validation = validateInput(data);
  if (!validation.isValid) {
    return NextResponse.json(
      {
        success: false,
        error: 'Input validation failed.',
        validation,
      },
      { status: 400 },
    );
  }

  const simulationInput = cloneSimulationInput(data as SimulationInput);
  const simulation = new BankSimulation(simulationInput.windowCount);

  for (const customer of simulationInput.customers) {
    simulation.addCustomer(customer.arrivalTime, customer.serviceTime);
  }

  return NextResponse.json({
    success: true,
    result: simulation.run(),
    validation,
  });
}

function handleRealisticSimulation(data: unknown) {
  const validation = validateConfig(data);
  if (!validation.isValid) {
    return NextResponse.json(
      {
        success: false,
        error: 'Config validation failed.',
        validation,
      },
      { status: 400 },
    );
  }

  const config = cloneBankConfig(data as BankConfig);
  const simulation = new RealisticBankSimulation(config);

  return NextResponse.json({
    success: true,
    result: simulation.run(),
    config,
    validation,
  });
}

function handleValidation(data: unknown) {
  return NextResponse.json({
    success: true,
    validation: validateInput(data),
  });
}

function handleTestData(data: unknown) {
  if (!isRecord(data) || !isTestDataType(data.type)) {
    return errorResponse('testData requires type: valid | invalid_all | invalid_partial');
  }

  const testData = generateTestData(data.type);
  return NextResponse.json({
    success: true,
    testData,
    validation: validateInput(testData),
  });
}

function handleCompareAlgorithms(data: unknown) {
  const validation = validateInput(data);
  if (!validation.isValid) {
    return NextResponse.json(
      {
        success: false,
        error: 'Input validation failed.',
        validation,
      },
      { status: 400 },
    );
  }

  const simulationInput = cloneSimulationInput(data as SimulationInput);
  const algorithms = [
    {
      algorithmName: 'SQF（最短队列优先）',
      simulation: new BankSimulation(simulationInput.windowCount),
    },
    {
      algorithmName: 'RR（轮询分配）',
      simulation: new RoundRobinSimulation(simulationInput.windowCount),
    },
    {
      algorithmName: 'LEW（最短预计等待）',
      simulation: new LeastExpectedWaitSimulation(simulationInput.windowCount),
    },
  ];

  const results = algorithms.map(({ algorithmName, simulation }) => {
    simulationInput.customers.forEach((customer) => {
      simulation.addCustomer(customer.arrivalTime, customer.serviceTime);
    });

    return {
      algorithmName,
      result: simulation.run(),
    };
  });

  return NextResponse.json({ success: true, results, validation });
}

function handleBenchmarkSingle(data: unknown) {
  const parsed = parseSinglePayload(data);
  if (parsed instanceof NextResponse) {
    return parsed;
  }

  const preset = getPreset(parsed.presetId)!;
  const result = runBenchmark(preset, parsed.algorithmId);
  const algorithmMeta = getAlgorithmMeta(parsed.algorithmId);

  return NextResponse.json({
    success: true,
    presetId: parsed.presetId,
    presetName: preset.name,
    algorithmId: parsed.algorithmId,
    algorithmName: algorithmMeta.name,
    result,
  });
}

function handleBenchmarkCompare(data: unknown) {
  const parsed = parseComparePayload(data);
  if (parsed instanceof NextResponse) {
    return parsed;
  }

  const preset = getPreset(parsed.presetId)!;
  const results = parsed.algorithmIds.map((algorithmId) =>
    runBenchmark(preset, algorithmId),
  );

  return NextResponse.json({
    success: true,
    presetId: parsed.presetId,
    presetName: preset.name,
    results,
  });
}

function handleBenchmarkPresets() {
  const presets = getAllPresetMetas().map((preset) => ({
    id: preset.id,
    name: preset.name,
    description: preset.description,
    serverCount: preset.serverCount,
    jobCount: preset.jobs.length,
    differentiation: preset.differentiation,
    difficulty: preset.difficulty,
    recommendedFor: preset.recommendedFor,
  }));

  return NextResponse.json({
    success: true,
    presets,
  });
}

function parseSinglePayload(
  data: unknown,
): NextResponse | { presetId: PresetId; algorithmId: AlgorithmId } {
  if (!isRecord(data)) {
    return errorResponse('benchmarkSingle data must be an object.');
  }

  const presetId = data.presetId;
  const algorithmId = data.algorithmId;

  if (typeof presetId !== 'string' || presetId.trim() === '') {
    return errorResponse('presetId is required.');
  }

  if (!isPresetId(presetId)) {
    return errorResponse(`Unknown presetId: ${presetId}`);
  }

  if (typeof algorithmId !== 'string' || algorithmId.trim() === '') {
    return errorResponse('algorithmId is required.');
  }

  if (!isAlgorithmId(algorithmId)) {
    return errorResponse(`Unknown algorithmId: ${algorithmId}`);
  }

  return { presetId, algorithmId };
}

function parseComparePayload(
  data: unknown,
): NextResponse | { presetId: PresetId; algorithmIds: AlgorithmId[] } {
  if (!isRecord(data)) {
    return errorResponse('benchmarkCompare data must be an object.');
  }

  const presetId = data.presetId;
  const algorithmIds = data.algorithmIds;

  if (typeof presetId !== 'string' || presetId.trim() === '') {
    return errorResponse('presetId is required.');
  }

  if (!isPresetId(presetId)) {
    return errorResponse(`Unknown presetId: ${presetId}`);
  }

  if (!Array.isArray(algorithmIds) || algorithmIds.length === 0) {
    return errorResponse('algorithmIds must contain at least one algorithmId.');
  }

  if (algorithmIds.some((value) => typeof value !== 'string' || value.trim() === '')) {
    return errorResponse('algorithmIds cannot contain empty values.');
  }

  const invalidIds = algorithmIds.filter((value): value is string => !isAlgorithmId(value));
  if (invalidIds.length > 0) {
    return errorResponse(`Unknown algorithmId: ${invalidIds.join(', ')}`);
  }

  return {
    presetId,
    algorithmIds: [...new Set(algorithmIds)] as AlgorithmId[],
  };
}

function runBenchmark(
  preset: NonNullable<ReturnType<typeof getPreset>>,
  algorithmId: AlgorithmId,
) {
  const config: BenchmarkConfig = {
    serverCount: preset.serverCount,
    jobs: preset.jobs,
    policy: createPolicyById(algorithmId),
  };

  return new BenchmarkEngine(config).run();
}

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

function errorResponse(message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status },
  );
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function isTestDataType(value: unknown): value is 'valid' | 'invalid_all' | 'invalid_partial' {
  return value === 'valid' || value === 'invalid_all' || value === 'invalid_partial';
}
