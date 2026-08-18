/**
 * KPI Engine
 * - Tính % reach target cho từng metric
 * - Quy đổi thành score theo Max Score 120 (không vượt trần)
 * - Tổng hợp Weighted Score theo bảng weightage 3Q26
 * - Phân loại trạng thái good / watch / risk
 */

const KpiEngine = (() => {

  function pctReachTarget(actual, target) {
    if (target === null || target === undefined || target === 0 || isNaN(target)) return null;
    if (actual === null || actual === undefined || isNaN(actual)) return null;
    return actual / target;
  }

  // % reach target -> score trên thang tối đa maxScore (vd 120 = 120%)
  function toScore(pct, maxScore = 120) {
    if (pct === null) return null;
    return Math.min(pct * 100, maxScore);
  }

  function statusOf(pct) {
    if (pct === null) return "unknown";
    if (pct >= CONFIG.STATUS_THRESHOLDS.good) return "good";
    if (pct >= CONFIG.STATUS_THRESHOLDS.watch) return "watch";
    return "risk";
  }

  /**
   * seller = {
   *   ad_gmv_pct, paid_ads_pct, marketing_solution_pct,
   *   offsite_pct, content_ado_pct, winning_sku_ado_pct
   * }  (mỗi field = actual/target, tức pctReachTarget)
   * Trả về { weightedScore, breakdown: {metric: {pct, score, weight, contrib}} }
   */
  function computeWeightedScore(pctByMetric) {
    const weights = CONFIG.KPI_WEIGHTS;
    let total = 0;
    let weightSum = 0;
    const breakdown = {};

    for (const key in weights) {
      const w = weights[key];
      const pct = pctByMetric[key];
      const score = toScore(pct, w.maxScore);
      breakdown[key] = { label: w.label, pct, score, weight: w.weight };
      if (score !== null) {
        total += score * w.weight;
        weightSum += w.weight;
      }
    }
    // Chuẩn hoá nếu thiếu dữ liệu 1 vài metric (chia lại theo phần weight đã có data)
    const weightedScore = weightSum > 0 ? total / weightSum * (weightSum) : null;
    return { weightedScore: weightSum > 0 ? total : null, coverage: weightSum, breakdown };
  }

  function weakestMetric(breakdown) {
    let weakest = null;
    for (const key in breakdown) {
      const b = breakdown[key];
      if (b.pct === null) continue;
      if (!weakest || b.pct < weakest.pct) weakest = { key, ...b };
    }
    return weakest;
  }

  return { pctReachTarget, toScore, statusOf, computeWeightedScore, weakestMetric };
})();
