document.addEventListener("DOMContentLoaded", () => {

  // ---- tab switching ----
  const navItems = document.querySelectorAll(".nav-item");
  const panels = document.querySelectorAll(".tab-panel");
  const titleMap = {
    overall: ["Overall Performance", "Snapshot MTD toàn ngành hàng Beauty · C2C"],
    seller:  ["Seller Performance", "Phân tích chi tiết theo từng seller & model"],
    msp:     ["MSP Performance", "Revenue, ROI/CIR và gợi ý gói Marketing Solution Package"],
  };

  navItems.forEach(btn => {
    btn.addEventListener("click", () => {
      navItems.forEach(b => b.classList.remove("active"));
      panels.forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      document.getElementById("tab-" + tab).classList.add("active");
      const [title, sub] = titleMap[tab];
      document.getElementById("pageTitle").textContent = title;
      document.getElementById("pageSubtitle").textContent = sub;
      if (tab === "msp") MspTab.render();
    });
  });

  // ---- metric risk chips ----
  document.querySelectorAll("#metricRiskTabs .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("#metricRiskTabs .chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      const map = { adg: "adg", winning_ado: "winning_ado", content_ado: "content_ado", offsite: "offsite", ads_expense: "ads_expense" };
      OverallTab.renderMetricRiskyTable(map[chip.dataset.metric] || chip.dataset.metric);
    });
  });

  // ---- refresh ----
  document.getElementById("refreshBtn").addEventListener("click", () => initLoad(true));

  // ---- period dropdown (BUG CŨ: chưa từng được populate/wire) ----
  populatePeriodSelect();

  initLoad(false);
});

// Trạng thái kỳ báo cáo đang chọn — null = luôn dùng tháng mới nhất (mặc định).
// OverallTab.aggregateSellerPerf() đọc biến này để lọc.
window.AppState = { selectedMonth: null };

async function populatePeriodSelect() {
  const sel = document.getElementById("periodSelect");
  const seller = await DataLoader.loadCsv("raw_seller_performance");
  if (!seller.ok || seller.rows.length === 0) {
    sel.innerHTML = `<option value="">Chưa có dữ liệu</option>`;
    return;
  }
  const C = CONFIG.COLUMNS_SELLER_PERF;
  const months = [...new Set(seller.rows.map(r => r[C.month]))]
    .filter(Boolean)
    .sort((a, b) => Number(a) - Number(b));

  sel.innerHTML = months.map(m => `<option value="${m}">Tháng ${m}</option>`).join("");
  sel.value = months[months.length - 1]; // mặc định tháng mới nhất
  window.AppState.selectedMonth = sel.value;

  sel.addEventListener("change", async () => {
    window.AppState.selectedMonth = sel.value;
    await initLoad(false);
  });
}

async function initLoad(force) {
  await OverallTab.render();
  await SellerTab.render();
}
