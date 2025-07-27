const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const { Client, middleware } = require("@line/bot-sdk");
const schedule = require("node-schedule"); // ✅ ใช้สำหรับ schedule

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = path.join(__dirname, "data.json");
const SUMMARY_PATH = path.join(__dirname, "summary.json");

// 🟩 LINE Bot Config
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const lineClient = new Client(lineConfig);
const GROUP_ID = process.env.LINE_GROUP_ID || "C14991c0252e1bf8eea85a7c66eb0b0ef";

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// 🟩 หน้าเว็บหลัก
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 🟩 ดึงข้อมูลวัตถุดิบ
app.get("/data.json", (req, res) => {
  fs.readFile(DATA_PATH, "utf8", (err, data) => {
    if (err) return res.status(500).send("ไม่สามารถโหลดข้อมูลได้");
    res.json(JSON.parse(data));
  });
});

// ✅ บันทึกข้อมูล + แจ้งเตือน LINE
app.post("/save", (req, res) => {
  const newData = req.body.data;
  const username = req.body.username || "ไม่ระบุชื่อ";

  if (!newData) return res.status(400).send("❌ ไม่พบข้อมูล");

  fs.writeFile(DATA_PATH, JSON.stringify(newData, null, 2), (err) => {
    if (err) return res.status(500).send("❌ บันทึกไม่สำเร็จ");

    const now = new Date();
    const dateStr = now.toLocaleDateString("th-TH");
    const timeStr = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

    const message = {
      type: "flex",
      altText: "มีการปรับวัตถุดิบ",
      contents: {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          contents: [{ type: "text", text: "📦 มีการปรับวัตถุดิบ", weight: "bold", size: "lg", color: "#ffffff" }],
          backgroundColor: "#3B82F6"
        },
        body: {
          type: "box",
          layout: "vertical",
          spacing: "md",
          contents: [
            { type: "text", text: `👤 โดย: ${username}`, wrap: true },
            { type: "text", text: `🕒 เวลา: ${dateStr} ${timeStr}`, wrap: true }
          ]
        }
      }
    };

    lineClient.pushMessage(GROUP_ID, message)
      .then(() => res.status(200).send("✅ บันทึกและแจ้งเตือนแล้ว"))
      .catch(() => res.status(500).send("❌ บันทึกได้แต่แจ้งเตือนไม่สำเร็จ"));
  });
});

// ✅ Webhook รับข้อความจาก LINE
app.post("/webhook", (req, res) => {
  res.status(200).send("OK");

  const events = req.body.events;
  if (!events || events.length === 0) return;

  events.forEach((event) => {
    if (event.type === "message" && event.message.type === "text") {
      if (event.replyToken) {
        lineClient.replyMessage(event.replyToken, {
          type: "text",
          text: "✅ รับข้อความแล้ว: " + event.message.text,
        });
      }
    }
  });
});

// ✅ ส่ง Flex ปุ่มเข้าเว็บ
function sendFlexOpenLink() {
  const message = {
    type: "flex",
    altText: "เปิดระบบจัดการวัตถุดิบ",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: "ระบบจัดการวัตถุดิบร้านป.เคราทอง", weight: "bold", size: "lg" },
          {
            type: "button",
            style: "primary",
            action: {
              type: "uri",
              label: "เปิดระบบ",
              uri: `https://pokhaothong-ingredients.onrender.com/?groupId=${GROUP_ID}`
            }
          }
        ]
      }
    }
  };

  lineClient.pushMessage(GROUP_ID, message)
    .then(() => console.log("✅ ส่งปุ่มเปิดระบบไปยังกลุ่มแล้ว"))
    .catch(err => console.error("❌ ส่งไม่สำเร็จ:", err));
}

// ✅ Schedule: รีเซ็ตช่อง "สั่งซื้อ" เป็น 0 ตอน 12.00 น.
schedule.scheduleJob("0 12 * * *", () => {
  fs.readFile(DATA_PATH, "utf8", (err, raw) => {
    if (err) return;
    let data = JSON.parse(raw);
    data.forEach(cat => cat.ingredients.forEach(i => i.to_buy = 0));
    fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), () => {
      console.log("✅ รีเซ็ตช่องสั่งซื้อแล้ว");
    });
  });
});

// ✅ Schedule: สรุปยอดเที่ยงคืน
schedule.scheduleJob("0 0 * * *", () => {
  fs.readFile(DATA_PATH, "utf8", (err, raw) => {
    if (err) return;
    let data = JSON.parse(raw);

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

    fs.writeFile(SUMMARY_PATH, JSON.stringify(summary, null, 2), () => {
      console.log("✅ บันทึกสรุปยอดแล้ว");
    });

    const message = {
      type: "flex",
      altText: "สรุปยอดวัตถุดิบประจำวันที่",
      contents: {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          contents: [{ type: "text", text: "📊 สรุปยอดวันนี้", weight: "bold", size: "lg", color: "#ffffff" }],
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
      .then(() => console.log("✅ ส่งสรุปยอดเที่ยงคืนแล้ว"))
      .catch(err => console.error("❌ ส่งสรุปยอดไม่ได้:", err));
  });
});

// 🟩 เริ่มรันเซิร์ฟเวอร์
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
  sendFlexOpenLink();
});
