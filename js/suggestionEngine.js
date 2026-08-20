/**
 * SuggestionEngine
 * Đọc Program structure, map metric đang yếu -> danh sách Program (Loại=Growth)
 * để gợi ý cho RM ở mỗi Top 10 Risky.
 *
 * Metric key trong dashboard -> label thật trong Program structure (cột "Metric (KPI goc)")
 */

const SuggestionEngine = (() => {

  const METRIC_KEY_TO_LABEL = {
    adg:          "ADG",
    ado:          "ADO",
    paid_ads:     "Paid Ads expense",
    offsite:      "AMS expense",
    content_ado:  "Video ADO",       // Content ADO gồm Video + Livestream — map cả 2 label khi tra cứu
    video_ado:    "Video ADO",
    livestream_ado: "Livestream ADO",
    winning_sku_ado: "ADG",          // chưa có nhóm riêng trong Program structure — tạm map theo ADG
  };

  let _cache = null;
  let _trackingCache = null;

  async function loadPrograms() {
    if (_cache) return _cache;
    const res = await DataLoader.loadCsv("program_structure");
    if (!res.ok) { _cache = []; return _cache; }
    const P = CONFIG.COLUMNS_PROGRAM;
    _cache = res.rows.filter(r => (r[P.program] || "").trim() !== "");
    return _cache;
  }

  async function loadTracking() {
    if (_trackingCache) return _trackingCache;
    _trackingCache = await DataLoader.loadProgramTracking();
    return _trackingCache;
  }

  /**
   * Trả về tối đa `limit` program Growth phù hợp với metricKey.
   * Nếu có shopId + tracking data: chỉ trả Program mà shop CHƯA join
   * (tracking flag = false/0). Nếu không xác định được trạng thái join
   * (thiếu cột khớp tên trong tracking sheet), vẫn giữ program đó trong
   * danh sách gợi ý (an toàn hơn là bỏ sót).
   */
  async function suggestFor(metricKey, limit = 2, shopId = null) {
    const programs = await loadPrograms();
    const P = CONFIG.COLUMNS_PROGRAM;
    const label = METRIC_KEY_TO_LABEL[metricKey];
    if (!label) return [];
    let matches = programs.filter(r =>
      (r[P.metric] || "").trim().toLowerCase() === label.toLowerCase() &&
      (r[P.type] || "").trim().toLowerCase() === "growth"
    );

    if (shopId !== null) {
      const tracking = await loadTracking();
      if (tracking.ok) {
        const shopFlags = tracking.byShop[shopId];
        if (shopFlags) {
          matches = matches.filter(r => {
            const programName = (r[P.program] || "").trim().toLowerCase();
            // tìm cột tracking có label bắt đầu bằng "{metricLabel}_" và
            // chứa tên program (so khớp lỏng vì tên có thể không trùng 100%)
            const trackingKey = Object.keys(shopFlags).find(k => {
              const kl = k.toLowerCase();
              return kl.startsWith(label.toLowerCase() + "_") && kl.includes(programName.split("(")[0].trim());
            });
            if (!trackingKey) return true; // không map được -> vẫn giữ (an toàn)
            return shopFlags[trackingKey] === false; // chỉ giữ nếu CHƯA join
          });
        }
      }
    }

    return matches.slice(0, limit).map(r => ({
      program: r[P.program],
      idea: r[P.idea],
      requirement: r[P.requirement],
    }));
  }

  /**
   * Render suggestion ngắn gọn dạng text cho 1 ô bảng.
   * Truyền shopId để lọc theo trạng thái join thật của seller đó.
   */
  async function suggestionText(metricKey, shopId = null) {
    const suggestions = await suggestFor(metricKey, 2, shopId);
    if (suggestions.length === 0) return shopId !== null ? "Đã tham gia hết Program Growth phù hợp" : "—";
    return suggestions.map(s => `<strong>${s.program}</strong>${s.requirement ? ` (${s.requirement})` : ""}`).join("; ");
  }

  return { loadPrograms, suggestFor, suggestionText, METRIC_KEY_TO_LABEL };
})();
