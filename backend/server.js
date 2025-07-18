const express = require('express');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

const DATA_PATH = './backend/data.json';

// อ่านข้อมูลวัตถุดิบ
app.get('/api/ingredients', (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  res.json(data);
});

// เพิ่ม / ลดวัตถุดิบ
app.post('/api/update', (req, res) => {
  const { name, change } = req.body;
  let data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  const index = data.findIndex(item => item.name === name);
  if (index !== -1) {
    data[index].remaining += change;
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
Create server.js
