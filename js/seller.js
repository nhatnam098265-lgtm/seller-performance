/**
 * Seller Performance tab
 * BUG CŨ: dropdown chọn seller không có sự kiện onChange nào cả — card chỉ
 * in sẵn text tĩnh "Chọn seller ở trên", không đọc data thật. Đã sửa: mỗi
 * lần chọn seller, fetch lại raw_seller_performance/raw_model_performance/
 * raw_item_performance và lọc theo shop_id.
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

  // 5 chỉ số cốt lõi — CHỈ dùng raw_RM KPI theo shop_id (đúng yêu cầu:
  // "5 card performance by seller" cũng phải lấy từ raw_RM KPI, không phải
  // raw_seller_performance).
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

  // Deep-dive & MoM — dùng raw_seller_performance (đúng yêu cầu: chỉ phần
  // "deepdive & MoM, detail expense" mới dùng nguồn này).
  async function renderSellerDeepDive(shopId) {
    const grid = document.getElementById("sellerMetricGrid");
    const seller = await DataLoader.loadCsv("raw_seller_performance");
    if (!seller.ok) { grid.innerHTML = ""; return; }

    const rows = seller.rows.filter(r => r[C.shop_id] === shopId)
      .sort((a, b) => new Date(a[C.end_date]) - new Date(b[C.end_date]));
    if (rows.length === 0) {
      grid.innerHTML = `<div class="card table-card"><p class="empty-row">Không tìm thấy dữ liệu cho shop_id này</p></div>`;
      return;
    }
    const cur = rows[rows.length - 1];

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
          labels: rows.map(r => `Tháng ${r[C.month]}`),
          datasets: [{ label: "ADG", data: rows.map(r => DataLoader.cleanNumber(r[C.adgmv]) || 0), borderColor: "#EE4D2D", backgroundColor: "transparent", tension: 0.3 }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
      });
    }
  }

  // OOS + SKU Traffic scoped theo seller (bổ sung theo yêu cầu).
  async function renderScopedAlerts(shopId) {
    const model = await DataLoader.loadCsv("raw_model_performance");
    const item = await DataLoader.loadCsv("raw_item_performance");

    const oosBody = document.querySelector("#sellerOosTable tbody");
    const skuBody = document.querySelector("#sellerSkuTrafficTable tbody");
    if (!oosBody || !skuBody) return;

    if (model.ok) {
      const now = new Date();
      const rows = model.rows
        .filter(r => r[M.shop_id] === shopId)
        .filter(r => {
          const sd = new Date(r[M.start_date]);
          return !isNaN(sd) && sd.getFullYear() === now.getFullYear() && sd.getMonth() === now.getMonth();
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
    }
  }

  function wireSelect() {
    const sel = document.getElementById("sellerSelect");
    sel.addEventListener("change", async () => {
      if (!sel.value) return;
      await renderSellerRmKpi(sel.value);
      await renderSellerDeepDive(sel.value);
      await renderScopedAlerts(sel.value);
    });
  }

  async function render() {
    const firstShopId = await populateSellerSelect();
    wireSelect();
    if (firstShopId) {
      await renderSellerRmKpi(firstShopId);
      await renderSellerDeepDive(firstShopId);
      await renderScopedAlerts(firstShopId);
    }
  }

  return { render };
})();
