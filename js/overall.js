/**
 * Overall Performance tab
 * Nguồn: raw_seller_performance (MTD + LM đã tính sẵn) + raw_target_personal (target)
 */

const OverallTab = (() => {

  const C = CONFIG.COLUMNS_SELLER_PERF;

  function fmt(v, unit) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    if (unit === "currency") return "$" + Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 });
    if (unit === "vnd") return Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 }) + "₫";
    if (unit === "pct") return (Number(v) * 100).toFixed(1) + "%";
    return Number(v).toLocaleString("en-US", { maximumFractionDigits: 1 });
  }
  function fmtPct(p) {
    if (p === null || p === undefined || isNaN(p)) return "—";
    return (p * 100).toFixed(0) + "%";
  }
  function statusBadge(pct) {
    const s = KpiEngine.statusOf(pct);
    const map = { good: ["Đạt", "badge-good"], watch: ["Cần theo dõi", "badge-watch"], risk: ["Rủi ro", "badge-risk"], unknown: ["—", ""] };
    const [txt, cls] = map[s];
    return `<span class="badge ${cls}">${txt}</span>`;
  }

  function renderPlaceholderCard(label, reason) {
    return `
      <div class="metric-card">
        <div class="m-label">${label}</div>
        <div class="m-value muted" style="font-size:16px">Chưa có dữ liệu</div>
        <div class="m-rows"><div class="m-row"><span class="muted">${reason || ""}</span></div></div>
      </div>`;
  }

  // MSP — chưa có cột nguồn trong raw_seller_performance, cho phép nhập tay
  // MTD + Target, lưu vào localStorage (theo trình duyệt hiện tại).
  const MSP_STORE_KEY = "msp_manual_input_v1";
  function getMspInput() {
    try { return JSON.parse(localStorage.getItem(MSP_STORE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function setMspInput(data) {
    try { localStorage.setItem(MSP_STORE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  function renderMspCard() {
    const saved = getMspInput();
    const mtd = saved.mtd ?? "";
    const target = saved.target ?? "";
    const pct = (saved.mtd && saved.target) ? saved.mtd / saved.target : null;
    return `
      <div class="metric-card" id="mspCard">
        <div class="m-label">MSP (Marketing Solution Packages)</div>
        <div class="m-value">${fmt(saved.mtd ?? null, "currency")}</div>
        <div class="m-rows">
          <div class="m-row">
            <span class="muted">MTD ($) — nhập tay</span>
            <input type="number" id="mspMtdInput" value="${mtd}" placeholder="vd 12000" style="width:90px;padding:3px 6px;border:1px solid var(--border);border-radius:6px;font-size:12px">
          </div>
          <div class="m-row">
            <span class="muted">Target ($) — nhập tay*</span>
            <input type="number" id="mspTargetInput" value="${target}" placeholder="vd 15000" style="width:90px;padding:3px 6px;border:1px solid var(--border);border-radius:6px;font-size:12px">
          </div>
          <div class="m-row">
            <span class="muted">% đạt target</span>
            <span>${fmtPct(pct)} ${statusBadge(pct)}</span>
          </div>
        </div>
        <div class="small muted" style="margin-top:6px">*Chưa có cột MSP target trong raw_target_personal — tạm nhập tay, sẽ tự động khi có cột nguồn.</div>
      </div>`;
  }

  function wireMspInputs() {
    const mtdInput = document.getElementById("mspMtdInput");
    const targetInput = document.getElementById("mspTargetInput");
    if (!mtdInput) return;
    const save = () => {
      setMspInput({
        mtd: mtdInput.value ? parseFloat(mtdInput.value) : null,
        target: targetInput.value ? parseFloat(targetInput.value) : null,
      });
      document.getElementById("metricGrid").querySelector("#mspCard").outerHTML = renderMspCard();
      wireMspInputs();
    };
    mtdInput.addEventListener("change", save);
    targetInput.addEventListener("change", save);
  }

  function renderMetricCard(label, mtd, mom, pctTarget, unit) {
    return `
      <div class="metric-card">
        <div class="m-label">${label}</div>
        <div class="m-value">${fmt(mtd, unit)}</div>
        <div class="m-rows">
          <div class="m-row">
            <span class="muted">So với cùng kỳ tháng trước</span>
            <span class="m-tag ${mom === null ? "" : (mom >= 0 ? "tag-good" : "tag-risk")}">${mom === null ? "—" : (mom >= 0 ? "▲" : "▼") + Math.abs(mom * 100).toFixed(1) + "%"}</span>
          </div>
          <div class="m-row">
            <span class="muted">% đạt target</span>
            <span>${fmtPct(pctTarget)} ${statusBadge(pctTarget)}</span>
          </div>
        </div>
      </div>`;
  }

  // Nếu AppState.selectedMonth được set (từ dropdown "Kỳ báo cáo"), ưu tiên
  // lọc theo tháng đó; mặc định (chưa chọn) vẫn dùng tháng mới nhất theo end_date.
  function aggregateSellerPerf(rows) {
    let current;
    const selectedMonth = window.AppState && window.AppState.selectedMonth;
    if (selectedMonth) {
      current = rows.filter(r => r[C.month] === selectedMonth);
    } else {
      let latestEnd = null;
      rows.forEach(r => {
        const d = new Date(r[C.end_date]);
        if (!isNaN(d) && (!latestEnd || d > latestEnd)) latestEnd = d;
      });
      current = latestEnd ? rows.filter(r => new Date(r[C.end_date]).getTime() === latestEnd.getTime()) : rows;
    }

    const sum = (col) => current.reduce((s, r) => s + (DataLoader.cleanNumber(r[col]) || 0), 0);

    return {
      rowCount: current.length,
      adgmv: sum(C.adgmv),
      adgLm: sum(C.adg_lm),
      ado: sum(C.ado),
      adoLm: sum(C.ado_lm),
      paidAdsDaily: sum(C.daily_paidads_expense),
      paidAdsDailyLm: sum(C.ads_expense_lm),
      days: current.length ? (DataLoader.cleanNumber(current[0][C.days]) || 1) : 1,
      offsite: sum(C.ams_aff_commission),
      offsiteLm: sum(C.offsite_expense_lm),
      videoAdo: sum(C.ado_from_seller_video),
      liveAdo: sum(C.ado_from_livestream),
    };
  }

  function aggregateTargets(targetRows) {
    const byShop = {};
    targetRows.forEach(r => {
      const prev = byShop[r.shop_id];
      const toDate = new Date(r.to);
      if (!prev || new Date(prev.to) < toDate) byShop[r.shop_id] = r;
    });
    let sumAdSales = 0, sumPaidAds = 0, sumOffsite = 0, sumContent = 0, n = 0;
    Object.values(byShop).forEach(r => {
      sumAdSales += r.target_ad_sales_gross || 0;
      sumPaidAds += r.target_paid_ads || 0;
      sumOffsite += r.offsite_target_m0 || 0;
      sumContent += r.seller_content_target_m0 || 0;
      n++;
    });
    return { sumAdSales, sumPaidAds, sumOffsite, sumContent, n };
  }

  async function render() {
    const grid = document.getElementById("metricGrid");
    const rmKpi = await DataLoader.loadCsv("raw_rm_kpi");
    const K = CONFIG.COLUMNS_RM_KPI;

    if (!rmKpi.ok || rmKpi.rows.length === 0) {
      grid.innerHTML = renderPlaceholderCard("ADG (AD.GMV)", "raw_rm_kpi chưa tải được")
        + renderPlaceholderCard("ADO", "raw_rm_kpi chưa tải được")
        + renderPlaceholderCard("Paid ads expense", "raw_rm_kpi chưa tải được")
        + renderPlaceholderCard("Offsite expense", "raw_rm_kpi chưa tải được")
        + renderPlaceholderCard("Content ADO", "raw_rm_kpi chưa tải được")
        + renderPlaceholderCard("Winning ADO coverage", "raw_rm_kpi chưa tải được")
        + renderMspCard();
      setSyncStatus("error");
      await renderOosTable();
      return;
    }

    // Dòng tổng toàn ngành hàng: shop_id = "Total"
    const total = rmKpi.rows.find(r => r[K.shop_id] === "Total") || rmKpi.rows[0];

    const cards = [];
    // Ghi chú: raw_RM KPI hiện chỉ có 1 tháng dữ liệu -> chưa có cột LM/gap,
    // nên "So với cùng kỳ tháng trước" tạm để "—" cho tới khi sheet có thêm lịch sử.
    cards.push(renderMetricCard("ADG (AD.GMV)", DataLoader.cleanNumber(total[K.mtd_sale]), null, DataLoader.cleanNumber(total[K.pct_gmv_achieved]), "vnd"));
    cards.push(renderMetricCard("ADO", DataLoader.cleanNumber(total[K.mtd_ado]), null, DataLoader.cleanNumber(total[K.pct_ado_achieved]), "number"));
    cards.push(renderMetricCard("Paid ads expense", DataLoader.cleanNumber(total[K.mtd_paid_ads]), null, DataLoader.cleanNumber(total[K.pct_paid_ads_achieved]), "vnd"));
    cards.push(renderMetricCard("Offsite expense", DataLoader.cleanNumber(total[K.actual_offsite]), null, DataLoader.cleanNumber(total[K.pct_offsite_achieved]), "vnd"));
    cards.push(renderMetricCard("Content ADO (Video + Livestream)", DataLoader.cleanNumber(total[K.mtd_content_ado]), null, DataLoader.cleanNumber(total[K.pct_content_ado_achieved]), "number"));
    cards.push(renderMetricCard("Winning ADO coverage", DataLoader.cleanNumber(total[K.winning_ado_coverage]), null, DataLoader.cleanNumber(total[K.pct_winning_ado_achieved]), "pct"));
    cards.push(renderMspCard());

    grid.innerHTML = cards.join("");
    wireMspInputs();
    document.getElementById("mtdRangeLabel").textContent = `${rmKpi.rows.length - 1} seller · nguồn raw_RM KPI`;
    setSyncStatus("ok");

    await renderOosTable();
    await renderTrafficTables();
    await renderMetricRiskyTable("adg");
    await renderKpiRiskyTable();
  }

  // OOS Alert (đã xác nhận): current_stock <= 10 AND model_status = 1,
  // top-down theo adgmv, chỉ lấy model thuộc kỳ tháng hiện tại
  // (start_date = ngày đầu tháng hiện tại, tức EOMONTH(TODAY(),-1)+1).
  async function renderOosTable() {
    const tbody = document.querySelector("#oosTable tbody");
    const model = await DataLoader.loadCsv("raw_model_performance");
    const M = CONFIG.COLUMNS_MODEL_PERF;

    if (!model.ok || model.rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-row">Chờ raw_model_performance</td></tr>`;
      return;
    }

    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const rows = model.rows
      .filter(r => {
        const sd = new Date(r[M.start_date]);
        return !isNaN(sd) && sd.getFullYear() === firstOfMonth.getFullYear() && sd.getMonth() === firstOfMonth.getMonth();
      })
      .map(r => ({
        model: r[M.model_name] || r[M.model_id],
        seller: r[M.seller_name],
        adg: DataLoader.cleanNumber(r[M.adgmv]),
        stock: DataLoader.cleanNumber(r[M.current_stock]),
        status: DataLoader.cleanNumber(r[M.model_status]),
      }))
      .filter(r => r.stock !== null && r.stock <= CONFIG.OOS_STOCK_THRESHOLD && r.status === 1 && r.adg !== null)
      .sort((a, b) => b.adg - a.adg)
      .slice(0, 10);

    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-row">Không có model nào thoả điều kiện OOS (stock ≤ ${CONFIG.OOS_STOCK_THRESHOLD}, model_status=1, tháng hiện tại)</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td title="${r.model}">${(r.model || "").slice(0, 40)}</td>
        <td>${r.seller}</td>
        <td>$${r.adg.toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
        <td><span class="badge badge-risk">${r.stock}</span></td>
      </tr>`).join("");
  }

  // ============================================================
  // Top 10 Risky — By Metric/Program: seller có LM cao nhất nhưng đang
  // drop MoM. ADG/Ads/Offsite dùng cột gap_lm_* có sẵn. Content ADO tự
  // tính theo tháng (video+livestream). Winning SKU ADO cần cột lịch sử
  // theo tháng trong bidding sheet (chưa có) — báo rõ giới hạn.
  // ============================================================
  const METRIC_RISK_CONFIG = {
    adg:          { label: "ADG",             lmCol: C.adg_lm,             gapCol: C.gap_lm_adg,            unit: "currency", suggestKey: "adg" },
    ads_expense:  { label: "Ads expense",     lmCol: C.ads_expense_lm,     gapCol: C.gap_lm_ads_expense,     unit: "currency", suggestKey: "paid_ads" },
    offsite:      { label: "Offsite expense", lmCol: C.offsite_expense_lm, gapCol: C.gap_lm_offsite,         unit: "currency", suggestKey: "offsite" },
  };

  async function renderMetricRiskyTable(metricKey) {
    const tbody = document.querySelector("#riskyMetricTable tbody");

    if (metricKey === "content_ado") return renderContentAdoRiskyTable(tbody);
    if (metricKey === "winning_ado") {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-row">Winning SKU ADO = model_win_ado (bidding shop pfm) — sheet bidding hiện là 1 snapshot, chưa có cột tháng để tính MoM. Cần bidding sheet có lịch sử theo tháng để bổ sung bảng này.</td></tr>`;
      return;
    }

    const cfg = METRIC_RISK_CONFIG[metricKey];
    if (!cfg) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-row">Metric này cần công thức LM cụ thể hơn.</td></tr>`;
      return;
    }
    const seller = await DataLoader.loadCsv("raw_seller_performance");
    if (!seller.ok) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-row">Chờ raw_seller_performance</td></tr>`;
      return;
    }

    // FIX: chỉ lấy tháng mới nhất — trước đây map toàn bộ rows (mọi tháng)
    // khiến 1 seller xuất hiện nhiều lần (mỗi tháng 1 dòng).
    let latestEnd = null;
    seller.rows.forEach(r => { const d = new Date(r[C.end_date]); if (!isNaN(d) && (!latestEnd || d > latestEnd)) latestEnd = d; });
    const current = seller.rows.filter(r => new Date(r[C.end_date]).getTime() === (latestEnd ? latestEnd.getTime() : NaN));

    const rows = current
      .map(r => ({
        seller: r[C.seller_name],
        shopId: r[C.shop_id],
        lm: DataLoader.cleanNumber(r[cfg.lmCol]),
        gap: DataLoader.cleanNumber(r[cfg.gapCol]),
      }))
      .filter(r => r.lm !== null && r.gap !== null && r.gap < 0)
      .sort((a, b) => b.lm - a.lm)
      .slice(0, 10);

    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-row">Không có seller nào thoả điều kiện drop MoM cho ${cfg.label}</td></tr>`;
      return;
    }

    const rowsHtml = await Promise.all(rows.map(async (r, i) => {
      const mtd = r.lm + r.gap;
      const suggestion = await SuggestionEngine.suggestionText(cfg.suggestKey, r.shopId);
      return `
      <tr>
        <td>${i + 1}</td>
        <td>${r.seller}</td>
        <td>—</td>
        <td>${fmt(r.lm, cfg.unit)}</td>
        <td>${fmt(mtd, cfg.unit)}</td>
        <td class="tag-risk">${fmt(r.gap, cfg.unit)}</td>
        <td>${suggestion}</td>
      </tr>`;
    }));
    tbody.innerHTML = rowsHtml.join("");
  }

  // Content ADO = ado_from_seller_video + ado_from_livestream, tự tính MoM
  // theo tháng có sẵn trong raw_seller_performance (giống Traffic alert).
  async function renderContentAdoRiskyTable(tbody) {
    const seller = await DataLoader.loadCsv("raw_seller_performance");
    if (!seller.ok) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-row">Chờ raw_seller_performance</td></tr>`;
      return;
    }
    const months = [...new Set(seller.rows.map(r => r[C.month]))].sort((a, b) => Number(a) - Number(b));
    const latest = months[months.length - 1];
    const prevM = months[months.length - 2];

    function contentBy(month) {
      const map = {};
      seller.rows.filter(r => r[C.month] === month).forEach(r => {
        const val = (DataLoader.cleanNumber(r[C.ado_from_seller_video]) || 0) + (DataLoader.cleanNumber(r[C.ado_from_livestream]) || 0);
        map[r[C.shop_id]] = { value: val, name: r[C.seller_name] };
      });
      return map;
    }

    const curMap = contentBy(latest);
    const lmMap = prevM ? contentBy(prevM) : {};

    const rows = Object.keys(lmMap)
      .map(shopId => {
        const lm = lmMap[shopId].value;
        const cur = curMap[shopId] ? curMap[shopId].value : 0;
        const gapPct = lm ? (cur - lm) / lm : null;
        return { seller: lmMap[shopId].name, shopId, lm, cur, gapPct };
      })
      .filter(r => r.lm > 0 && r.gapPct !== null && r.gapPct < 0)
      .sort((a, b) => b.lm - a.lm)
      .slice(0, 10);

    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-row">Không có seller nào drop Content ADO MoM</td></tr>`;
      return;
    }

    const rowsHtml = await Promise.all(rows.map(async (r, i) => {
      const suggestion = await SuggestionEngine.suggestionText("content_ado", r.shopId);
      return `
      <tr>
        <td>${i + 1}</td>
        <td>${r.seller}</td>
        <td>—</td>
        <td>${fmt(r.lm, "number")}</td>
        <td>${fmt(r.cur, "number")}</td>
        <td class="tag-risk">${fmt(r.cur - r.lm, "number")}</td>
        <td>${suggestion}</td>
      </tr>`;
    }));
    tbody.innerHTML = rowsHtml.join("");
  }

  // ============================================================
  // Top 10 Risky — By KPI & Seller
  // Rule (đã xác nhận): seller phải nằm TOP theo target ở TỪNG metric
  // riêng lẻ (không phải tổng target) — dùng ngưỡng top 30% theo target
  // mỗi metric (có thể chỉnh TOP_TARGET_PERCENTILE bên dưới). Trong nhóm
  // "top target ở mọi metric" đó, sort theo KPI weighted score tăng dần,
  // lấy 10 seller thấp điểm nhất.
  // ============================================================
  const TOP_TARGET_PERCENTILE = 0.3; // top 30% theo target mỗi metric

  function topShopIdsByTarget(targetByShop, field, percentile) {
    const entries = Object.entries(targetByShop)
      .map(([shopId, t]) => [shopId, t[field]])
      .filter(([, v]) => v !== null && v !== undefined && v > 0)
      .sort((a, b) => b[1] - a[1]);
    const cutoff = Math.max(1, Math.ceil(entries.length * percentile));
    return new Set(entries.slice(0, cutoff).map(([shopId]) => shopId));
  }

  async function renderKpiRiskyTable() {
    const tbody = document.querySelector("#riskySellerTable tbody");
    const rmKpi = await DataLoader.loadCsv("raw_rm_kpi");
    const K = CONFIG.COLUMNS_RM_KPI;

    if (!rmKpi.ok) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-row">Chờ raw_rm_kpi</td></tr>`;
      return;
    }

    // Bỏ dòng "Total" — chỉ xét từng seller
    const sellers = rmKpi.rows.filter(r => r[K.shop_id] && r[K.shop_id] !== "Total");

    // "target cao nhất ở TỪNG metric riêng lẻ" — seller phải nằm top 30% theo
    // target ở CẢ 5 metric: AD.GMV, Paid ads, Offsite, Content ADO, Winning ADO
    const targetFields = {
      ad_gmv: K.target_adgmv_vnd,
      paid_ads: K.target_paid_ads_spending_vnd,
      offsite: K.target_offsite_spendings,
      content_ado: K.target_content_ado_contribution,
      winning_sku_ado: K.target_winning_sku_ado_coverage,
    };
    const topSets = {};
    Object.entries(targetFields).forEach(([key, col]) => {
      const entries = sellers
        .map(r => [r[K.shop_id], DataLoader.cleanNumber(r[col])])
        .filter(([, v]) => v !== null && v > 0)
        .sort((a, b) => b[1] - a[1]);
      const cutoff = Math.max(1, Math.ceil(entries.length * TOP_TARGET_PERCENTILE));
      topSets[key] = new Set(entries.slice(0, cutoff).map(([id]) => id));
    });

    const results = [];
    sellers.forEach(r => {
      const shopId = r[K.shop_id];
      const isTop = Object.values(topSets).every(set => set.has(shopId));
      if (!isTop) return;

      // Công thức đã xác nhận: score = Σ (%reach target metric × weightage),
      // dùng thẳng pct_*_achieved đã tính sẵn trong sheet.
      const pctByMetric = {
        ad_gmv:          DataLoader.cleanNumber(r[K.pct_gmv_achieved]),
        paid_ads:        DataLoader.cleanNumber(r[K.pct_paid_ads_achieved]),
        offsite:         DataLoader.cleanNumber(r[K.pct_offsite_achieved]),
        content_ado:     DataLoader.cleanNumber(r[K.pct_content_ado_achieved]),
        winning_sku_ado: DataLoader.cleanNumber(r[K.pct_winning_ado_achieved]),
      };

      const { weightedScore, breakdown } = KpiEngine.computeWeightedScore(pctByMetric);
      const weakest = KpiEngine.weakestMetric(breakdown);

      results.push({
        seller: r[K.username], shopId, rm: r[K.rm], groupCat: r[K.group_cat],
        targetAdSales: DataLoader.cleanNumber(r[K.target_adgmv_vnd]),
        score: weightedScore, weakest,
      });
    });

    if (results.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-row">Không có seller nào nằm top ${(TOP_TARGET_PERCENTILE*100).toFixed(0)}% target ở CẢ 5 metric (ADG, Paid ads, Offsite, Content ADO, Winning ADO)</td></tr>`;
      return;
    }

    results.sort((a, b) => (a.score ?? 999) - (b.score ?? 999));
    const top10 = results.slice(0, 10);

    const rowsHtml = await Promise.all(top10.map(async (r, i) => {
      const suggestion = r.weakest ? await SuggestionEngine.suggestionText(r.weakest.key === "ad_gmv" ? "adg" : r.weakest.key, r.shopId) : "—";
      return `
      <tr>
        <td>${i + 1}</td>
        <td>${r.seller}</td>
        <td>${r.rm || "—"}</td>
        <td>${r.groupCat || "—"}</td>
        <td>${(r.targetAdSales || 0).toLocaleString("en-US",{maximumFractionDigits:0})}₫</td>
        <td><span class="score-pill ${r.score < 80 ? 'tag-risk' : 'tag-watch'}">${r.score === null ? "—" : r.score.toFixed(0)}</span></td>
        <td>${r.weakest ? r.weakest.label : "—"}</td>
        <td>${suggestion}</td>
      </tr>`;
    }));
    tbody.innerHTML = rowsHtml.join("");
  }
  // raw_item_performance, so sánh tháng mới nhất vs tháng liền trước.
  // ============================================================
  async function renderTrafficTables() {
    const I = CONFIG.COLUMNS_ITEM_PERF;
    const item = await DataLoader.loadCsv("raw_item_performance");
    const shopTbody = document.querySelector("#shopTrafficTable tbody");
    const skuTbody = document.querySelector("#skuTrafficTable tbody");

    if (!item.ok || item.rows.length === 0) {
      shopTbody.innerHTML = `<tr><td colspan="3" class="empty-row">Chờ raw_item_performance</td></tr>`;
      skuTbody.innerHTML = `<tr><td colspan="3" class="empty-row">Chờ raw_item_performance</td></tr>`;
      return;
    }

    // Xác định 2 tháng gần nhất theo end_date
    const months = [...new Set(item.rows.map(r => r[I.month]))].sort((a, b) => Number(a) - Number(b));
    const latest = months[months.length - 1];
    const prev = months[months.length - 2];

    // ---- Shop Traffic: sum DUV theo shop_id, so latest vs prev ----
    function sumBy(keyFn, month) {
      const map = {};
      item.rows.filter(r => r[I.month] === month).forEach(r => {
        const k = keyFn(r);
        map[k] = (map[k] || 0) + (DataLoader.cleanNumber(r[I.daily_unique_view_users]) || 0);
      });
      return map;
    }

    const shopLatest = sumBy(r => r[I.shop_id], latest);
    const shopPrev = prev ? sumBy(r => r[I.shop_id], prev) : {};
    const shopRows = Object.keys(shopLatest)
      .map(shopId => {
        const lm = shopPrev[shopId] || null;
        const cur = shopLatest[shopId];
        return { shopId, lm, momPct: lm ? (cur - lm) / lm : null };
      })
      .filter(r => r.lm !== null && r.momPct < 0)
      .sort((a, b) => b.lm - a.lm)
      .slice(0, 10);

    shopTbody.innerHTML = shopRows.length
      ? shopRows.map(r => `<tr><td>${r.shopId}</td><td>${r.lm.toLocaleString("en-US",{maximumFractionDigits:0})}</td><td class="tag-risk">${(r.momPct*100).toFixed(1)}%</td></tr>`).join("")
      : `<tr><td colspan="3" class="empty-row">Không có shop nào drop DUV MoM</td></tr>`;

    // ---- SKU Traffic: sum DUV theo item_id ----
    const skuLatest = sumBy(r => r[I.item_id], latest);
    const skuPrev = prev ? sumBy(r => r[I.item_id], prev) : {};
    const skuRows = Object.keys(skuLatest)
      .map(itemId => {
        const lm = skuPrev[itemId] || null;
        const cur = skuLatest[itemId];
        return { itemId, lm, momPct: lm ? (cur - lm) / lm : null };
      })
      .filter(r => r.lm !== null && r.momPct < 0)
      .sort((a, b) => b.lm - a.lm)
      .slice(0, 10);

    skuTbody.innerHTML = skuRows.length
      ? skuRows.map(r => `<tr><td>${r.itemId}</td><td>${r.lm.toLocaleString("en-US",{maximumFractionDigits:0})}</td><td class="tag-risk">${(r.momPct*100).toFixed(1)}%</td></tr>`).join("")
      : `<tr><td colspan="3" class="empty-row">Không có SKU nào drop DUV MoM</td></tr>`;
  }

  function setSyncStatus(state) {
    const dot = document.querySelector("#syncStatus .dot");
    const txt = document.getElementById("syncStatusText");
    if (state === "ok") {
      dot.className = "dot dot-ok";
      txt.textContent = "Đã đồng bộ · " + new Date().toLocaleTimeString("vi-VN");
    } else if (state === "partial") {
      dot.className = "dot dot-pending";
      txt.textContent = "Thiếu raw_target_personal hoặc raw_item_performance / program_structure";
    } else {
      dot.className = "dot dot-error";
      txt.textContent = "Lỗi đồng bộ dữ liệu";
    }
  }

  return { render, aggregateSellerPerf, renderMetricRiskyTable, renderKpiRiskyTable };
})();
