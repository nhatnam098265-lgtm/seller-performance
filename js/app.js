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
      // map chip -> metric key hỗ trợ trong overall.js (adg, ads_expense, offsite
      // đã có công thức LM; winning_ado/content_ado cần xác nhận thêm)
      const map = { adg: "adg", winning_ado: "winning_ado", content_ado: "content_ado", offsite: "offsite", ads_expense: "ads_expense" };
      OverallTab.renderMetricRiskyTable(map[chip.dataset.metric] || chip.dataset.metric);
    });
  });

  // ---- refresh ----
  document.getElementById("refreshBtn").addEventListener("click", () => initLoad(true));

  initLoad(false);
});

async function initLoad(force) {
  await OverallTab.render();
  await SellerTab.render();
}
