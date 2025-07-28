const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Bangkok");

const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const { Client } = require("@line/bot-sdk");
const schedule = require("node-schedule");

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = path.join(__dirname, "data.json");
const SUMMARY_PATH = path.join(__dirname, "summary.json");

// 🟩 LINE config
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const lineClient = new Client(lineConfig);
const GROUP_ID = process.env.LINE_GROUP_ID;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// ✅ หน้าเว็บ
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ✅ ดึงข้อมูลวัตถุดิบ
app.get("/data.json", (req, res) => {
  fs.readFile(DATA_PATH, "utf8", (err, raw) => {
    if (err) return res.status(500).send("โหลดข้อมูลไม่สำเร็จ");
    try {
      const parsed = JSON.parse(raw);
      const dataArray = Array.isArray(parsed) ? parsed : parsed.data;
      res.json(dataArray);
    } catch {
      res.status(500).send("ข้อมูลผิดพลาด");
    }
  });
});

// ✅ บันทึกข้อมูล + แจ้งเตือนแบบ Flex
app.post("/save", (req, res) => {
  const newData = req.body.data;
  const username = req.body.username || "ไม่ระบุชื่อ";

  if (!Array.isArray(newData)) return res.status(400).send("❌ รูปแบบข้อมูลผิด");

  const wrapped = { data: newData, username };

  fs.writeFile(DATA_PATH, JSON.stringify(wrapped, null, 2), (err) => {
    if (err) return res.status(500).send("❌ บันทึกไม่สำเร็จ");

    const now = req.body.timestamp || dayjs().format("DD/MM/YYYY HH:mm");

    const message = {
      type: "flex",
      altText: "มีการปรับวัตถุดิบ",
      contents: {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          contents: [{ type: "text", text: "📦 มีการปรับวัตถุดิบ", size: "lg", weight: "bold", color: "#ffffff" }],
          backgroundColor: "#3B82F6"
        },
        body: {
          type: "box",
          layout: "vertical",
          spacing: "md",
          contents: [
            { type: "text", text: `👤 โดย: ${username}`, wrap: true },
            { type: "text", text: `🕒 เวลา: ${now}`, wrap: true }
          ]
        }
      }
    };

    lineClient.pushMessage(GROUP_ID, message)
      .then(() => res.send("✅ บันทึกและแจ้งเตือนแล้ว"))
      .catch(() => res.status(500).send("❌ บันทึกได้แต่แจ้งเตือนไม่สำเร็จ"));
  });
});

// ✅ รีเซ็ตช่อง “สั่งซื้อ” ทุกวันเวลา 12:00
schedule.scheduleJob("0 12 * * *", () => {
  fs.readFile(DATA_PATH, "utf8", (err, raw) => {
    if (err) return;
    const rawParsed = JSON.parse(raw);
    const data = Array.isArray(rawParsed) ? rawParsed : rawParsed.data;

    data.forEach(cat => cat.ingredients.forEach(i => i.to_buy = 0));

    const wrapped = Array.isArray(rawParsed) ? data : { ...rawParsed, data };
    fs.writeFile(DATA_PATH, JSON.stringify(wrapped, null, 2), () => {
      console.log("✅ รีเซ็ตช่องสั่งซื้อแล้ว");
    });
  });
});

// ✅ สรุปยอดตอน 00:00 ของทุกวัน
schedule.scheduleJob("0 0 * * *", () => {
  fs.readFile(DATA_PATH, "utf8", (err, raw) => {
    if (err) return;
    const rawParsed = JSON.parse(raw);
    const data = Array.isArray(rawParsed) ? rawParsed : rawParsed.data;

    const summary = [];
    data.forEach(cat => {
      cat.ingredients.forEach(i => {
        summary.push({
          name: i.name,
          used: i.used || 0,
          remaining: i.remaining || 0,
          to_buy: i.to_buy || 0
        });
      });
    });

    const today = dayjs().tz("Asia/Bangkok").format("DD/MM/YYYY");

    const message = {
      type: "flex",
      altText: `สรุปยอดวัตถุดิบประจำวันที่ ${today}`,
      contents: {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          contents: [{ type: "text", text: "📊 สรุปยอดวันนี้", size: "lg", weight: "bold", color: "#ffffff" }],
          backgroundColor: "#10B981"
        },
        body: {
          type: "box",
          layout: "vertical",
          contents: summary.slice(0, 10).map(i => ({
            type: "text",
            text: `🍴 ${i.name} | ใช้: ${i.used} | คงเหลือ: ${i.remaining} | สั่ง: ${i.to_buy}`,
            wrap: true
          }))
        }
      }
    };

    lineClient.pushMessage(GROUP_ID, message)
      .then(() => console.log("✅ ส่งสรุปยอดแล้ว"))
      .catch(err => console.error("❌ ส่งไม่สำเร็จ:", err));

    fs.writeFile(SUMMARY_PATH, JSON.stringify(summary, null, 2), () => {
      console.log("✅ บันทึกสรุปยอดแล้ว");
    });
  });
});

// ✅ Start Server
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
