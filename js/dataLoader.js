/**
 * DataLoader — fetch + parse các CSV publish từ Google Sheets.
 * Auto-sync: mỗi lần load trang / bấm "Sync lại" sẽ fetch bản CSV mới nhất
 * (Google publish cache ~5 phút sau khi Sheet gốc được sửa).
 */

const DataLoader = (() => {
  const cache = {};

  function cleanNumber(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === "number") return v;
    const s = String(v).replace(/,/g, "").replace(/%$/, "").trim();
    if (s === "" || s.toUpperCase() === "N/A") return null;
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  async function loadCsv(key, { force = false } = {}) {
    const url = CONFIG.SOURCES[key];
    if (!url) {
      console.warn(`[DataLoader] Chưa cấu hình CSV cho "${key}" — xem js/config.js`);
      return { ok: false, rows: [], reason: "missing_url" };
    }
    if (cache[key] && !force) return cache[key];

    const bust = force && CONFIG.cacheBustOnManualRefresh ? `${url.includes("?") ? "&" : "?"}_ts=${Date.now()}` : "";
    try {
      const res = await fetch(url + bust, { cache: force ? "no-store" : "default" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      const result = { ok: true, rows: parsed.data, fields: parsed.meta.fields, loadedAt: new Date() };
      cache[key] = result;
      return result;
    } catch (err) {
      console.error(`[DataLoader] Lỗi tải "${key}":`, err);
      const result = { ok: false, rows: [], reason: "fetch_error", error: err };
      return result;
    }
  }

  async function loadAll(force = false) {
    const keys = Object.keys(CONFIG.SOURCES);
    const results = await Promise.all(keys.map(k => loadCsv(k, { force })));
    const byKey = {};
    keys.forEach((k, i) => byKey[k] = results[i]);
    return byKey;
  }

  /**
   * raw_target_personal có nhiều bảng ghép ngang + header lặp lại (do đóng
   * băng dòng khi export CSV). Bảng ta cần bắt đầu ở cột có header "user name"
   * và chứa "Target AD.Sales (gross)" cùng hàng.
   * Chiến lược: parse thô (header:false) -> tìm hàng header đầu tiên khớp,
   * ghi lại vị trí cột cần -> đọc toàn bộ hàng bên dưới theo đúng vị trí đó,
   * bỏ qua hàng nào cột "shopid" không phải số (tức là header lặp lại hoặc
   * dòng thuộc bảng khác).
   */
  async function loadTargetPersonal({ force = false } = {}) {
    const key = "raw_target_personal";
    const url = CONFIG.SOURCES[key];
    if (!url) return { ok: false, rows: [], reason: "missing_url" };

    const cacheKey = key + "__parsed";
    if (cache[cacheKey] && !force) return cache[cacheKey];

    const bust = force && CONFIG.cacheBustOnManualRefresh ? `${url.includes("?") ? "&" : "?"}_ts=${Date.now()}` : "";
    try {
      const res = await fetch(url + bust, { cache: force ? "no-store" : "default" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const raw = Papa.parse(text, { header: false, skipEmptyLines: false }).data;

      const cols = CONFIG.COLUMNS_TARGET;
      let colIndex = null;

      // Tìm hàng header: có ô "user name" VÀ có ô khớp target_ad_sales_gross
      for (let r = 0; r < raw.length; r++) {
        const row = raw[r];
        const hasUserName = row.some(c => (c || "").trim().toLowerCase() === "user name");
        const hasTargetAdSales = row.includes(cols.target_ad_sales_gross);
        if (hasUserName && hasTargetAdSales) {
          const idx = {};
          row.forEach((cell, i) => {
            const c = (cell || "").trim();
            if (c === "user name") idx.user_name = i;
            if (c === cols.from && idx.from === undefined) idx.from = i;
            if (c === cols.to && idx.to === undefined) idx.to = i;
            if (c === cols.shop_id) idx.shop_id = i;
            if (c === cols.target_ado_gross) idx.target_ado_gross = i;
            if (c === cols.target_ad_sales_gross) idx.target_ad_sales_gross = i;
            if (c === cols.target_paid_ads) idx.target_paid_ads = i;
            if (c === cols.offsite_target_m0) idx.offsite_target_m0 = i;
            if (c === cols.seller_content_target_m0) idx.seller_content_target_m0 = i;
          });
          colIndex = idx;
          break;
        }
      }

      if (!colIndex) {
        const result = { ok: false, rows: [], reason: "header_not_found" };
        cache[cacheKey] = result;
        return result;
      }

      const rows = [];
      for (const row of raw) {
        const shopIdRaw = row[colIndex.shop_id];
        const shopId = cleanNumber(shopIdRaw);
        if (shopId === null) continue; // bỏ header lặp lại / dòng rỗng / dòng bảng khác
        rows.push({
          user_name: row[colIndex.user_name],
          from: row[colIndex.from],
          to: row[colIndex.to],
          shop_id: shopId,
          target_ado_gross: cleanNumber(row[colIndex.target_ado_gross]),
          target_ad_sales_gross: cleanNumber(row[colIndex.target_ad_sales_gross]),
          target_paid_ads: cleanNumber(row[colIndex.target_paid_ads]),
          offsite_target_m0: cleanNumber(row[colIndex.offsite_target_m0]),
          seller_content_target_m0: cleanNumber(row[colIndex.seller_content_target_m0]),
        });
      }

      const result = { ok: true, rows, loadedAt: new Date() };
      cache[cacheKey] = result;
      return result;
    } catch (err) {
      console.error("[DataLoader] Lỗi parse raw_target_personal:", err);
      return { ok: false, rows: [], reason: "fetch_error", error: err };
    }
  }

  /**
   * raw_MSP tracking: pivot table, mỗi shop 1 dòng, các cột lặp lại theo
   * pattern "MSP <Mon-YY>" (tên gói) rồi thường theo sau là "RM KPI"
   * (revenue VNĐ) — nhưng không đều 100% qua các tháng (một số tháng chỉ có
   * tên gói, không có cột revenue). Parser quét header để tự dò cặp cột.
   * Trả về mảng long-format: [{shop_id, username, month, package, revenue}]
   */
  async function loadMspTracking({ force = false } = {}) {
    const key = "raw_msp_tracking";
    const url = CONFIG.SOURCES[key];
    if (!url) return { ok: false, rows: [] };
    const cacheKey = key + "__parsed";
    if (cache[cacheKey] && !force) return cache[cacheKey];

    try {
      const res = await fetch(url + (force ? `?_ts=${Date.now()}` : ""), { cache: force ? "no-store" : "default" });
      const text = await res.text();
      const raw = Papa.parse(text, { header: false, skipEmptyLines: false }).data;
      const header = raw[0];
      const dataRows = raw.slice(1);

      // Tìm cột shop_id (Shop ID) và username
      const shopIdCol = header.findIndex(h => (h || "").trim().toLowerCase() === "shop id");
      const usernameCol = header.findIndex(h => (h || "").trim().toLowerCase() === "username");

      // Dò các cột "MSP <thang>" hoặc "MSP KPI <thang>"
      const monthCols = [];
      header.forEach((h, i) => {
        const m = (h || "").match(/^MSP(?:\s*KPI)?\s+([A-Za-z]{3}-\d{2})$/);
        if (m) {
          // cột revenue: cột kế tiếp nếu header là "RM KPI", else null
          const nextIsRevenue = (header[i + 1] || "").trim() === "RM KPI";
          monthCols.push({ month: m[1], packageCol: i, revenueCol: nextIsRevenue ? i + 1 : null });
        }
      });

      const out = [];
      dataRows.forEach(row => {
        if (!row || row.length === 0) return;
        const shopId = shopIdCol >= 0 ? cleanNumber(row[shopIdCol]) : null;
        if (shopId === null) return;
        const username = usernameCol >= 0 ? row[usernameCol] : null;
        monthCols.forEach(mc => {
          const pkg = (row[mc.packageCol] || "").trim();
          if (!pkg) return;
          const revenue = mc.revenueCol !== null ? cleanNumber(row[mc.revenueCol]) : null;
          out.push({ shop_id: shopId, username, month: mc.month, package: pkg, revenue_vnd: revenue });
        });
      });

      const result = { ok: true, rows: out, loadedAt: new Date() };
      cache[cacheKey] = result;
      return result;
    } catch (err) {
      console.error("[DataLoader] Lỗi parse raw_msp_tracking:", err);
      return { ok: false, rows: [], reason: "fetch_error", error: err };
    }
  }

  /**
   * tracking program_query — header thật nằm ở dòng có ô "Shop ID". Các cột
   * chương trình có tên dạng "{Metric}_{TênProgram}" (chứa dấu "_"), giá trị
   * 1/0 đọc trực tiếp tại cột đó (bỏ qua cột text log liền kề).
   * Trả về { ok, columns: [{label, colIndex}], byShop: { shopId: {label: bool} } }
   */
  async function loadProgramTracking({ force = false } = {}) {
    const key = "tracking_program_query";
    const url = CONFIG.SOURCES[key];
    if (!url) return { ok: false, columns: [], byShop: {} };
    const cacheKey = key + "__parsed";
    if (cache[cacheKey] && !force) return cache[cacheKey];

    try {
      const res = await fetch(url + (force ? `?_ts=${Date.now()}` : ""), { cache: force ? "no-store" : "default" });
      const text = await res.text();
      const raw = Papa.parse(text, { header: false, skipEmptyLines: false }).data;

      let headerRowIdx = -1, shopIdCol = -1;
      for (let r = 0; r < raw.length; r++) {
        const idx = raw[r].findIndex(c => (c || "").trim().toLowerCase() === "shop id");
        if (idx >= 0) { headerRowIdx = r; shopIdCol = idx; break; }
      }
      if (headerRowIdx === -1) {
        const result = { ok: false, columns: [], byShop: {}, reason: "header_not_found" };
        cache[cacheKey] = result;
        return result;
      }

      const header = raw[headerRowIdx];
      const columns = [];
      header.forEach((h, i) => {
        const label = (h || "").trim();
        if (label.includes("_") && i !== shopIdCol) columns.push({ label, colIndex: i });
      });

      const byShop = {};
      raw.slice(headerRowIdx + 1).forEach(row => {
        const shopId = cleanNumber(row[shopIdCol]);
        if (shopId === null) return;
        const flags = {};
        columns.forEach(c => {
          const v = cleanNumber(row[c.colIndex]);
          flags[c.label] = v !== null && v >= 1;
        });
        byShop[shopId] = flags;
      });

      const result = { ok: true, columns, byShop, loadedAt: new Date() };
      cache[cacheKey] = result;
      return result;
    } catch (err) {
      console.error("[DataLoader] Lỗi parse tracking_program_query:", err);
      return { ok: false, columns: [], byShop: {}, reason: "fetch_error", error: err };
    }
  }

  return { loadCsv, loadAll, loadTargetPersonal, loadMspTracking, loadProgramTracking, cleanNumber, _cache: cache };
})();
