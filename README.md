# EUSTEEL DUCT3D

Ứng dụng Web 3D tham số hóa phục vụ đào tạo kỹ thuật và sản xuất ống gió công nghiệp **EUSTEEL** (React + TypeScript + Vite + Tailwind CSS + Three.js).

## Tính năng Chặng 1 (Module 1.1)
- **Môi trường studio & vật liệu Tôn Mạ Kẽm hoa nhỏ (mini-spangle):** Procedural canvas PBR (`map`, `roughnessMap`, `bumpMap`), ánh sáng studio softbox + rim-light, viền cạnh mảnh và công tắc chuyển nhanh sang **Tô màu kỹ thuật**.
- **Ống thẳng tham số hóa (`W`, `H`, `L`, `t = 0.58–1.5 mm`):** Hỗ trợ 4 kiểu chia mảnh (`1 mảnh O`, `2 mảnh L`, `2 mảnh U+I`, `4 mảnh`) tự động đề xuất theo khổ tôn `1200 mm` và chu vi (`>2400`, `>3000`), kèm nút **Đảo mí kép ↔ mí đơn**.
- **Mí ghép 3D hình học thật:** Mặt cắt thật của **Mí kép Pittsburgh (`+31 mm`)** và **Mí đơn (`+7 mm`, vát góc 45°)** với công tắc **Chưa gò mí ↔ Đã gò mí**, cùng tùy chọn **Mí hàn chồng (`7–25 mm`)** và **Hàn đấu đầu (`0–0`)**.
- **Tách mảnh 3D (`0% → 100%`) & Gân tăng cứng thẳng:** Tách mảnh động học không xuyên cắt hình học và gân tăng cứng thẳng vuông góc trục ống (bước ~250–300 mm).
- **Nhập LSX & Phân tích phôi 1200 mm:** Phân tích nhanh câu lệnh LSX tiếng Việt, nhập/xuất JSON, tính diện tích & khối lượng phôi từng mảnh.

## Chạy cục bộ
```bash
npm install
npm run dev
```

## Build tĩnh
```bash
npm run build
```
