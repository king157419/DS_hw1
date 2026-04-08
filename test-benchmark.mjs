/**
 * 测试脚本：验证benchmark系统
 */

import { runAllRegressionTests } from './src/lib/benchmark-regression';
import { BenchmarkEngine } from './src/lib/benchmark-engine';
import { JSQPolicy } from './src/lib/policies/jsq';
import { RoundRobinPolicy } from './src/lib/policies/rr';
import { LeastWorkloadPolicy } from './src/lib/policies/leastWorkload';
import { SingleQueueFCFSPolicy } from './src/lib/policies/singleQueueFcfs';
import { HoldingPoolSPTPolicy } from './src/lib/policies/holdingPoolSpt';
import { getPreset } from './src/lib/benchmark-presets';

console.log('='.repeat(60));
console.log('QueueLab Benchmark System Test');
console.log('='.repeat(60));

// 1. 运行回归测试
console.log('\n[1] Running Regression Tests...\n');
const regressionResult = runAllRegressionTests();

regressionResult.results.forEach(result => {
  const icon = result.pass ? '✓' : '✗';
  const color = result.pass ? '\x1b[32m' : '\x1b[31m';
  console.log(`${color}${icon}\x1b[0m ${result.name}`);
  console.log(`  ${result.message}`);
});

console.log(`\nTotal: ${regressionResult.passed} passed, ${regressionResult.failed} failed`);

// 2. 测试预设场景
console.log('\n[2] Testing Preset Scenarios...\n');

const testPreset = getPreset('long_short_mixed');
if (testPreset) {
  console.log(`Testing preset: ${testPreset.name}`);
  console.log(`Description: ${testPreset.description}`);
  console.log(`Jobs: ${testPreset.jobs.length}, Servers: ${testPreset.serverCount}`);

  const policies = [
    new JSQPolicy(),
    new SingleQueueFCFSPolicy(),
    new HoldingPoolSPTPolicy()
  ];

  console.log('\nRunning algorithms...');
  policies.forEach(policy => {
    const engine = new BenchmarkEngine({
      serverCount: testPreset.serverCount,
      jobs: testPreset.jobs,
      policy
    });

    const result = engine.run();
    console.log(`\n${policy.name}:`);
    console.log(`  Avg Wait: ${result.metrics.avgWait.toFixed(2)} min`);
    console.log(`  Avg Stay: ${result.metrics.avgStay.toFixed(2)} min`);
    console.log(`  Service Level: ${(result.metrics.serviceLevel5m * 100).toFixed(1)}%`);
    console.log(`  Fairness: ${result.metrics.jainFairnessWait.toFixed(3)}`);
  });
}

// 3. 验证决策记录
console.log('\n[3] Testing Decision Audit...\n');

const simpleJobs = [
  { arrivalTime: 0, serviceTime: 5 },
  { arrivalTime: 0, serviceTime: 3 },
  { arrivalTime: 1, serviceTime: 4 }
];

const jsqEngine = new BenchmarkEngine({
  serverCount: 2,
  jobs: simpleJobs,
  policy: new JSQPolicy()
});

const jsqResult = jsqEngine.run();
console.log(`JSQ Decisions: ${jsqResult.decisions.length} recorded`);
jsqResult.decisions.slice(0, 3).forEach(d => {
  console.log(`  t=${d.time}: Job ${d.jobId} -> ${d.reason}`);
});

console.log('\n' + '='.repeat(60));
console.log('Test Complete!');
console.log('='.repeat(60));

if (regressionResult.failed === 0) {
  console.log('\n✓ All tests passed! System is ready.');
  process.exit(0);
} else {
  console.log(`\n✗ ${regressionResult.failed} test(s) failed. Please review.`);
  process.exit(1);
}
