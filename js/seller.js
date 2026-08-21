/**
 * Seller Performance tab
 * - 5 card cốt lõi: raw_RM KPI theo shop_id (đúng yêu cầu tách nguồn)
 * - Deep-dive & MoM, benchmark L2/L3, model grow/drop: raw_seller_performance
 *   + raw_model_performance
 * BUG ĐÃ SỬA: dùng DataLoader.parseDate thay vì new Date() trực tiếp (nhiều
 * dòng ngày bị Google export ra dạng serial number khiến parse thất bại
 * âm thầm → bảng trống).
 */

const SellerTab = (() => {

  const C = CONFIG.COLUMNS_SELLER_PERF;
  const M = CONFIG.COLUMNS_MODEL_PERF;
  const I = CONFIG.COLUMNS_ITEM_PERF;
  const K = CONFIG.COLUMNS_RM_KPI;
  let trendChart = null;

  function fmt(v, unit) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    if (unit === "currency") return "$" + Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 });
    if (unit === "vnd") return Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 }) + "₫";
    if (unit === "pct") return (Number(v) * 100).toFixed(1) + "%";
    return Number(v).toLocaleString("en-US", { maximumFractionDigits: 1 });
  }

  function statusBadge(pct) {
    const s = KpiEngine.statusOf(pct);
    const map = { good: ["Đạt", "badge-good"], watch: ["Cần theo dõi", "badge-watch"], risk: ["Rủi ro", "badge-risk"], unknown: ["—", ""] };
    const [txt, cls] = map[s];
    return `<span class="badge ${cls}">${txt}</span>`;
  }

  async function populateSellerSelect() {
    const sel = document.getElementById("sellerSelect");
    const seller = await DataLoader.loadCsv("raw_seller_performance");
    if (!seller.ok || seller.rows.length === 0) {
      sel.innerHTML = `<option value="">Chưa có dữ liệu — xem js/config.js</option>`;
      return null;
    }
    const seen = new Set();
    const opts = [];
    seller.rows.forEach(r => {
      const id = r[C.shop_id];
      if (!id || seen.has(id)) return;
      seen.add(id);
      opts.push({ id, name: r[C.seller_name] || id });
    });
    sel.innerHTML = opts.map(o => `<option value="${o.id}">${o.name} (${o.id})</option>`).join("");
    return opts.length ? opts[0].id : null;
  }

  async function renderSellerRmKpi(shopId) {
    const grid = document.getElementById("sellerRmKpiGrid");
    const rmKpi = await DataLoader.loadCsv("raw_rm_kpi");
    if (!rmKpi.ok) { grid.innerHTML = `<p class="empty-row">Chờ raw_rm_kpi</p>`; return; }

    const row = rmKpi.rows.find(r => r[K.shop_id] === shopId);
    if (!row) {
      grid.innerHTML = `<div class="card table-card"><p class="empty-row">Không tìm thấy shop_id này trong raw_rm_kpi</p></div>`;
      return;
    }

    const defs = [
      { label: "ADG (AD.GMV)", v: DataLoader.cleanNumber(row[K.mtd_sale]), pct: DataLoader.cleanNumber(row[K.pct_gmv_achieved]), unit: "vnd" },
      { label: "ADO", v: DataLoader.cleanNumber(row[K.mtd_ado]), pct: DataLoader.cleanNumber(row[K.pct_ado_achieved]), unit: "number" },
      { label: "Paid ads expense", v: DataLoader.cleanNumber(row[K.mtd_paid_ads]), pct: DataLoader.cleanNumber(row[K.pct_paid_ads_achieved]), unit: "vnd" },
      { label: "Offsite expense", v: DataLoader.cleanNumber(row[K.actual_offsite]), pct: DataLoader.cleanNumber(row[K.pct_offsite_achieved]), unit: "vnd" },
      { label: "Content ADO (Video + Livestream)", v: DataLoader.cleanNumber(row[K.mtd_content_ado]), pct: DataLoader.cleanNumber(row[K.pct_content_ado_achieved]), unit: "number" },
      { label: "Winning ADO coverage", v: DataLoader.cleanNumber(row[K.winning_ado_coverage]), pct: DataLoader.cleanNumber(row[K.pct_winning_ado_achieved]), unit: "pct" },
    ];

    grid.innerHTML = defs.map(d => `
      <div class="metric-card">
        <div class="m-label">${d.label}</div>
        <div class="m-value">${fmt(d.v, d.unit)}</div>
        <div class="m-rows">
          <div class="m-row">
            <span class="muted">% đạt target</span>
            <span>${d.pct === null ? "—" : (d.pct * 100).toFixed(0) + "%"} ${statusBadge(d.pct)}</span>
          </div>
        </div>
      </div>`).join("");
  }

  async function renderSellerDeepDive(shopId) {
    const grid = document.getElementById("sellerMetricGrid");
    const seller = await DataLoader.loadCsv("raw_seller_performance");
    if (!seller.ok) { grid.innerHTML = `<p class="empty-row">Chờ raw_seller_performance</p>`; return; }

    const rows = seller.rows.filter(r => r[C.shop_id] === shopId)
      .map(r => ({ row: r, endDate: DataLoader.parseDate(r[C.end_date]) }))
      .filter(x => x.endDate)
      .sort((a, b) => a.endDate - b.endDate);

    if (rows.length === 0) {
      grid.innerHTML = `<div class="card table-card"><p class="empty-row">Không tìm thấy dữ liệu hợp lệ (ngày) cho shop_id này trong raw_seller_performance</p></div>`;
      return;
    }
    const cur = rows[rows.length - 1].row;

    const adgmv = DataLoader.cleanNumber(cur[C.adgmv]);
    const adgLm = DataLoader.cleanNumber(cur[C.adg_lm]);
    const ado = DataLoader.cleanNumber(cur[C.ado]);
    const adoLm = DataLoader.cleanNumber(cur[C.ado_lm]);
    const days = DataLoader.cleanNumber(cur[C.days]) || 1;
    const paidAds = (DataLoader.cleanNumber(cur[C.daily_paidads_expense]) || 0) * days;
    const paidAdsLm = DataLoader.cleanNumber(cur[C.ads_expense_lm]) || 0;
    const offsite = DataLoader.cleanNumber(cur[C.ams_aff_commission]);
    const offsiteLm = DataLoader.cleanNumber(cur[C.offsite_expense_lm]);
    const content = (DataLoader.cleanNumber(cur[C.ado_from_seller_video]) || 0) + (DataLoader.cleanNumber(cur[C.ado_from_livestream]) || 0);

    const cards = [
      { label: "ADG (AD.GMV)", v: adgmv, lm: adgLm, unit: "currency" },
      { label: "ADO", v: ado, lm: adoLm, unit: "number" },
      { label: "Paid ads expense", v: paidAds, lm: paidAdsLm, unit: "currency" },
      { label: "Offsite expense", v: offsite, lm: offsiteLm, unit: "currency" },
      { label: "Content ADO (Video + Livestream)", v: content, lm: null, unit: "number" },
    ];

    grid.innerHTML = cards.map(c => {
      const mom = (c.lm !== null && c.lm !== undefined && c.lm !== 0 && c.v !== null) ? (c.v - c.lm) / c.lm : null;
      return `
      <div class="metric-card">
        <div class="m-label">${c.label}</div>
        <div class="m-value">${fmt(c.v, c.unit)}</div>
        <div class="m-rows">
          <div class="m-row">
            <span class="muted">So với tháng trước</span>
            <span class="m-tag ${mom === null ? "" : (mom >= 0 ? "tag-good" : "tag-risk")}">${mom === null ? "—" : (mom >= 0 ? "▲" : "▼") + Math.abs(mom * 100).toFixed(1) + "%"}</span>
          </div>
        </div>
      </div>`;
    }).join("");

    const canvas = document.getElementById("sellerTrendChart");
    if (canvas) {
      if (trendChart) trendChart.destroy();
      trendChart = new Chart(canvas, {
        type: "line",
        data: {
          labels: rows.map(x => `Tháng ${x.row[C.month]}`),
          datasets: [{ label: "ADG", data: rows.map(x => DataLoader.cleanNumber(x.row[C.adgmv]) || 0), borderColor: "#EE4D2D", backgroundColor: "transparent", tension: 0.3 }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
      });
    }
  }

  async function renderScopedAlerts(shopId) {
    const model = await DataLoader.loadCsv("raw_model_performance");
    const item = await DataLoader.loadCsv("raw_item_performance");

    const oosBody = document.querySelector("#sellerOosTable tbody");
    const skuBody = document.querySelector("#sellerSkuTrafficTable tbody");
    if (!oosBody || !skuBody) return;

    if (model.ok) {
      let latestStart = null;
      model.rows.forEach(r => {
        const sd = DataLoader.parseDate(r[M.start_date]);
        if (sd && (!latestStart || sd > latestStart)) latestStart = sd;
      });
      const rows = model.rows
        .filter(r => r[M.shop_id] === shopId)
        .filter(r => {
          const sd = DataLoader.parseDate(r[M.start_date]);
          return sd && latestStart && sd.getFullYear() === latestStart.getFullYear() && sd.getMonth() === latestStart.getMonth();
        })
        .map(r => ({
          model: r[M.model_name] || r[M.model_id],
          adg: DataLoader.cleanNumber(r[M.adgmv]),
          stock: DataLoader.cleanNumber(r[M.current_stock]),
          status: DataLoader.cleanNumber(r[M.model_status]),
        }))
        .filter(r => r.stock !== null && r.stock <= CONFIG.OOS_STOCK_THRESHOLD && r.status === 1 && r.adg !== null)
        .sort((a, b) => b.adg - a.adg)
        .slice(0, 10);
      oosBody.innerHTML = rows.length
        ? rows.map(r => `<tr><td title="${r.model}">${(r.model||"").slice(0,40)}</td><td>$${r.adg.toLocaleString("en-US",{maximumFractionDigits:0})}</td><td><span class="badge badge-risk">${r.stock}</span></td></tr>`).join("")
        : `<tr><td colspan="3" class="empty-row">Không có model OOS cho seller này</td></tr>`;
    } else {
      oosBody.innerHTML = `<tr><td colspan="3" class="empty-row">Chờ raw_model_performance</td></tr>`;
    }

    if (item.ok) {
      const months = [...new Set(item.rows.map(r => r[I.month]))].sort((a, b) => Number(a) - Number(b));
      const latest = months[months.length - 1], prev = months[months.length - 2];
      const sumBy = (month) => {
        const map = {};
        item.rows.filter(r => r[I.month] === month && r[I.shop_id] === shopId).forEach(r => {
          map[r[I.item_id]] = (map[r[I.item_id]] || 0) + (DataLoader.cleanNumber(r[I.daily_unique_view_users]) || 0);
        });
        return map;
      };
      const curMap = sumBy(latest), lmMap = prev ? sumBy(prev) : {};
      const rows = Object.keys(lmMap)
        .map(itemId => {
          const lm = lmMap[itemId], cur = curMap[itemId] || 0;
          return { itemId, lm, momPct: lm ? (cur - lm) / lm : null };
        })
        .filter(r => r.lm > 0 && r.momPct !== null && r.momPct < 0)
        .sort((a, b) => b.lm - a.lm)
        .slice(0, 10);
      skuBody.innerHTML = rows.length
        ? rows.map(r => `<tr><td>${r.itemId}</td><td>${r.lm.toLocaleString("en-US",{maximumFractionDigits:0})}</td><td class="tag-risk">${(r.momPct*100).toFixed(1)}%</td></tr>`).join("")
        : `<tr><td colspan="3" class="empty-row">Không có SKU drop DUV cho seller này</td></tr>`;
    } else {
      skuBody.innerHTML = `<tr><td colspan="3" class="empty-row">Chờ raw_item_performance</td></tr>`;
    }
  }

  // Benchmark cùng L2 subcategory (seller) — trước đây chưa từng được code
  // (chỉ có UI placeholder). "AI thinking" = so sánh rule-based có cấu trúc
  // + Program structure, vì site tĩnh không gọi được LLM thật.
  async function renderSellerBenchmark(shopId) {
    const box = document.getElementById("sellerBenchmarkInsight");
    if (!box) return;
    const seller = await DataLoader.loadCsv("raw_seller_performance");
    if (!seller.ok) { box.innerHTML = `<p class="empty-row">Chờ raw_seller_performance</p>`; return; }

    const l2Col = (seller.fields || []).includes("level2_global_be_category") ? "level2_global_be_category" : "sub_cat";
    const current = DataLoader.filterLatestByDate(seller.rows, C.end_date).rows;
    const me = current.find(r => r[C.shop_id] === shopId);
    if (!me) { box.innerHTML = `<p class="empty-row">Không tìm thấy seller trong kỳ mới nhất</p>`; return; }

    const myL2 = me[l2Col];
    const peers = current.filter(r => r[l2Col] === myL2 && r[C.shop_id] !== shopId);

    if (!myL2 || peers.length === 0) {
      box.innerHTML = `<p class="empty-row">Không đủ peer cùng L2 subcat ("${myL2 || "—"}") để benchmark</p>`;
      return;
    }

    const metricDefs = [
      { key: "adg", label: "ADG", col: C.adgmv, unit: "currency" },
      { key: "ado", label: "ADO", col: C.ado, unit: "number" },
      { key: "offsite", label: "Offsite expense", col: C.ams_aff_commission, unit: "currency" },
    ];

    const rowsHtml = [];
    const diffs = [];
    for (const d of metricDefs) {
      const myVal = DataLoader.cleanNumber(me[d.col]) || 0;
      const peerVals = peers.map(p => DataLoader.cleanNumber(p[d.col]) || 0);
      const peerAvg = peerVals.reduce((a, b) => a + b, 0) / peerVals.length;
      const diffPct = peerAvg ? (myVal - peerAvg) / peerAvg : null;
      diffs.push({ key: d.key, diff: diffPct || 0 });
      const verdict = diffPct === null ? "—" : diffPct >= 0
        ? `<span class="tag-good">cao hơn TB ${(diffPct*100).toFixed(0)}%</span>`
        : `<span class="tag-risk">thấp hơn TB ${Math.abs(diffPct*100).toFixed(0)}%</span>`;
      rowsHtml.push(`<div class="m-row"><span class="muted">${d.label}</span><span>${fmt(myVal, d.unit)} vs peer TB ${fmt(peerAvg, d.unit)} — ${verdict}</span></div>`);
    }

    const worst = diffs.sort((a, b) => a.diff - b.diff)[0];
    const suggestKeyMap = { adg: "adg", ado: null, offsite: "offsite" };
    const suggestion = worst && suggestKeyMap[worst.key] ? await SuggestionEngine.suggestionText(suggestKeyMap[worst.key], shopId) : null;

    box.innerHTML = `
      <p><strong>${me[C.seller_name]}</strong> — benchmark với ${peers.length} seller cùng L2 subcat "<strong>${myL2}</strong>":</p>
      ${rowsHtml.join("")}
      ${suggestion ? `<p style="margin-top:10px"><strong>Gợi ý cải thiện:</strong> ${suggestion}</p>` : ""}
    `;
  }

  // Model performance — Top grow / Top drop MoM. Sheet mới không còn cột
  // gap/top-grow/top-drop có sẵn -> tự tính bằng cách so 2 tháng gần nhất
  // (theo start_date) cho các model của seller đang chọn.
  async function renderModelGrowDrop(shopId) {
    const growBody = document.querySelector("#modelGrowTable tbody");
    const dropBody = document.querySelector("#modelDropTable tbody");
    if (!growBody || !dropBody) return;

    const model = await DataLoader.loadCsv("raw_model_performance");
    if (!model.ok) {
      growBody.innerHTML = `<tr><td colspan="2" class="empty-row">Chờ raw_model_performance</td></tr>`;
      dropBody.innerHTML = `<tr><td colspan="2" class="empty-row">Chờ raw_model_performance</td></tr>`;
      return;
    }

    const mine = model.rows.filter(r => r[M.shop_id] === shopId);
    const monthKey = (r) => {
      const d = DataLoader.parseDate(r[M.start_date]);
      return d ? `${d.getFullYear()}-${d.getMonth()}` : null;
    };
    const monthKeys = [...new Set(mine.map(monthKey).filter(Boolean))]
      .sort((a, b) => {
        const [ay, am] = a.split("-").map(Number), [by, bm] = b.split("-").map(Number);
        return ay !== by ? ay - by : am - bm;
      });
    const latest = monthKeys[monthKeys.length - 1];
    const prev = monthKeys[monthKeys.length - 2];

    if (!latest || !prev) {
      const msg = `<tr><td colspan="2" class="empty-row">Chưa đủ 2 tháng dữ liệu để tính MoM cho seller này</td></tr>`;
      growBody.innerHTML = msg; dropBody.innerHTML = msg;
      return;
    }

    function byModel(month) {
      const map = {};
      mine.filter(r => monthKey(r) === month).forEach(r => {
        map[r[M.model_id]] = { adg: DataLoader.cleanNumber(r[M.adgmv]) || 0, name: r[M.model_name] || r[M.model_id] };
      });
      return map;
    }
    const curMap = byModel(latest), lmMap = byModel(prev);

    const changes = Object.keys(curMap)
      .filter(id => lmMap[id])
      .map(id => {
        const cur = curMap[id].adg, lm = lmMap[id].adg;
        const pct = lm ? (cur - lm) / lm : null;
        return { model: curMap[id].name, cur, lm, pct };
      })
      .filter(r => r.pct !== null);

    const grow = changes.filter(r => r.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 10);
    const drop = changes.filter(r => r.pct < 0).sort((a, b) => a.pct - b.pct).slice(0, 10);

    growBody.innerHTML = grow.length
      ? grow.map(r => `<tr><td title="${r.model}">${(r.model||"").slice(0,40)}</td><td class="tag-good">▲${(r.pct*100).toFixed(1)}%</td></tr>`).join("")
      : `<tr><td colspan="2" class="empty-row">Không có model nào grow MoM</td></tr>`;
    dropBody.innerHTML = drop.length
      ? drop.map(r => `<tr><td title="${r.model}">${(r.model||"").slice(0,40)}</td><td class="tag-risk">▼${Math.abs(r.pct*100).toFixed(1)}%</td></tr>`).join("")
      : `<tr><td colspan="2" class="empty-row">Không có model nào drop MoM</td></tr>`;
  }

  // Benchmark cùng L3 subcategory (model) — trước đây chưa từng được code.
  async function renderModelBenchmark(shopId) {
    const box = document.getElementById("modelBenchmarkInsight");
    if (!box) return;
    const model = await DataLoader.loadCsv("raw_model_performance");
    if (!model.ok) { box.innerHTML = `<p class="empty-row">Chờ raw_model_performance</p>`; return; }

    const current = DataLoader.filterLatestByDate(model.rows, M.end_date).rows;
    const mine = current.filter(r => r[M.shop_id] === shopId);
    if (mine.length === 0) { box.innerHTML = `<p class="empty-row">Không có model nào trong kỳ mới nhất cho seller này</p>`; return; }

    const l3Groups = {};
    mine.forEach(r => {
      const l3 = r[M.l3_cat] || "—";
      if (!l3Groups[l3]) l3Groups[l3] = [];
      l3Groups[l3].push(r);
    });

    const parts = [];
    for (const l3 of Object.keys(l3Groups)) {
      const myRows = l3Groups[l3];
      const myAvgAdg = myRows.reduce((s, r) => s + (DataLoader.cleanNumber(r[M.adgmv]) || 0), 0) / myRows.length;
      const peerRows = current.filter(r => r[M.l3_cat] === l3 && r[M.shop_id] !== shopId);
      if (peerRows.length === 0) continue;
      const peerAvgAdg = peerRows.reduce((s, r) => s + (DataLoader.cleanNumber(r[M.adgmv]) || 0), 0) / peerRows.length;
      const diffPct = peerAvgAdg ? (myAvgAdg - peerAvgAdg) / peerAvgAdg : null;
      const verdict = diffPct === null ? "—" : diffPct >= 0
        ? `<span class="tag-good">ADG/SKU cao hơn TB ngành ${(diffPct*100).toFixed(0)}%</span>`
        : `<span class="tag-risk">ADG/SKU thấp hơn TB ngành ${Math.abs(diffPct*100).toFixed(0)}%</span>`;
      parts.push(`<div class="m-row"><span class="muted">${l3} (${myRows.length} SKU)</span><span>${verdict}</span></div>`);
    }

    box.innerHTML = parts.length
      ? `<p>Benchmark ADG trung bình/SKU theo L3 subcat, so với các seller khác cùng ngành hàng (kỳ mới nhất):</p>${parts.join("")}`
      : `<p class="empty-row">Không đủ peer cùng L3 subcat để benchmark</p>`;
  }

  function wireSelect() {
    const sel = document.getElementById("sellerSelect");
    sel.addEventListener("change", async () => {
      if (!sel.value) return;
      await renderAll(sel.value);
    });
  }

  async function renderAll(shopId) {
    await renderSellerRmKpi(shopId);
    await renderSellerDeepDive(shopId);
    await renderScopedAlerts(shopId);
    await renderSellerBenchmark(shopId);
    await renderModelGrowDrop(shopId);
    await renderModelBenchmark(shopId);
  }

  async function render() {
    const firstShopId = await populateSellerSelect();
    wireSelect();
    if (firstShopId) await renderAll(firstShopId);
  }

  return { render };
})();
