#!/bin/bash
# QueueLab 项目验证脚本

echo "=================================="
echo "QueueLab 项目完整性验证"
echo "=================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1"
        return 0
    else
        echo -e "${RED}✗${NC} $1 (缺失)"
        return 1
    fi
}

check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} $1/"
        return 0
    else
        echo -e "${RED}✗${NC} $1/ (缺失)"
        return 1
    fi
}

echo "1. 检查核心库文件..."
check_file "src/lib/benchmark-types.ts"
check_file "src/lib/benchmark-engine.ts"
check_file "src/lib/benchmark-metrics.ts"
check_file "src/lib/benchmark-presets.ts"
check_file "src/lib/benchmark-regression.ts"
echo ""

echo "2. 检查策略文件..."
check_dir "src/lib/policies"
check_file "src/lib/policies/jsq.ts"
check_file "src/lib/policies/rr.ts"
check_file "src/lib/policies/leastWorkload.ts"
check_file "src/lib/policies/singleQueueFcfs.ts"
check_file "src/lib/policies/holdingPoolSpt.ts"
echo ""

echo "3. 检查UI组件..."
check_file "src/components/BenchmarkStatusBar.tsx"
check_file "src/components/DecisionAuditPanel.tsx"
check_file "src/components/MetricsComparisonPanel.tsx"
check_file "src/components/MiniTrendPanel.tsx"
echo ""

echo "4. 检查文档..."
check_file "README.md"
check_file "WELCOME.md"
check_file "QUICKSTART.md"
check_file "COMPLETION_REPORT.md"
check_file "DELIVERY_CHECKLIST.md"
check_file "IMPLEMENTATION_SUMMARY.md"
echo ""

echo "5. 检查API路由..."
check_file "src/app/api/simulation/route.ts"
echo ""

echo "=================================="
echo "验证完成"
echo "=================================="
echo ""

# 尝试构建
echo "6. 尝试构建项目..."
if npm run build > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} 构建成功"
else
    echo -e "${RED}✗${NC} 构建失败，请检查错误"
fi

echo ""
echo "=================================="
echo "QueueLab 已准备就绪！"
echo "运行 'npm run dev' 启动开发服务器"
echo "=================================="
