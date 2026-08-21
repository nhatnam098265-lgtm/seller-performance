/**
 * ============================================================
 *  CONFIG — nguồn dữ liệu & mapping cột
 * ============================================================
 *  6/6 tab đã đọc và xác nhận cấu trúc thật (17/08/2026):
 *  ✅ bidding_shop_pfm, raw_seller_list, raw_target_personal,
 *     raw_model_performance, raw_seller_performance,
 *     raw_item_performance, program_structure
 * ============================================================
 */

const CONFIG = {

  SOURCES: {
    bidding_shop_pfm: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRb8cibS8r1pXWT0oWxRWVFVUCcIO165T_nl4GdiptZ2IP1306-vTcOCehzZvnYh_4aDPM2wuvKFr8J/pub?output=csv",

    raw_seller_list:        "https://docs.google.com/spreadsheets/d/e/2PACX-1vSozBc9gvn30plCV7qDd2L90YVx6E7nW7Ta-y1osc6yUe7rNpHK3tnMVUH0VuexAbvZn6fHr9L1EGxW/pub?gid=812738475&single=true&output=csv",
    raw_target_personal:    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSozBc9gvn30plCV7qDd2L90YVx6E7nW7Ta-y1osc6yUe7rNpHK3tnMVUH0VuexAbvZn6fHr9L1EGxW/pub?gid=801584413&single=true&output=csv",
    raw_model_performance:  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRb8cibS8r1pXWT0oWxRWVFVUCcIO165T_nl4GdiptZ2IP1306-vTcOCehzZvnYh_4aDPM2wuvKFr8J/pub?gid=1869717608&single=true&output=csv",
    raw_seller_performance: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSozBc9gvn30plCV7qDd2L90YVx6E7nW7Ta-y1osc6yUe7rNpHK3tnMVUH0VuexAbvZn6fHr9L1EGxW/pub?gid=480790454&single=true&output=csv",
    raw_item_performance:   "https://docs.google.com/spreadsheets/d/e/2PACX-1vSozBc9gvn30plCV7qDd2L90YVx6E7nW7Ta-y1osc6yUe7rNpHK3tnMVUH0VuexAbvZn6fHr9L1EGxW/pub?gid=1034579124&single=true&output=csv",
    program_structure:      "https://docs.google.com/spreadsheets/d/e/2PACX-1vSozBc9gvn30plCV7qDd2L90YVx6E7nW7Ta-y1osc6yUe7rNpHK3tnMVUH0VuexAbvZn6fHr9L1EGxW/pub?gid=1735001561&single=true&output=csv",

    raw_msp_tracking:       "https://docs.google.com/spreadsheets/d/e/2PACX-1vSozBc9gvn30plCV7qDd2L90YVx6E7nW7Ta-y1osc6yUe7rNpHK3tnMVUH0VuexAbvZn6fHr9L1EGxW/pub?gid=1487600921&single=true&output=csv",
    msp_rev:                "https://docs.google.com/spreadsheets/d/e/2PACX-1vSozBc9gvn30plCV7qDd2L90YVx6E7nW7Ta-y1osc6yUe7rNpHK3tnMVUH0VuexAbvZn6fHr9L1EGxW/pub?gid=185777366&single=true&output=csv",
    msp_interest:           "https://docs.google.com/spreadsheets/d/e/2PACX-1vSozBc9gvn30plCV7qDd2L90YVx6E7nW7Ta-y1osc6yUe7rNpHK3tnMVUH0VuexAbvZn6fHr9L1EGxW/pub?gid=1894559757&single=true&output=csv",

    raw_rm_kpi:              "https://docs.google.com/spreadsheets/d/e/2PACX-1vRb8cibS8r1pXWT0oWxRWVFVUCcIO165T_nl4GdiptZ2IP1306-vTcOCehzZvnYh_4aDPM2wuvKFr8J/pub?gid=100546136&single=true&output=csv",
    kpi_weightage:           "https://docs.google.com/spreadsheets/d/e/2PACX-1vRb8cibS8r1pXWT0oWxRWVFVUCcIO165T_nl4GdiptZ2IP1306-vTcOCehzZvnYh_4aDPM2wuvKFr8J/pub?gid=1654879572&single=true&output=csv",
    tracking_program_query:  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSozBc9gvn30plCV7qDd2L90YVx6E7nW7Ta-y1osc6yUe7rNpHK3tnMVUH0VuexAbvZn6fHr9L1EGxW/pub?gid=1896458634&single=true&output=csv",
  },

  // tracking program_query — sheet phức tạp: mỗi program có 1 cột cờ join
  // dạng tên "{Metric}_{TênProgram}" (vd "ADG_Flash Sale (FS)", "AMS expense_
  // Shopee idol live OA") + 1 cột text log bên cạnh (bị bỏ qua). Parser dò
  // các cột có chứa "_" trong header, đọc giá trị 1/0 trực tiếp theo shop_id.
  // Metric prefix khớp với SuggestionEngine.METRIC_KEY_TO_LABEL (ADG, Paid
  // Ads expense, AMS expense, Video ADO, Livestream ADO).

  // raw_RM KPI — nguồn MỚI cho 5 chỉ số cốt lõi Tab I (thay raw_seller_performance).
  // Bảng sạch, có sẵn cả target VÀ pct_*_achieved (không cần tự tính %target nữa).
  // Có 1 dòng shop_id="Total" = số tổng toàn ngành hàng, dùng cho 5 metric card.
  // Lưu ý: tiền tệ ở đây là VNĐ (khác USD như raw_seller_performance cũ).
  // Sheet hiện chỉ có 1 tháng dữ liệu (grass_month 2026-08) — CHƯA có cột LM/gap
  // nên MoM cho khối 5 metric card sẽ tạm để "—" cho đến khi sheet có thêm lịch sử.
  COLUMNS_RM_KPI: {
    shop_id: "shop_id", username: "username", rm: "rm", group_cat: "group_cat",
    target_ado: "target_ado", target_adgmv_vnd: "target_adgmv_vnd",
    target_paid_ads_spending_vnd: "target_paid_ads_spending_vnd",
    target_offsite_spendings: "target_offsite_spendings",
    target_winning_sku_ado_coverage: "target_winning_sku_ado_coverage",
    target_content_ado_contribution: "target_content_ado_contribution",
    mtd_ado: "mtd_ado", mtd_sale: "mtd_Sale",
    mtd_paid_ads: "mtd_monthly_paid_ads_spending",
    actual_offsite: "actual_offsite_spendings",
    winning_ado_coverage: "winning_ado_coverage",
    mtd_content_ado: "mtd_content_ado",
    pct_ado_achieved: "pct_ado_achieved",
    pct_gmv_achieved: "pct_gmv_achieved",
    pct_paid_ads_achieved: "pct_paid_ads_spending_achieved",
    pct_offsite_achieved: "pct_offsite_spendings_achieved",
    pct_winning_ado_achieved: "pct_winning_ado_achieved",
    pct_content_ado_achieved: "pct_content_ado_achieved",
    kpi_score_actual: "kpi_score_actual",
  },

  // msp_rev — catalog giá & revenue từng gói MSP (USD). Bảng sạch header:true.
  COLUMNS_MSP_REV: {
    package: "Pitching Desk", // cột tên gói thật là "Max Ultimate" — nằm ở cột "Max Ultimate" theo header gốc
    type: "Type",
    revenue_usd: "Revenue",
    paid_ad_usd: "Paid Ad",
    voucher_usd: "Voucher /Rebate",
    pct_hoan_tra: "%Hoàn trả",
  },

  // msp_interest — quyền lợi hoàn ads/voucher theo gói, đơn vị 1,000 VNĐ.
  // Sheet có 1 dòng trống đầu + dòng header ở dòng 2 — parser sẽ bỏ dòng trống.
  COLUMNS_MSP_INTEREST: {
    package: "",  // cột đầu không có tên — chứa tên gói (Max Ultimate, Super Ultimate...)
    ads_balance_k: "Số dư quảng cáo",
    voucher_k: "Voucher",
    price_k: "Giá bán",
    pct_hoan_ads: "% hoàn ads",
    pct_hoan_tra: "% hoàn trả",
  },

  // raw_item_performance — bảng sạch. Có level2/level3_global_be_category
  // (dùng để benchmark model theo L2/L3, theo xác nhận của Jolie: L2/L3
  // lấy trực tiếp từ raw_seller_performance / raw_model_performance,
  // KHÔNG cần thêm vào Program structure).
  COLUMNS_ITEM_PERF: {
    month: "month", start_date: "start_date", end_date: "end_date",
    shop_id: "shop_id", seller_name: "seller_name", item_id: "item_id",
    l2_cat: "level2_global_be_category", l3_cat: "level3_global_be_category",
    daily_unique_view_users: "daily_unique_view_users",
    ads_expense_lm: "ads expense LM",
    offsite_gmv_lm: "offsite GMV LM",
  },

  // program_structure — bảng mapping Metric (KPI gốc) → Program đề xuất.
  // Dùng để AI Suggestion: với 1 metric đang risk, lọc Loại="Growth" và gợi ý.
  // Lưu ý: dòng cuối cùng của sheet là ghi chú hướng dẫn (không phải data),
  // suggestionEngine.js sẽ lọc bỏ dòng có Program rỗng.
  COLUMNS_PROGRAM: {
    metric: "Metric (KPI goc)",
    program: "Program",
    source: "Nguon tracking (file tracking progam)",
    type: "Loai",              // Growth / Decline
    idea: "Main idea (nhap tay / draft de Jolie sua)",
    requirement: "Requirement",
    note: "Ghi chu",
  },

  cacheBustOnManualRefresh: true,

  // ============================================================
  // raw_seller_performance — bảng sạch, PapaParse header:true đọc trực tiếp.
  // Đã có sẵn cột tính MoM/ranking do sheet tự tính (đỡ phải tự làm lại):
  //   ranking ADG monthly, gap LM ADG, adg LM, top drop, top grow,
  //   gap LM ads expense, ads expense LM, gap offsite expense, offsite expense LM,
  //   gap #video vs LM, #video LM, gap #LS session vs LM, LS session LM,
  //   gap #ado LM, ado LM, top seller, type of seller, seller type
  // ============================================================
  COLUMNS_SELLER_PERF: {
    month:                 "month",
    start_date:            "start_date",
    end_date:              "end_date",
    days:                  "days",
    shop_id:               "shop_id",
    seller_name:           "seller_name",
    type_of_seller:        "type of seller",
    seller_segment:        "seller_segment_by_ado",

    adgmv:                 "adgmv",
    ado:                   "ado",
    daily_paidads_expense: "daily_paidads_expense",
    ams_aff_commission:    "ams_aff_commission(SUM)",
    ado_from_seller_video: "ado_from_seller_video",
    ado_from_livestream:   "ado_from_livestream",
    creator_video_cnt:     "creator_video_cnt",
    creator_video_view:    "creator_video_view",
    adgmv_from_livestream: "adgmv_from_livestream",
    livestream_session_cnt: "streamer_livestream_session_cnt",
    livestream_duration:    "streamer_livestream_duration",
    daily_livestream_seller_voucher:          "daily_livestream_seller_voucher",
    daily_livestream_shopee_voucher:          "daily_livestream_shopee_voucher",
    daily_livestream_shopee_exclusive_voucher:"daily_livestream_shopee_exclusive_voucher",
    daily_livestream_shopee_item_rebate:      "daily_livestream_shopee_item_rebate",

    adg_lm:                "adg LM",
    gap_lm_adg:             "gap LM ADG",
    ado_lm:                "ado LM",
    gap_lm_ado:             "gap #ado LM",
    ads_expense_lm:         "ads expense LM",
    gap_lm_ads_expense:     "gap LM ads expense",
    offsite_expense_lm:     "offsite expense LM",
    gap_lm_offsite:         "gap offsite expense",
    video_lm:               "#video LM",
    gap_lm_video:            "gap #video vs LM",
    ls_session_lm:           "LS session LM",
    gap_lm_ls:               "gap #LS session vs LM",
    ranking_adg_monthly:     "ranking ADG monthly",
    top_drop:                "top drop",
    top_grow:                "top grow",
  },

  // raw_model_performance — bản republish mới (gid=1869717608) KHÔNG còn
  // các cột tính sẵn "ranking ADG monthly / gap LM ADG / adg LM / top drop /
  // top grow / top seller" như bản cũ. MoM (Top grow/drop) giờ phải tự tính
  // bằng cách so 2 tháng (cột "month") có trong data, giống cách làm với
  // raw_item_performance.
  COLUMNS_MODEL_PERF: {
    month:            "month",
    start_date:       "start_date",
    end_date:         "end_date",
    days:             "days",
    shop_id:          "shop_id",
    seller_name:      "seller_name",
    item_id:          "item_id",
    model_id:         "model_id",
    item_name:        "item_name",
    model_name:       "model_name",
    l1_cat:           "level1_global_be_category",
    l2_cat:           "level2_global_be_category",
    l3_cat:           "level3_global_be_category",
    current_stock:    "current_stock",
    model_status:     "model_status",   // 1 = active — dùng lọc OOS alert
    adgmv:            "adgmv",
    ado:              "ado",
    seller_voucher_cost: "daily_seller_voucher_cost",
  },

  COLUMNS_SELLER_LIST: {
    shop_id:        "Shop ID",
    username:       "username",
    is_ms_seller:   "is MS seller",
    type_of_seller: "type of seller",
  },

  // bidding_shop_pfm — dùng cho Winning SKU ADO (KPI score + risky table)
  COLUMNS_BIDDING: {
    shop_id:          "shop_id",
    item_id:          "item_id",
    model_id:         "model_id",
    model_win_ado:    "model_win_ado",
    model_eligible_ado: "model_eligible_ado",
  },

  // raw_target_personal: CSV ghép nhiều bảng ngang + header lặp lại (đóng
  // băng dòng khi export). Bảng cần dùng bắt đầu ở cột "user name":
  //   user name, from, to, Group CAT, RM lead (1 email), RM, shopid, Main CAT,
  //   Target ADO (gross), Target AD.Sales (gross), Target Paid-ads spending ($),
  //   Seller_program, Offsite L3M, Offsite Target M-0, FBS ADO M-1,
  //   FBS ADO Target M-0, Seller Content ADO M-1, Seller Content Target M-0,
  //   New FBS SKU ADO M-1, New FBS ADO Target M-0
  // Không parse bằng header:true — dùng TargetPersonalParser trong dataLoader.js.
  // Đã xác nhận đúng 4/4 tên cột target ✅
  COLUMNS_TARGET: {
    shop_id:               "shopid",
    from:                  "from",
    to:                    "to",
    target_ado_gross:      "Target ADO (gross)",
    target_ad_sales_gross: "Target AD.Sales (gross)",
    target_paid_ads:       "Target Paid-ads spending ($)",
    offsite_target_m0:     "Offsite Target M-0",
    seller_content_target_m0: "Seller Content Target M-0",
  },

  // 5-KPI score theo công thức Jolie xác nhận (không gồm Marketing solution
  // packages) — weight lấy nguyên từ sheet KPI Weightage, KHÔNG renormalize
  // lại thành 100% (tổng 5 weight = 85%, đúng theo công thức "score = Σ pct×weight").
  KPI_WEIGHTS: {
    ad_gmv:              { label: "AD.GMV Portfolio",               weight: 0.25, maxScore: 120 },
    paid_ads:            { label: "Paid ads",                       weight: 0.25, maxScore: 120 },
    offsite:              { label: "Off-site (AMS/CPAS/GAS)",        weight: 0.10, maxScore: 120 },
    content_ado:         { label: "Seller Content ADO contribution",weight: 0.15, maxScore: 120 },
    winning_sku_ado:     { label: "% Winning SKU ADO coverage",     weight: 0.10, maxScore: 120 },
  },

  MIN_SELLER_PER_RM: 37,

  STATUS_THRESHOLDS: {
    good:  0.95,
    watch: 0.80,
  },

  OOS_STOCK_THRESHOLD: 10,
};
