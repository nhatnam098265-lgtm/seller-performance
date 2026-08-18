# C2C Beauty — RM Performance Dashboard

Dashboard tĩnh (HTML/CSS/JS thuần, không cần build step) đọc trực tiếp dữ liệu
từ Google Sheets đã publish dạng CSV. Deploy bằng GitHub Pages.

## 1. Deploy lên GitHub Pages

```bash
# trong thư mục này
git init
git add .
git commit -m "init dashboard"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

Sau đó vào repo trên GitHub → **Settings → Pages** → Source: chọn branch `main`,
folder `/ (root)` → Save. Sau ~1 phút trang sẽ live tại:
`https://<your-username>.github.io/<repo-name>/`

## 2. Cách "auto sync" hoạt động

Không cần backend / GitHub Action. Cơ chế:

1. Trên Google Sheet gốc: **File → Share → Publish to web**, chọn từng tab cần
   dùng, format CSV → Publish. Mỗi khi bạn sửa raw, Google tự cập nhật lại
   bản publish này (thường trong vài phút).
2. Dashboard (chạy trong trình duyệt người xem) `fetch()` thẳng các link CSV
   đó mỗi khi trang được mở hoặc bấm nút **"Sync lại"** ở sidebar.
3. Vì vậy dashboard luôn hiển thị dữ liệu mới nhất mà không cần bạn deploy
   lại code — chỉ cần sửa raw sheet là xong.

⚠️ Lưu ý: sheet ở chế độ "Publish to web" — bất kỳ ai có link CSV đều xem
được (không sửa được). Nếu cần bảo mật hơn (chỉ nội bộ được xem), cần chuyển
qua phương án Google Sheets API + Service Account + GitHub Action build định
kỳ — nói với tôi nếu muốn đổi hướng này.

## 3. Cấu hình nguồn dữ liệu còn thiếu

Mở `js/config.js`, phần `CONFIG.SOURCES`. Đã kết nối sẵn:

- ✅ `bidding_shop_pfm`

Cần publish riêng từng tab sau (mỗi tab = 1 link CSV riêng, xem hướng dẫn
trong comment đầu file `config.js`) rồi dán vào đúng key:

| Key trong config.js | Tab Google Sheet | Dùng cho |
|---|---|---|
| `raw_seller_performance` | `raw_seller performance` | 5 metric MTD, Top 10 risky, benchmark seller |
| `raw_target_personal` | `raw_target personal` | % reach target mọi metric |
| `raw_model_performance` | `raw_model performance` (M0) | Model MoM, OOS alert, benchmark L3 |
| `raw_model_performance_m1` | `raw_model performance M-1` | So sánh MoM |
| `raw_item_performance` | `raw_item performance` | Traffic alert (daily_unique_view_users) |
| `raw_seller_list` | `raw_seller list` | seller_name / type of seller |
| `program_structure` | `Program structure` | L2/L3 subcat + benchmark cho AI suggestion |

## 4. Còn cần xác nhận với Jolie trước khi hoàn thiện logic tính toán

- **Target mapping**: bạn ghi "cột V:O sheet raw_target personal" — cần xác
  nhận tên cột chính xác (V:O có phải là range Excel, hay tên field?) cho 4
  target: AD.Sales (gross), Paid-ads spending, Offsite Target M-0, Seller
  Content Target M-0.
- **MSP (Marketing Solution Packages)**: tab 1 yêu cầu hiển thị MSP nhưng
  chưa có công thức / tên cột nguồn — theo ảnh KPI framework, công thức đề
  xuất là `sum(gross MSP revenue) / target`, cần tên cột thực tế.
- **`type of seller = top seller`**: cần xác nhận đây là filter áp dụng cho
  toàn dashboard (chỉ tính "top seller"), hay là 1 cột hiển thị thông tin.
- **Top 10 Risky – by KPI**: cần rule cụ thể "target cao nhất ở tất cả metric"
  — lấy theo tổng target quy đổi, hay seller phải nằm top ở từng metric riêng?
- **OOS SKU** cần cột tồn kho (`stock available`) — chưa thấy trong danh sách
  cột đã cung cấp, cần biết nằm ở tab nào.

Code hiện tại đã dựng sẵn khung UI + pipeline fetch/parse/cache cho toàn bộ 2
tab (Overall Performance, Seller Performance); phần tính toán/aggregate theo
đúng công thức sẽ được nối vào `js/overall.js` và `js/seller.js` ngay khi có
đủ link CSV + xác nhận ở trên.
