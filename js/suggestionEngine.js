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

  async function loadPrograms() {
    if (_cache) return _cache;
    const res = await DataLoader.loadCsv("program_structure");
    if (!res.ok) { _cache = []; return _cache; }
    const P = CONFIG.COLUMNS_PROGRAM;
    _cache = res.rows.filter(r => (r[P.program] || "").trim() !== "");
    return _cache;
  }

  /**
   * Trả về tối đa `limit` program Growth phù hợp với metricKey.
   */
  async function suggestFor(metricKey, limit = 2) {
    const programs = await loadPrograms();
    const P = CONFIG.COLUMNS_PROGRAM;
    const label = METRIC_KEY_TO_LABEL[metricKey];
    if (!label) return [];
    const matches = programs.filter(r =>
      (r[P.metric] || "").trim().toLowerCase() === label.toLowerCase() &&
      (r[P.type] || "").trim().toLowerCase() === "growth"
    );
    return matches.slice(0, limit).map(r => ({
      program: r[P.program],
      idea: r[P.idea],
      requirement: r[P.requirement],
    }));
  }

  /**
   * Render suggestion ngắn gọn dạng text cho 1 ô bảng.
   */
  async function suggestionText(metricKey) {
    const suggestions = await suggestFor(metricKey, 2);
    if (suggestions.length === 0) return "—";
    return suggestions.map(s => `<strong>${s.program}</strong>${s.requirement ? ` (${s.requirement})` : ""}`).join("; ");
  }

  return { loadPrograms, suggestFor, suggestionText, METRIC_KEY_TO_LABEL };
})();
