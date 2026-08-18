/**
 * Tab III — MSP Performance
 * Nguồn: raw_msp_tracking (long-format), msp_rev, msp_interest,
 *        raw_seller_performance (GMV=ADG×day), raw_model_performance (L1/L2/L3),
 *        raw_item_performance (voucher/ads expense)
 */

const MspTab = (() => {

  let revenueChart = null, l2Chart = null;

  function money(v) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    return "$" + Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 });
  }

  async function renderRevenueChart() {
    const tracking = await DataLoader.loadMspTracking();
    const canvas = document.getElementById("mspRevenueChart");
    if (!tracking.ok || tracking.rows.length === 0) return;

    const withRev = tracking.rows.filter(r => r.revenue_vnd !== null);
    if (withRev.length === 0) return;

    const months = [...new Set(withRev.map(r => r.month))];
    const parseM = s => { const [mon, yy] = s.split("-"); return new Date(`20${yy}-${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].indexOf(mon)+1}-01`); };
    months.sort((a, b) => parseM(a) - parseM(b));

    const sums = months.map(m => withRev.filter(r => r.month === m).reduce((s, r) => s + (r.revenue_vnd || 0), 0) / 1000);

    if (revenueChart) revenueChart.destroy();
    revenueChart = new Chart(canvas, {
      type: "bar",
      data: { labels: months, datasets: [{ label: "MSP Revenue (nghìn VNĐ)", data: sums, backgroundColor: "#EE4D2D" }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
  }

  async function renderRoiTable() {
    const tbody = document.querySelector("#mspRoiTable tbody");
    const tracking = await DataLoader.loadMspTracking();
    const seller = await DataLoader.loadCsv("raw_seller_performance");
    if (!tracking.ok || !seller.ok) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-row">Chờ dữ liệu</td></tr>`;
      return;
    }
    const C = CONFIG.COLUMNS_SELLER_PERF;

    let latestEnd = null;
    seller.rows.forEach(r => { const d = new Date(r[C.end_date]); if (!isNaN(d) && (!latestEnd || d > latestEnd)) latestEnd = d; });
    const current = seller.rows.filter(r => new Date(r[C.end_date]).getTime() === (latestEnd ? latestEnd.getTime() : NaN));
    const gmvByShop = {};
    current.forEach(r => {
      const adg = DataLoader.cleanNumber(r[C.adgmv]) || 0;
      const days = DataLoader.cleanNumber(r[C.days]) || 0;
      gmvByShop[r[C.shop_id]] = { gmv: adg * days, name: r[C.seller_name] };
    });

    const revByShop = {};
    tracking.rows.filter(r => r.revenue_vnd !== null).forEach(r => {
      revByShop[r.shop_id] = (revByShop[r.shop_id] || 0) + r.revenue_vnd;
    });

    const VND_PER_USD = 25000;
    const rows = Object.keys(revByShop)
      .filter(shopId => gmvByShop[shopId])
      .map(shopId => {
        const gmv = gmvByShop[shopId].gmv;
        const mspRevUsd = revByShop[shopId] / VND_PER_USD;
        return {
          shopId, name: gmvByShop[shopId].name, gmv, mspRevUsd,
          roi: mspRevUsd ? gmv / mspRevUsd : null,
        };
      })
      .sort((a, b) => (b.roi || 0) - (a.roi || 0))
      .slice(0, 15);

    tbody.innerHTML = rows.length
      ? rows.map(r => `<tr><td>${r.name}</td><td>${money(r.gmv)}</td><td>${money(r.mspRevUsd)}</td><td>${r.roi ? r.roi.toFixed(1) + "x" : "—"}</td></tr>`).join("")
      : `<tr><td colspan="4" class="empty-row">Không có shop nào vừa có MSP revenue vừa có GMV tháng hiện tại</td></tr>`;
  }

  async function renderL2TrendChart() {
    const model = await DataLoader.loadCsv("raw_model_performance");
    const canvas = document.getElementById("l2TrendChart");
    if (!model.ok) return;
    const M = CONFIG.COLUMNS_MODEL_PERF;

    const months = [...new Set(model.rows.map(r => r[M.month]))].sort((a, b) => Number(a) - Number(b));
    const l2List = [...new Set(model.rows.map(r => r[M.l2_cat]).filter(Boolean))];
    const gmvByL2Total = {};
    model.rows.forEach(r => {
      const adg = DataLoader.cleanNumber(r[M.adgmv]) || 0;
      gmvByL2Total[r[M.l2_cat]] = (gmvByL2Total[r[M.l2_cat]] || 0) + adg;
    });
    const topL2 = l2List.sort((a, b) => (gmvByL2Total[b] || 0) - (gmvByL2Total[a] || 0)).slice(0, 6);

    const palette = ["#EE4D2D", "#233047", "#2E8B57", "#B7791F", "#8E7CC3", "#4A90D9"];
    const datasets = topL2.map((l2, idx) => {
      const data = months.map(m => {
        const rows = model.rows.filter(r => r[M.month] === m && r[M.l2_cat] === l2);
        return rows.reduce((s, r) => s + (DataLoader.cleanNumber(r[M.adgmv]) || 0), 0);
      });
      return { label: l2, data, borderColor: palette[idx % palette.length], backgroundColor: "transparent", tension: 0.3 };
    });

    if (l2Chart) l2Chart.destroy();
    l2Chart = new Chart(canvas, {
      type: "line",
      data: { labels: months.map(m => `Tháng ${m}`), datasets },
      options: { responsive: true, plugins: { legend: { position: "bottom" } } }
    });
  }

  async function renderPotentialSellerTable() {
    const tbody = document.querySelector("#mspPotentialTable tbody");
    const seller = await DataLoader.loadCsv("raw_seller_performance");
    const item = await DataLoader.loadCsv("raw_item_performance");
    const tracking = await DataLoader.loadMspTracking();
    const interest = await DataLoader.loadCsv("msp_interest");

    if (!seller.ok || !item.ok || !interest.ok) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-row">Chờ raw_seller_performance, raw_item_performance, msp_interest</td></tr>`;
      return;
    }
    const C = CONFIG.COLUMNS_SELLER_PERF;
    const I = CONFIG.COLUMNS_ITEM_PERF;
    const INT = CONFIG.COLUMNS_MSP_INTEREST;

    const activeMspShops = new Set(
      tracking.ok ? tracking.rows.filter(r => r.package && r.package.toLowerCase() !== "non ms").map(r => String(r.shop_id)) : []
    );

    const months = [...new Set(item.rows.map(r => r[I.month]))].sort((a, b) => Number(a) - Number(b));
    const latestMonth = months[months.length - 1];
    const voucherByShop = {};
    item.rows.filter(r => r[I.month] === latestMonth).forEach(r => {
      const v = (DataLoader.cleanNumber(r["daily_seller_voucher_cost"]) || 0);
      voucherByShop[r[I.shop_id]] = (voucherByShop[r[I.shop_id]] || 0) + v;
    });

    let latestEnd = null;
    seller.rows.forEach(r => { const d = new Date(r[C.end_date]); if (!isNaN(d) && (!latestEnd || d > latestEnd)) latestEnd = d; });
    const current = seller.rows.filter(r => new Date(r[C.end_date]).getTime() === (latestEnd ? latestEnd.getTime() : NaN));

    const packages = interest.rows
      .map(r => ({
        name: r[Object.keys(r)[0]],
        priceK: DataLoader.cleanNumber(r[INT.price_k]),
        adsK: DataLoader.cleanNumber(r[INT.ads_balance_k]),
        voucherK: DataLoader.cleanNumber(r[INT.voucher_k]),
      }))
      .filter(p => p.priceK !== null)
      .sort((a, b) => a.priceK - b.priceK);

    const rows = current
      .filter(r => !activeMspShops.has(String(r[C.shop_id])))
      .map(r => {
        const days = DataLoader.cleanNumber(r[C.days]) || 1;
        const voucherMonthly = (voucherByShop[r[C.shop_id]] || 0) * days;
        const adsMonthlyUsd = (DataLoader.cleanNumber(r[C.daily_paidads_expense]) || 0) * days;
        const budgetUsd = adsMonthlyUsd + voucherMonthly;
        const budgetK = budgetUsd * 25; // ước lượng quy đổi USD -> nghìn VNĐ (1 USD ~ 25,000 VNĐ)
        let suggested = packages.find(p => p.priceK >= budgetK) || packages[packages.length - 1];
        return { seller: r[C.seller_name], adsMonthlyUsd, voucherMonthly, suggested };
      })
      .filter(r => r.suggested)
      .sort((a, b) => b.adsMonthlyUsd - a.adsMonthlyUsd)
      .slice(0, 10);

    tbody.innerHTML = rows.length
      ? rows.map(r => `
        <tr>
          <td>${r.seller}</td>
          <td>${money(r.adsMonthlyUsd)}</td>
          <td>${money(r.voucherMonthly)}</td>
          <td>—</td>
          <td><strong>${r.suggested.name}</strong></td>
          <td>Ngân sách ads+voucher hiện tại tương đương gói ${r.suggested.name} (hoàn ads ${r.suggested.adsK ? r.suggested.adsK.toLocaleString() + "K" : "—"}, voucher ${r.suggested.voucherK ? r.suggested.voucherK.toLocaleString() + "K" : "—"} VNĐ) — pitch: "ngân sách bạn đang tự chi tương đương gói này, MSP giúp có thêm slot hiển thị/flash sale mà không tốn thêm chi phí".</td>
        </tr>`).join("")
      : `<tr><td colspan="6" class="empty-row">Không tìm được seller tiềm năng phù hợp điều kiện</td></tr>`;
  }

  async function render() {
    await renderRevenueChart();
    await renderRoiTable();
    await renderL2TrendChart();
    await renderPotentialSellerTable();
  }

  return { render };
})();
