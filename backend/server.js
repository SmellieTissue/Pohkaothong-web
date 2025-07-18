const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// ใช้ middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// โหลดไฟล์ data.json
const dataPath = path.join(__dirname, 'data.json');

// API: ดึงข้อมูลวัตถุดิบทั้งหมด
app.get('/api/ingredients', (req, res) => {
  const rawData = fs.readFileSync(dataPath);
  const ingredients = JSON.parse(rawData);
  res.json(ingredients);
});

// API: อัปเดตวัตถุดิบทั้งหมด (เช่น เพิ่ม/ลบ/แก้ไข)
app.post('/api/ingredients', (req, res) => {
  const newData = JSON.stringify(req.body, null, 2);
  fs.writeFileSync(dataPath, newData);
  res.status(200).send('Updated!');
});

// เริ่มรันเซิร์ฟเวอร์
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
