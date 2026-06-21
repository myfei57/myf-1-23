import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wrench, AlertTriangle, CheckCircle, XCircle, Clock, Coins, History, Heart, Bot, Target } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { PageContainer } from '../components/PageContainer';
import { RobotCard } from '../components/RobotCard';
import { Modal } from '../components/Modal';
import { StatBar } from '../components/StatBar';
import { clamp } from '../utils/helpers';

type RepairResult = {
  success: boolean;
  cost: number;
  targetRestored: number;
  restored: number;
  failureReason?: string;
};

export function RepairPage() {
  const { robots, repairRecords, config, materials, repairRobot } = useGameStore();
  const [selectedRobotId, setSelectedRobotId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [repairResult, setRepairResult] = useState<RepairResult | null>(null);
  const [isRepairing, setIsRepairing] = useState(false);
  const [targetRestore, setTargetRestore] = useState(0);

  const selectedRobot = robots.find((r) => r.id === selectedRobotId);

  const maxRestore = selectedRobot
    ? selectedRobot.maxDurability - selectedRobot.durability
    : 0;

  useEffect(() => {
    if (!selectedRobot) {
      setTargetRestore(0);
      return;
    }
    setTargetRestore((prev) => {
      if (maxRestore <= 0) return 0;
      return clamp(prev, 1, maxRestore);
    });
  }, [selectedRobotId, selectedRobot, maxRestore]);

  const getRepairInfo = (robot: typeof robots[0], target: number) => {
    const { repairRules } = config;
    const durabilityNeeded = robot.maxDurability - robot.durability;
    const clampedTarget = clamp(target, 0, durabilityNeeded);
    const cost = clampedTarget * repairRules.materialCostPerPoint;
    const successRate = Math.max(
      0.1,
      repairRules.baseSuccessRate - robot.repairCount * repairRules.degradeRate
    );
    const canRepair =
      robot.repairCount < repairRules.maxRepairs &&
      clampedTarget > 0 &&
      materials >= cost;

    return { durabilityNeeded, cost, successRate, canRepair, target: clampedTarget };
  };

  const handleRepair = async () => {
    if (!selectedRobotId || isRepairing || !selectedRobot) return;

    const info = getRepairInfo(selectedRobot, targetRestore);
    if (!info.canRepair) return;

    setIsRepairing(true);
    setRepairResult(null);

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const result = repairRobot(selectedRobotId, info.target);
    setRepairResult(result);
    setIsRepairing(false);
  };

  const sortedRobots = [...robots].sort((a, b) => {
    const aPercent = a.durability / a.maxDurability;
    const bPercent = b.durability / b.maxDurability;
    return aPercent - bPercent;
  });

  const selectRobot = (robotId: string, needed: number) => {
    setSelectedRobotId(robotId);
    setRepairResult(null);
    setTargetRestore(needed > 0 ? needed : 0);
  };

  return (
    <PageContainer
      title="维修中心"
      subtitle="修复受损的机器人，让它们重返战场"
      actions={
        <button
          onClick={() => setShowHistory(true)}
          className="btn-secondary flex items-center gap-2"
        >
          <History className="w-4 h-4" />
          维修记录
        </button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-display font-bold text-white mb-4 flex items-center gap-2">
            <Bot className="w-5 h-5 text-neon-blue" />
            机器人列表
          </h2>
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
            {sortedRobots.length === 0 ? (
              <div className="card p-8 text-center">
                <Bot className="w-12 h-12 text-white/20 mx-auto mb-3" />
                <p className="text-white/50">暂无机器人</p>
                <p className="text-xs text-white/30 mt-1">先去组装车间组装一个吧</p>
              </div>
            ) : (
              sortedRobots.map((robot) => {
                const needed = robot.maxDurability - robot.durability;
                return (
                  <div key={robot.id} className="relative">
                    <RobotCard
                      robot={robot}
                      selected={selectedRobotId === robot.id}
                      onClick={() => selectRobot(robot.id, needed)}
                      showDetails
                    />
                    {needed > 0 && (
                      <div className="absolute top-2 right-2">
                        <span className="text-[10px] px-2 py-1 rounded-full bg-neon-orange/20 text-neon-orange font-mono">
                          需要维修
                        </span>
                      </div>
                    )}
                    {robot.repairCount >= config.repairRules.maxRepairs && (
                      <div className="absolute top-2 right-2">
                        <span className="text-[10px] px-2 py-1 rounded-full bg-neon-red/20 text-neon-red font-mono">
                          返修上限
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-display font-bold text-white mb-4 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-neon-green" />
            维修操作台
          </h2>

          <AnimatePresence mode="wait">
            {selectedRobot ? (
              (() => {
                const info = getRepairInfo(selectedRobot, targetRestore);
                const reachedMaxRepairs =
                  selectedRobot.repairCount >= config.repairRules.maxRepairs;
                const sliderDisabled = reachedMaxRepairs || maxRestore <= 0;
                const materialsShort = materials < info.cost;
                const sliderPercent =
                  maxRestore > 0 ? (info.target / maxRestore) * 100 : 0;
                const successColor =
                  info.successRate >= 0.7
                    ? '#10b981'
                    : info.successRate >= 0.4
                    ? '#f59e0b'
                    : '#ef4444';

                return (
                  <motion.div
                    key="repair-panel"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="card p-6"
                  >
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-20 h-20 rounded-2xl bg-neon-blue/20 flex items-center justify-center">
                        <Bot className="w-10 h-10 text-neon-blue" />
                      </div>
                      <div>
                        <h3 className="text-xl font-display font-bold text-white">
                          {selectedRobot.name}
                        </h3>
                        <p className="text-sm text-white/50">
                          已返修 {selectedRobot.repairCount}/
                          {config.repairRules.maxRepairs} 次
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4 mb-6">
                      <StatBar
                        label="当前耐久度"
                        value={selectedRobot.durability}
                        max={selectedRobot.maxDurability}
                        color={
                          selectedRobot.durability / selectedRobot.maxDurability > 0.6
                            ? 'green'
                            : selectedRobot.durability / selectedRobot.maxDurability > 0.3
                            ? 'orange'
                            : 'red'
                        }
                      />

                      <div className="bg-background-tertiary rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs text-white/50 flex items-center gap-1">
                            <Target className="w-3.5 h-3.5" />
                            局部维修 · 选择恢复耐久点数
                          </p>
                          <p className="text-lg font-display font-bold text-neon-green font-mono">
                            {info.target}
                            <span className="text-xs text-white/50 ml-1">
                              / {maxRestore} 点
                            </span>
                          </p>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={Math.max(1, maxRestore)}
                          step={1}
                          value={info.target}
                          disabled={sliderDisabled}
                          onChange={(e) => setTargetRestore(Number(e.target.value))}
                          className="repair-slider"
                          style={{
                            background: `linear-gradient(to right, ${successColor} 0%, ${successColor} ${sliderPercent}%, var(--color-bg-tertiary) ${sliderPercent}%, var(--color-bg-tertiary) 100%)`,
                          }}
                        />
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] text-white/30">最小 1 点</span>
                          <button
                            type="button"
                            onClick={() => setTargetRestore(maxRestore)}
                            disabled={sliderDisabled}
                            className="text-[10px] text-neon-blue hover:text-neon-cyan transition-colors disabled:text-white/20 disabled:cursor-not-allowed"
                          >
                            满修 {maxRestore} 点
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-background-tertiary rounded-xl p-4">
                          <p className="text-xs text-white/50 mb-1">本次恢复</p>
                          <p className="text-2xl font-display font-bold text-neon-orange font-mono">
                            {info.target}
                            <span className="text-sm text-white/50 ml-1">点</span>
                          </p>
                        </div>
                        <div className="bg-background-tertiary rounded-xl p-4">
                          <p className="text-xs text-white/50 mb-1">材料消耗</p>
                          <p
                            className={`text-2xl font-display font-bold font-mono ${
                              materialsShort ? 'text-neon-red' : 'text-neon-green'
                            }`}
                          >
                            {info.cost}
                            <span className="text-sm text-white/50 ml-1">
                              <Coins className="w-3 h-3 inline" />
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="bg-background-tertiary rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-white/50">维修成功率</p>
                          <p className="text-lg font-display font-bold font-mono">
                            <span
                              className={
                                info.successRate >= 0.7
                                  ? 'text-neon-green'
                                  : info.successRate >= 0.4
                                  ? 'text-neon-orange'
                                  : 'text-neon-red'
                              }
                            >
                              {Math.round(info.successRate * 100)}%
                            </span>
                          </p>
                        </div>
                        <div className="h-2 bg-background rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            initial={{ width: 0 }}
                            animate={{
                              width: `${info.successRate * 100}%`,
                              backgroundColor: successColor,
                            }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                        <p className="text-[10px] text-white/30 mt-2">
                          每次返修后成功率衰减 {config.repairRules.degradeRate * 100}%
                        </p>
                      </div>

                      {reachedMaxRepairs && (
                        <div className="bg-neon-red/10 border border-neon-red/30 rounded-xl p-4 flex items-center gap-3">
                          <AlertTriangle className="w-5 h-5 text-neon-red flex-shrink-0" />
                          <p className="text-sm text-neon-red">已达到最大返修次数，无法继续维修</p>
                        </div>
                      )}

                      {materialsShort && !reachedMaxRepairs && maxRestore > 0 && (
                        <div className="bg-neon-orange/10 border border-neon-orange/30 rounded-xl p-4 flex items-center gap-3">
                          <AlertTriangle className="w-5 h-5 text-neon-orange flex-shrink-0" />
                          <p className="text-sm text-neon-orange">
                            材料不足，还需 {info.cost - materials} 材料，请调低恢复点数
                          </p>
                        </div>
                      )}

                      {maxRestore === 0 && !reachedMaxRepairs && (
                        <div className="bg-neon-green/10 border border-neon-green/30 rounded-xl p-4 flex items-center gap-3">
                          <CheckCircle className="w-5 h-5 text-neon-green flex-shrink-0" />
                          <p className="text-sm text-neon-green">机器人状态良好，无需维修</p>
                        </div>
                      )}
                    </div>

                    {isRepairing && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mb-6 p-4 bg-background-tertiary rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          >
                            <Wrench className="w-5 h-5 text-neon-blue" />
                          </motion.div>
                          <div>
                            <p className="text-sm text-white font-medium">正在维修...</p>
                            <p className="text-xs text-white/50">维修工正在努力修复中</p>
                          </div>
                        </div>
                        <div className="mt-3 h-1.5 bg-background rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-neon-blue rounded-full"
                            initial={{ width: '0%' }}
                            animate={{ width: '100%' }}
                            transition={{ duration: 1.5, ease: 'easeInOut' }}
                          />
                        </div>
                      </motion.div>
                    )}

                    {repairResult && !isRepairing && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`mb-6 p-4 rounded-xl border ${
                          repairResult.success
                            ? 'bg-neon-green/10 border-neon-green/30'
                            : 'bg-neon-red/10 border-neon-red/30'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {repairResult.success ? (
                            <CheckCircle className="w-6 h-6 text-neon-green flex-shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-6 h-6 text-neon-red flex-shrink-0 mt-0.5" />
                          )}
                          <div className="min-w-0">
                            <p
                              className={`font-bold ${
                                repairResult.success ? 'text-neon-green' : 'text-neon-red'
                              }`}
                            >
                              {repairResult.success ? '维修成功！' : '维修失败'}
                            </p>
                            <p className="text-sm text-white/60 mt-0.5">
                              消耗材料 {repairResult.cost}，目标恢复{' '}
                              {repairResult.targetRestored} 点，实际恢复{' '}
                              {repairResult.restored} 点
                            </p>
                            {!repairResult.success && repairResult.failureReason && (
                              <p className="text-xs text-neon-red/80 mt-1">
                                失败原因：{repairResult.failureReason}
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    <button
                      onClick={handleRepair}
                      disabled={!info.canRepair || isRepairing}
                      className={`w-full py-4 rounded-xl font-display font-bold text-lg transition-all ${
                        info.canRepair && !isRepairing
                          ? 'bg-gradient-to-r from-neon-green to-neon-blue text-white hover:shadow-lg hover:shadow-neon-green/20'
                          : 'bg-background-tertiary text-white/30 cursor-not-allowed'
                      }`}
                    >
                      <Wrench className="w-5 h-5 inline mr-2" />
                      {isRepairing ? '维修中...' : '开始维修'}
                    </button>
                  </motion.div>
                );
              })()
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="card p-12 text-center"
              >
                <Wrench className="w-16 h-16 text-white/10 mx-auto mb-4" />
                <p className="text-white/50">选择一个机器人进行维修</p>
                <p className="text-xs text-white/30 mt-2">
                  点击左侧列表中的机器人卡片
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <Modal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        title="维修记录"
      >
        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {repairRecords.length === 0 ? (
            <div className="text-center py-8">
              <History className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="text-white/50">暂无维修记录</p>
            </div>
          ) : (
            [...repairRecords]
              .sort((a, b) => b.repairedAt - a.repairedAt)
              .map((record) => (
                <motion.div
                  key={record.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-background-tertiary rounded-xl p-4 flex items-center gap-4"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      record.success ? 'bg-neon-green/20' : 'bg-neon-red/20'
                    }`}
                  >
                    {record.success ? (
                      <Heart className="w-5 h-5 text-neon-green" />
                    ) : (
                      <XCircle className="w-5 h-5 text-neon-red" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{record.robotName}</p>
                    <p className="text-xs text-white/50">
                      消耗材料 {record.materialCost} | 目标恢复 {record.targetRestored} | 实际恢复{' '}
                      {record.durabilityRestored}
                    </p>
                    {!record.success && record.failureReason && (
                      <p className="text-xs text-neon-red/80 mt-1">
                        失败原因：{record.failureReason}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-white/30 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(record.repairedAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </motion.div>
              ))
          )}
        </div>
      </Modal>
    </PageContainer>
  );
}
