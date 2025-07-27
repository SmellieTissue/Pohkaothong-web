// ✅ server.js รวมฟีเจอร์ทั้งหมดแล้วจ้า
const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const schedule = require("node-schedule");
const { Client } = require("@line/bot-sdk");

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

const DATA_PATH = path.join(__dirname, "data.json");
const SUMMARY_PATH = path.join(__dirname, "summary.json");

// ✅ LINE Bot Config
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const lineClient = new Client(lineConfig);
const GROUP_ID = process.env.LINE_GROUP_ID;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// ✅ GET หน้าเว็บ
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ✅ GET data.json
app.get("/data.json", (req, res) => {
  fs.readFile(DATA_PATH, "utf8", (err, data) => {
    if (err) return res.status(500).send("Error reading data");
    res.json(JSON.parse(data));
  });
});

// ✅ POST บันทึกข้อมูลวัตถุดิบ
app.post("/save", (req, res) => {
  const newData = req.body;
  const username = req.query.username || "ไม่ระบุชื่อ";
  const timestamp = new Date().toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
  });

  fs.writeFile(DATA_PATH, JSON.stringify(newData, null, 2), (err) => {
    if (err) return res.status(500).send("Error saving data");

    const logMessage = `📦 วัตถุดิบถูกปรับปรุงโดย ${username} เมื่อ ${timestamp}`;
    lineClient.pushMessage(GROUP_ID, { type: "text", text: logMessage });

    res.sendStatus(200);
  });
});

// ✅ POST ส่ง Flex Message ไปยัง LINE
app.post("/push", (req, res) => {
  const messages = req.body.messages;
  if (!messages) return res.status(400).send("No messages provided");

  lineClient.pushMessage(GROUP_ID, messages)
    .then(() => res.sendStatus(200))
    .catch((err) => res.status(500).send("Failed to push message"));
});

// ✅ Scheduler: Reset "สั่งซื้อ" เป็น 0 ทุกวันเวลา 12.00 PM
schedule.scheduleJob("0 12 * * *", () => {
  fs.readFile(DATA_PATH, "utf8", (err, data) => {
    if (err) return;
    const json = JSON.parse(data);

    json.forEach((group) => {
      group.ingredients.forEach((item) => {
        item.order = 0;
      });
    });

    fs.writeFile(DATA_PATH, JSON.stringify(json, null, 2), () => {
      const text = "🔄 ระบบได้รีเซ็ตช่อง 'สั่งซื้อ' เป็น 0 เรียบร้อยแล้ว";
      lineClient.pushMessage(GROUP_ID, { type: "text", text });
    });
  });
});

// ✅ Scheduler: สรุปยอดตอนเที่ยงคืนทุกวัน
schedule.scheduleJob("0 0 * * *", () => {
  fs.readFile(DATA_PATH, "utf8", (err, data) => {
    if (err) return;
    const json = JSON.parse(data);

    let summaryText = `📊 สรุปรายวัน (${new Date().toLocaleDateString("th-TH")})\n`;
    let summaryList = [];

    json.forEach((group) => {
      group.ingredients.forEach((item) => {
        const line = `• ${item.name}: คงเหลือ ${item.remaining} ${item.unit}, ใช้ไป ${item.used}, สั่งซื้อ ${item.order}`;
        summaryText += line + "\n";
        summaryList.push({
          name: item.name,
          unit: item.unit,
          remaining: item.remaining,
          used: item.used,
          order: item.order,
        });
      });
    });

    // ✅ ส่งเข้า LINE
    lineClient.pushMessage(GROUP_ID, {
      type: "text",
      text: summaryText,
    });

    // ✅ บันทึกลงไฟล์ summary.json
    const summaryEntry = {
      date: new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
      items: summaryList,
    };

    fs.readFile(SUMMARY_PATH, "utf8", (err, existing) => {
      const allSummaries = err ? [] : JSON.parse(existing);
      allSummaries.push(summaryEntry);

      fs.writeFile(SUMMARY_PATH, JSON.stringify(allSummaries, null, 2), () => {});
    });
  });
});

// ✅ Start Server
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
