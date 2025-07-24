const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const { Client } = require("@line/bot-sdk");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = path.join(__dirname, "data.json");

// ✅ LINE Bot Config
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "YOUR_TOKEN_HERE",
  channelSecret: process.env.LINE_CHANNEL_SECRET || "YOUR_SECRET_HERE",
};
const lineClient = new Client(lineConfig);
const GROUP_ID = process.env.LINE_GROUP_ID || "YOUR_GROUP_ID";

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// ✅ เส้นทางหน้าเว็บหลัก
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ✅ อ่านข้อมูล
app.get("/data.json", (req, res) => {
  fs.readFile(DATA_PATH, "utf8", (err, data) => {
    if (err) return res.status(500).send("Error reading data.");
    res.json(JSON.parse(data));
  });
});

// ✅ บันทึกข้อมูล
app.post("/save", (req, res) => {
  const newData = req.body;

  fs.writeFile(DATA_PATH, JSON.stringify(newData, null, 2), (err) => {
    if (err) return res.status(500).send("Error writing data.");

    // ส่งแจ้งเตือนไปไลน์
    const date = new Date();
    const timestamp = date.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
    const message = {
      type: "text",
      text: `📦 มีการอัปเดตวัตถุดิบเมื่อ ${timestamp}`,
    };

    lineClient.pushMessage(GROUP_ID, message).catch((error) => {
      console.error("LINE Notify Error:", error);
    });

    res.status(200).send("Data saved successfully.");
  });
});

// ✅ รับ webhook จาก LINE
app.post("/webhook", (req, res) => {
  const events = req.body.events;

  Promise.all(
    events.map(async (event) => {
      if (event.type === "message" && event.message.type === "text") {
        const userMessage = event.message.text.trim();

        if (userMessage === "สั่งซื้อ") {
          try {
            const rawData = fs.readFileSync(DATA_PATH);
            const data = JSON.parse(rawData);

            const itemsToOrder = [];

            for (const category of data.categories) {
              for (const item of category.ingredients) {
                if (item["สั่งซื้อ"] && item["สั่งซื้อ"] !== "") {
                  itemsToOrder.push(`• ${item.วัตถุดิบ} ${item["สั่งซื้อ"]} ${item.หน่วย}`);
                }
              }
            }

            const text =
              itemsToOrder.length > 0
                ? `🛒 รายการสั่งซื้อ:\n${itemsToOrder.join("\n")}`
                : "ยังไม่มีรายการสั่งซื้อ";

            await lineClient.replyMessage(event.replyToken, {
              type: "text",
              text,
            });
          } catch (error) {
            console.error("Read data error:", error);
          }
        }
      }
    })
  ).then(() => res.status(200).end());
});

// ✅ ส่งปุ่ม Flex Message “เปิดระบบ” ทันทีเมื่อเซิร์ฟเวอร์เริ่ม
function sendStartupMessage() {
  const flexMessage = {
    type: "flex",
    altText: "เปิดระบบจัดการวัตถุดิบ",
    contents: {
      type: "bubble",
      hero: {
        type: "image",
        url: "https://cdn.pixabay.com/photo/2017/01/31/20/14/icon-2027661_1280.png",
        size: "full",
        aspectRatio: "16:9",
        aspectMode: "cover",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "ระบบจัดการวัตถุดิบ",
            weight: "bold",
            size: "xl",
            align: "center",
          },
          {
            type: "text",
            text: "กดปุ่มด้านล่างเพื่อเข้าใช้งาน",
            size: "sm",
            color: "#888888",
            margin: "md",
            align: "center",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            action: {
              type: "uri",
              label: "เปิดระบบ",
              uri: "https://pokhaothong-ingredients.onrender.com",
            },
          },
        ],
      },
    },
  };

  lineClient.pushMessage(GROUP_ID, flexMessage).catch((err) => {
    console.error("Error sending startup message:", err);
  });
}

// ✅ เริ่มเซิร์ฟเวอร์
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  sendStartupMessage(); // ส่งเมื่อเริ่มระบบ
});
