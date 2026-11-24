# SPEC MODULE 1: WEB APP 3D ỐNG GIÓ (EUSTEEL)

## 1. Mục tiêu & Kiến trúc tổng thể
- **Mục tiêu:** Web App 3D tham số hóa phục vụ đào tạo nhân sự kỹ thuật & sản xuất đọc hiểu cấu tạo thật của ống gió (mí ghép, bích kết nối liền thân và bích rời, đường chấn, vết khấu, chia mảnh theo khổ tôn `1200 mm` / Inox `1250 mm`, trổ lỗ gắn chân rẽ/cổ tròn/tyren).
- **Công nghệ:** React + Vite + TypeScript + Tailwind CSS + Three.js (`@react-three/fiber`, `@react-three/drei`). Chạy 100% phía trình duyệt (client-side), không cần backend, có thể build tĩnh đẩy lên GitHub Pages.
- **Ngôn ngữ giao diện:** 100% Tiếng Việt chuyên ngành cơ khí ống gió.
- **Bố cục màn hình:**
  - **Cột trái (340px, hỗ trợ nút ẩn/hiện để xem 3D toàn màn hình 100%):** 3 Tab:
    1. `Thông số` (mẫu nhanh, chọn mảnh/mặt tương tác `1-A, 1-B, 1-C, 1-D, 1-E...`, kích thước W/H/L kèm chọn bước nhảy `10 / 50 / 100 mm` hoặc nhập tay, chọn vật liệu `Tôn Mạ Kẽm / Inox`, độ dày, đầu kết nối C1/C2, chia mảnh theo khổ vật liệu chuẩn, chọn loại mí & đảo mí, gân tăng cứng, phụ kiện trổ lỗ, tiêu âm).
    2. `Nhập LSX` (dán text LSX, dán JSON, ghim ảnh bản vẽ tham chiếu `Ctrl+V`).
    3. `S Phôi` (tổng diện tích phôi `m²`, khổ vật liệu chuẩn `1200 / 1250 mm`, phân tích chiều dài phôi `L_phôi = L + bù C1 + bù C2`, bảng kích thước & diện tích `m²` từng mảnh theo mã định danh `1-A, 1-B...`, cảnh báo lọt khổ — **không hiển thị khối lượng kg**).
  - **Vùng chính giữa (3D/2D Viewport):** Chuyển đổi giữa **Xem 3D Thành phẩm**, **Tách mảnh 3D (Exploded View)** và **Trải phẳng phôi 2D (SVG có kích thước, đường chấn, vết khấu, ký hiệu mặt đánh dấu)**. Khi thu gọn cột trái, viewport tự động mở rộng 100% kèm nút nổi góc trên-trái để mở lại bảng điều khiển.
  - **Thanh công cụ nhanh phía trên Viewport:**
    - Chế độ vật liệu: `Tôn Mạ Kẽm` / `Inox` (tự động đồng bộ theo vật liệu đang chọn) ↔ `Tô màu kỹ thuật (Đỏ = Mí kép, Xanh dương = Mí đơn, Vàng = Bích/Đầu nối, Xanh lá = Đường chấn, Cam = Mí hàn)`.
    - Công tắc trạng thái mí: `Chưa gò mí (vừa chạy máy)` ↔ `Đã gò mí hoàn thiện`.
    - Thanh trượt `Tách mảnh (0% → 100%)`.
    - Công tắc bật/tắt **`Nhãn mặt (1-A, 1-B...)`** (mặc định BẬT).
    - Công tắc bật/tắt `Gân tăng cứng` (1 dạng gân thẳng duy nhất).
    - Nút `Đảo mí kép ↔ mí đơn` tự do.

## 2. Yêu cầu Đồ họa 3D, Vật liệu & Đánh dấu mảnh/mặt
- **Vật liệu 3D theo chủng loại vật liệu:**
  - **`Tôn Mạ Kẽm` (hoa nhỏ — khổ chuẩn `1200 mm`):** Tạo texture thủ tục (procedural canvas `map` + `roughnessMap` + `bumpMap` nhẹ) mô phỏng đúng **tôn mạ kẽm hoa nhỏ (mini-spangle)**: tông bạc xám lạnh tự nhiên, các hạt tinh thể hoa kẽm kích thước nhỏ và mịn, độ phản chiếu kim loại sắc nét (`metalness: 0.80–0.85`).
  - **`Inox` (khổ chuẩn `1250 mm`):** Bề mặt Inox sáng đồng đều, không có hoa kẽm. Trên giao diện chỉ ghi đúng **`Inox`** (không dùng các từ mô tả thừa như `xước mịn`, `xước mờ`).
- **Môi trường 3D tương phản nổi bật chi tiết:**
  - Nền viewport 3D dùng **studio tối dịu tương phản cao** (gradient xám xanh đậm `#1c2432` → `#0f141d`) kèm sàn lưới kỹ thuật mờ nhẹ.
  - Hệ ánh sáng studio 3 điểm + HDRI softbox phản chiếu + đèn rim-light bắt sáng các cạnh bẻ, kết hợp đường viền cạnh rất mảnh (`Edges`) giúp mọi nếp gấp mí, rãnh bích, khe hở góc và gân thẳng nổi khối rõ ràng.
- **Đánh dấu mảnh/mặt trong lòng ống (`1-A`, `1-B`, `1-C`, `1-D`, `1-E`, `1-F`...) & Chọn mặt tương tác:**
  - Gán mã định danh chuẩn theo thứ tự cho từng mảnh và các mặt thành phần: `1 mảnh` gồm `1-A`; `2 mảnh L` gồm `1-A`, `1-B`; `2 mảnh U+I` gồm `1-A`, `1-B`; `4 mảnh` gồm `1-A`, `1-B`, `1-C`, `1-D`; mảnh bịt đầu rời tiếp nối theo thứ tự (`1-B`, `1-E`, `1-F`...).
  - Hiển thị chữ đánh dấu (`1-A`, `1-B`...) sắc nét ngay trên **mặt đánh dấu (lòng trong)** của từng mảnh/mặt tôn trong không gian 3D (chỉ đánh dấu tên mảnh/mặt trong lòng, **KHÔNG** chèn chữ ghi chú lên các đường mí hay mép bích).
  - Cho phép **click trực tiếp vào từng mảnh/mặt trên 3D** hoặc chọn từ danh sách thẻ `1-A`, `1-B`... để làm nổi bật mảnh/mặt đó và tùy chỉnh riêng từng đường mí, cạnh bẻ chân hoặc phụ kiện gắn lên mặt đó.
- **Gân tăng cứng:**
  - Chỉ sử dụng **1 dạng gân thẳng** duy nhất (các đường gân nổi thẳng song song chạy vuông góc với chiều dài `L` của ống, bước gân đều ~250–300mm), tuyệt đối không vẽ gân chéo chữ X.

## 3. Thông số hình học & Quy chuẩn nhà máy (Ống thẳng)
### 3.1. Kích thước cơ bản & Chủng loại vật liệu
- `W` (Rộng, mm), `H` (Cao, mm), `L` (Dài, mm): hỗ trợ nhập tay mượt mà từ bàn phím và nút `-`/`+` theo **Bước nhảy** tùy chọn (`10` | `50` | `100 mm`, mặc định `50 mm`, hoặc gõ số tùy ý).
- **Vật liệu & Độ dày chuẩn (`t`):**
  - **Tôn Mạ Kẽm:** Độ dày `0.58, 0.75, 0.95, 1.15, 1.2, 1.5 mm`; khổ vật liệu chuẩn **`1200 mm`** (`6000 × 1200 mm`).
  - **Inox:** Độ dày `0.6, 0.8, 1.0 mm` (tự động chọn `0.8 mm` khi chuyển từ độ dày không thuộc danh sách Inox); khổ vật liệu chuẩn **`1250 mm`** (`6000 × 1250 mm`).
- **Quy ước chiều bẻ theo mặt tôn:**
  - `Mặt đánh dấu` là **mặt trong lòng ống** (hiển thị nhãn `1-A`, `1-B`... trên lòng trong 3D và trên bản vẽ trải phẳng 2D).
  - Mí đơn, LCCT, đường chấn góc thân ống đều bẻ vuông góc 90° **vào phía lòng trong (mặt đánh dấu)**.
  - Bích `TDC/TDF` bẻ vuông góc **ra ngoài (ngược chiều mặt đánh dấu)**; rãnh Mí kép Pittsburgh nằm bên **mặt ngoài (mặt không đánh dấu)**.

### 3.2. Thư viện Mí ghép (Seams) — Áp dụng cho cả thân ống & đầu bịt kín
1. **Mí gò Pittsburgh (Mặc định cho tất cả độ dày đến `1.5 mm`):**
   - **Mí kép (Female - màu đỏ):** Tôn thừa phôi `+31 mm`. Dựng mặt cắt 3D rãnh chữ U kẹp thật nằm bên mặt ngoài.
   - **Mí đơn (Male - màu xanh dương):** Tôn thừa phôi `+7 mm`, vát góc 45° cao `7 mm` ở 2 đầu. Dựng gờ bẻ vuông góc 90° quay vào lòng trong.
   - **Hai trạng thái hiển thị:**
     - *Chưa gò mí:* Rãnh mí kép mở, mép gập ngoài đứng thẳng, mí đơn tách nhẹ để quan sát rãnh cắm.
     - *Đã gò mí:* Mí đơn cắm lọt lòng rãnh mí kép, mép ngoài của mí kép bẻ gập 90° khóa chặt lên mí đơn.
2. **Mí hàn (Tùy chọn thay thế tự do cho MỌI đường mí hiện có):**
   - Người dùng có thể tự do chuyển đổi bất kỳ đường mí đơn/mí kép nào (trên toàn bộ thân ống, từng góc ghép dọc thân, hoặc từng cạnh ghép của **Đầu bịt kín**) sang **Mí hàn** khi không chạy được mí gò.
   - Hỗ trợ 2 kiểu chuẩn hóa: **`Hàn chập`** (nhập độ rộng tự do `7–25 mm`, mặc định `10 mm`) và **`Hàn đấu đầu`** (`0–0`).
   - Nếu `L < 140 mm`: hiển thị gợi ý nhẹ nên chuyển sang Mí hàn (vẫn cho phép người dùng tự chọn).
3. **Nối C (`17 + 17 mm`):** Dành cho tấm vượt khổ vật liệu chuẩn (`1200 mm` Tôn Mạ Kẽm / `1250 mm` Inox) hoặc vượt chiều dài máy lăn gân (`1900 mm`).

### 3.3. Quy tắc chia mảnh & Đảo mí tự do
- **Tự động đề xuất theo khổ vật liệu chuẩn `B_sheet` (`1200 mm` Tôn Mạ Kẽm / `1250 mm` Inox), chu vi và tổng chiều dài phôi `L_phôi = L + bù C1 + bù C2`:**
  - `1 mảnh` (gấp chữ O — `1-A`): Chu vi `2*(W+H) ≤ 2400 mm` và `L_phôi ≤ B_sheet`.
  - `2 mảnh chữ L` (`1-A`, `1-B`): `2*(W+H) > 2400 mm`, `(W+H) ≤ 3000 mm`, và `L_phôi ≤ B_sheet`. Mặc định cạnh lớn hơn mang **Mí kép**, cạnh nhỏ hơn mang **Mí đơn**.
  - `2 mảnh chữ U+I` (`1-A`, `1-B`): Cho phép chọn thủ công để so sánh.
  - `4 mảnh` (`1-A`, `1-B`, `1-C`, `1-D`): `(W+H) > 3000 mm`, HOẶC khi `L_phôi > B_sheet` mà cả `W` và `H` (sau cộng mí) đều `≤ B_sheet` (xoay dọc tấm `6000 × B_sheet`).
- **Tự do tùy biến:** Cho phép chọn thủ công `1 mảnh / 2 mảnh L / 2 mảnh U+I / 4 mảnh`, bấm nút **`Đảo mí kép ↔ mí đơn`** tự do, và đổi kiểu mí `Mí gò ↔ Hàn chập ↔ Hàn đấu đầu`.

### 3.4. Thư viện Đầu kết nối (Chọn độc lập cho Đầu C1 và Đầu C2, kèm nút `Áp dụng C1 cho cả C2`)

#### A. Nhóm Bích liền thân ống
1. **`TDC/TDF` (Gộp chung làm một lựa chọn duy nhất — KHÔNG có TDC/TDF quay trong):**
   - Phôi tôn thừa `+48 mm`, khấu góc tổng `60 mm` (khấu sâu thêm `12 mm`).
   - Chiều cao mặt bích 3D hoàn thiện: **32 mm**, biên dạng gập rỗng hình hộp chữ C + **4 ke góc 3D có lỗ bắt bulong hình giọt nước** luồn trong rãnh (trượt rời khi kéo `Tách mảnh`).
   - **Không có vết khấu tam giác ở giữa cạnh dài mặt bích.**
   - Tùy chọn **`Dấu lõm phân biệt đầu`** (vết lõm nhỏ duy nhất ở cạnh đầu sát góc, dùng cho chi tiết không đối xứng như côn/cút/Z thu; **mặc định TẮT với ống thẳng**).
2. **`Nẹp C` (Gộp chung — Bích liền thân ống, KHÔNG vẽ thanh cài rời màu vàng):**
   - Phôi cộng `+12.5 mm`, khấu góc `25 mm`.
   - Phần tôn thừa `+12.5 mm` liền với thân ống được **uốn cong vòng ra ngoài 180° tạo rãnh hình chữ C** có khe hở lòng chữ C rõ nét và khe hở thoáng ở cả 4 góc ống.
3. **`Đầu bẻ chân` (Tùy biến độc lập từng cạnh):**
   - Chiều rộng bẻ chân `F` nhập tay tự do (mặc định `20 mm`), phôi cộng `+F mm` cho các mảnh có cạnh bẻ (`+0 mm` nếu mảnh chỉ gồm cạnh để thẳng).
   - Cho phép tùy chỉnh độc lập 4 cạnh **`Trên / Dưới / Trái / Phải`** với 3 trạng thái: **`Bẻ vào` | `Bẻ ra` | `Để thẳng`**.
   - Hỗ trợ 5 nút chọn nhanh (Preset): `4 bẻ vào`, `4 bẻ ra`, `2 bẻ vào – 2 bẻ ra`, `2 bẻ vào – 2 để thẳng`, `2 bẻ ra – 2 để thẳng`.
4. **`Lưới chắn côn trùng (LCCT)`:**
   - Phôi cộng `+20 mm`, chấn vuông góc 90° quay vào lòng trong, kèm nút bật/tắt hiển thị **khung lưới ô vuông có nẹp chia ô** bên trong.
5. **`Đầu bịt kín (End Cap)`:**
   - Mặc định 4 cạnh đầu thân ống chạy **Mí kép chờ (`+31 mm`)** và sinh **Mảnh bịt đầu rời (`1-B` / `1-E` / `1-F`...)** có 4 cạnh **Mí đơn (`+7 mm`, vát 45°)** cùng gân thẳng.
   - Hỗ trợ tự do chuyển đổi toàn bộ hoặc từng cạnh (`Trên / Dưới / Trái / Phải`) sang **`Hàn chập`** (`7–25 mm`) hoặc **`Hàn đấu đầu`** (`0–0`), đồng bộ kích thước phôi mảnh bịt đầu trong tab `S Phôi`.
6. **`Đầu để thẳng` (Kéo dài trơn lắp cửa gió / van gió):**
   - Bổ sung ô nhập tay **Chiều dài đoạn để thẳng `L_thẳng`** (`0, 20, 30, 40 mm...`, mặc định `0 mm`; bù phôi `+L_thẳng mm`).
   - **Quy tắc bắt buộc:** Trên suốt chiều dài đoạn để thẳng mở rộng (`L_thẳng > 0`), thân ống **để thẳng trơn hoàn toàn, KHÔNG chạy mí** (đường mí ghép dọc thân dừng lại trước đoạn để thẳng) để đút vừa cửa gió hoặc van gió.

#### B. Nhóm Bích rời (KHÔNG vẽ lỗ, ghép vuông góc 2 thanh phủ bì + 2 thanh lọt lòng)
- **Quy tắc ghép góc bắt buộc cho cả Bích V & Bích U:** Không cắt vát chéo 45° trên mặt phẳng khung bích. Khung bích chữ nhật được ghép vuông góc từ **2 thanh có chiều dài phủ bì** và **2 thanh có chiều dài lọt lòng**; góc vát chỉ nằm ở phần thừa đuôi cánh ôm phía sau để không bị cấn góc. **Không vẽ lỗ** trên cả Bích V lẫn Bích U.
7. **`Bích V quay ngoài` (Rời):**
   - Quy cách: `V30×30`, `V40×40`, `V50×50`, `V80×30`; độ dày `2 / 3 / 4 mm`.
   - *`V30/V40/V50` ống thường:* Lòng trong khung V = `W+5 × H+5`; phôi thân ống cộng **`+8 mm`** bẻ lật 90° ôm mép bích, khấu góc `= V + 5`.
   - *`V30/V40/V50` ống EI:* Lòng trong khung V = `W-3 × H-3`; phôi thân ống cắt thẳng **`+0 mm`**, khấu EI `= V + 5`.
   - *Quy cách đặc biệt **`V80×30`**:* Luôn quay ngoài (cánh `80 mm` làm mặt bích), phần cánh `30 mm` đặt **lọt vào trong lòng chi tiết**, nên kích thước khung bích **giảm `-3 mm` mỗi chiều (`W-3 × H-3`)** giống hệt bích V quay trong; phôi thân ống cắt thẳng **`+0 mm`**.
8. **`Bích V quay trong` (Rời — thay thế hoàn toàn TDC/TDF quay trong):**
   - Quy cách: `V30×30`, `V40×40`, `V50×50`; độ dày `2 / 3 / 4 mm`.
   - Phủ bì khung V = **`W-3 × H-3`**; phôi thân ống cắt thẳng **`+0 mm`**.
9. **`Bích U rời`:**
   - Độ dày `1.5 / 2 / 3 mm`, phôi thân ống cắt thẳng **`+0 mm`**.
   - Mặt cắt chữ U lệch cánh: Cánh ôm thân ống (mặc định `30 mm`, đổi tự do) × Mặt bích phẳng (mặc định `40 mm`, đổi tự do) × **Gờ bẻ ngoài cố định `10 mm` quay ngược về phía thân ống** (cùng chiều cánh ôm), ghép 2 thanh phủ bì + 2 thanh lọt lòng và vát tránh cấn ở đuôi cánh ôm.

### 3.5. Phụ kiện gắn kèm, Lỗ trổ & Chi tiết gia công trên thân ống
- **Tyren tăng cứng (`M8 / M10`):** Nhập số lượng và vị trí khoảng cách từ đầu C1 (hoặc chia đều tự động). Dựng thanh ren xuyên ống kèm lỗ khoan trên 2 mặt đối diện và ecu/long đen.
- **Lỗ trổ & Phụ kiện gắn lên 4 mặt (`Trên / Dưới / Hông trái / Hông phải`):**
  - *Chân rẽ vuông / Chân rẽ vát (Shoe):* Nhập kích thước đáy `W1×H1`, đầu ra `W2×H2`, chiều dài `L_branch`, chiều rộng bẻ chân (ví dụ `20 mm`), bích đầu ra (`TDC/TDF / Nẹp C / Để thẳng`), hướng vát (`Về C1 / Về C2 / Cân tâm`), khoảng cách từ đầu C1.
  - *Chân rẽ vuông tròn / Cổ tròn:* Tự động áp quy chuẩn nhà máy **giảm `5 mm` đường kính cổ** (ví dụ `D200 → D195`, có công tắc tắt nếu LSX ghi "làm đúng D"), dựng gân tròn trên cổ và tai bẻ chân.
  - *Cửa thăm / Lỗ trổ trống:* Khoét lỗ vuông/tròn/oval đúng vị trí trên mặt tôn (cả trên 3D và phôi trải phẳng 2D).
- **Ống tiêu âm (tùy chọn bật/tắt):** Bông khoáng dày `25 / 50 / 100 mm` + lớp tôn soi lỗ (`H23 bẻ 15`, `H45 bẻ 20`, `H95 bẻ 20`), hỗ trợ chế độ cắt mặt cắt để soi lớp tiêu âm bên trong.

### 3.6. Chế độ nhập LSX & Tham chiếu bản vẽ
- **Parser Tiếng Việt:** Nhận diện các mẫu chuẩn như:
  - `Ống gió KT: 500x320, L1100, tôn 0.75, 2 đầu bích TDC/TDF`
  - `Ống gió Inox KT: 700x400, L1200, dày 0.8, 2 đầu nẹp C`
  - `Ống gió KT: 800x500, L1000, tôn 0.95, 2 đầu bích V80x30`
  - `Ống gió KT: 600x350, L950, tôn 0.75, 1 đầu bích TDC, 1 đầu để thẳng +40`
  - `Ống gió KT 900x700, L1540, 2 đầu bích TDC, tăng cứng 2 tyren M10, hông trái 700x1540 gắn 1 chân rẽ KT 1000x600(bẻ chân 20mm)/850x600(bích TDC), L150, hông phải 700x1540 gắn 1 chân rẽ KT 750x400(bẻ chân 20mm)/600x400(bích TDC), L150, xem hình vẽ`
- **Hỗ trợ "xem hình vẽ":** Cho phép dán (`Ctrl+V`) hoặc tải ảnh bản vẽ vào khung cửa sổ nổi thu gọn/phóng to để đối chiếu, chỉnh trực tiếp khoảng cách offset của từng chân rẽ/tyren, và nút **Nhập/Xuất JSON** để nạp nhanh toàn bộ tọa độ.