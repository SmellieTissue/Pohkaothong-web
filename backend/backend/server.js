const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

const DATA_PATH = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.static('public'));

app.get('/api/ingredients', (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_PATH));
  res.json(data);
});

app.post('/api/update', (req, res) => {
  const { name, amount } = req.body;
  let data = JSON.parse(fs.readFileSync(DATA_PATH));
  const item = data.find(i => i.name === name);
  if (item) {
    item.remaining += amount;
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Item not found' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
