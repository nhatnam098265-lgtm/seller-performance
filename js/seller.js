/**
 * Seller Performance tab
 * Nguồn: raw_seller_performance, raw_model_performance, Program structure (chờ link)
 */

const SellerTab = (() => {

  const C = CONFIG.COLUMNS_SELLER_PERF;
  const METRIC_LABELS = ["ADG (AD.GMV)", "ADO", "Paid ads expense", "Offsite expense", "Content ADO (Video + Livestream)"];

  async function populateSellerSelect() {
    const sel = document.getElementById("sellerSelect");
    const seller = await DataLoader.loadCsv("raw_seller_performance");
    if (!seller.ok || seller.rows.length === 0) {
      sel.innerHTML = `<option value="">Chưa có dữ liệu — xem js/config.js</option>`;
      return;
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
  }

  async function render() {
    await populateSellerSelect();

    const grid = document.getElementById("sellerMetricGrid");
    grid.innerHTML = METRIC_LABELS.map(label => `
      <div class="metric-card">
        <div class="m-label">${label}</div>
        <div class="m-value muted" style="font-size:16px">Chọn seller ở trên</div>
      </div>`).join("");
  }

  return { render };
})();
