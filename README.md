# 🛠 Sport Shop - Backend API & Admin Panel (SSR)

Chào mừng bạn đến với repository Backend của hệ thống **Sport Shop**! Đây là trung tâm điều khiển của ứng dụng, cung cấp API dữ liệu cho Frontend và một giao diện quản trị chuyên sâu dành cho người quản lý.

## 🚀 Tổng quan dự án

Hệ thống Backend này đảm nhiệm hai vai trò chính:
1. **RESTful API**: Phục vụ dữ liệu cho ứng dụng ReactJS Frontend (sản phẩm, danh mục, giỏ hàng, xác thực...).
2. **Admin Panel (SSR)**: Trang quản lý nội bộ được xây dựng bằng Server-Side Rendering (SSR) với thiết kế cao cấp, giúp quản lý toàn bộ hệ thống bán hàng.

## 🛠 Công nghệ sử dụng

Hệ thống được xây dựng trên nền tảng Node.js ổn định và bảo mật:
- **Node.js & Express**: Framework phát triển web nhanh và linh hoạt.
- **Handlebars (HBS)**: Engine template mạnh mẽ để xây dựng giao diện Admin SSR.
- **MongoDB & Mongoose**: Cơ sở dữ liệu NoSQL linh hoạt, lưu trữ thông tin sản phẩm và khách hàng.
- **Bcryptjs & Express Session**: Quản lý xác thực và phiên làm việc bảo mật.
- **Cors**: Cấu hình chia sẻ tài nguyên giữa Frontend (Netlify) và Backend (Render).

## ✨ Tính năng chính của Dashboard Admin

Hệ thống quản trị cung cấp đầy đủ các công cụ để vận hành shop:
- **Dashboard Tổng quát**: Thống kê số lượng đơn hàng, sản phẩm, và khách hàng theo thời gian thực.
- **Quản lý Sản phẩm (CRUD)**: Thêm, sửa, xóa sản phẩm, quản lý kho hàng và hình ảnh.
- **Quản lý Danh mục**: Tổ chức hệ thống phân loại linh hoạt.
- **Quản lý Đơn hàng**: Theo dõi trạng thái đơn hàng từ lúc đặt đến khi hoàn tất.
- **Quản lý Mã giảm giá (Vouchers)**: Tạo các chương trình khuyến mãi chuyên nghiệp.
- **Cấu hình hệ thống**: Thay đổi thông tin liên hệ, logo và giờ làm việc của shop một cách dễ dàng.

## 📦 Hướng dẫn cài đặt và Chạy cục bộ

Để cài đặt Backend trên máy tính của bạn:

1. **Clone repository**:
   ```bash
   git clone <link-repo-cua-ban>
   cd <thu-muc-backend>
   ```

2. **Cài đặt các thư viện**:
   ```bash
   npm install
   ```

3. **Cấu hình biến môi trường**:
   Tạo file `.env` (nếu cần) hoặc chỉnh sửa chuỗi kết nối MongoDB trong `app.js`.

4. **Chạy server**:
   ```bash
   npm start
   ```
   Server sẽ chạy tại: `http://localhost:3000`
   Truy cập trang quản trị tại: `http://localhost:3000/admin`

## 🌐 Triển khai (Deployment)

Backend hiện đang được triển khai trên **Render**:
👉 **Backend API**: [https://sport-shop-backend.onrender.com/](https://sport-shop-backend.onrender.com/)
👉 **Frontend Repository**: [https://github.com/DanTu2204/sport-shop-frontend.git](https://github.com/DanTu2204/sport-shop-frontend.git)
👉 **Frontend Live Demo**: [https://shopnhom7.netlify.app/](https://shopnhom7.netlify.app/)

---
*Dự án được thực hiện bởi Nhóm 7.*
