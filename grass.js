const fs = require("fs");
const readline = require("readline");
const { v4: uuidv4 } = require("uuid");
const WebSocket = require("ws");
const UserAgent = require("user-agents");
const axios = require("axios");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function getRandomUserAgent() {
  const userAgentInstance = new UserAgent();
  return userAgentInstance.toString();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const userAgent = getRandomUserAgent();
function clearConsole() {
  console.clear();
  console.log("===================");
  console.log("\x1b[35mBY: wrightL\x1b[0m");
  console.log("\x1b[34mGITHUB: https://github.com/wrightL-dev\x1b[0m");
  console.log("\x1b[36mTELEGRAM CHANNEL: https://t.me/tahuri01\x1b[0m");
  console.log("===================");
}

function loadUserIds() {
  try {
    const data = fs.readFileSync("users.txt", "utf8");
    return data
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (error) {
    console.error(
      "\x1b[31mFile users.txt tidak ditemukan atau format tidak valid!\x1b[0m"
    );
    console.log("===================");
    return [];
  }
}

async function loginUser() {
  rl.question("\x1b[33mMasukkan Username:\x1b[0m ", async (username) => {
    rl.question("\x1b[33mMasukkan Password:\x1b[0m ", async (password) => {
      try {
        const response = await axios.post(
          "https://api.getgrass.io/login",
          {
            username: username,
            password: password
          },
          {
            headers: {
              "Content-Type": "text/plain;charset=UTF-8",
              Origin: "https://app.getgrass.io",
              Referer: "https://app.getgrass.io/",
              "User-Agent": getRandomUserAgent(),
              "sec-ch-ua": '"Not)A;Brand";v="24", "Chromium";v="116"',
              "sec-ch-ua-mobile": "?0",
              "sec-ch-ua-platform": '"Linux"'
            }
          }
        );

        const { accessToken, refreshToken, userId } = response.data.result.data;
        console.log(`\x1b[32mLogin berhasil! User ID: ${userId}\x1b[0m`);
        console.log("===================");

        // Save the userId to users.txt
        fs.appendFileSync("users.txt", `${userId}\n`, "utf8");

        rl.question(
          "\x1b[36mIngin login akun lagi? (y/n):\x1b[0m ",
          (answer) => {
            if (answer.toLowerCase() === "y") {
              loginUser();
            } else {
              mainMenu();
            }
          }
        );
      } catch (error) {
        console.error(
          `\x1b[31mLogin gagal: ${error.response.data.message}\x1b[0m`
        );
        console.log("===================");
        rl.question("\x1b[36mIngin coba lagi? (y/n):\x1b[0m ", (answer) => {
          if (answer.toLowerCase() === "y") {
            loginUser();
          } else {
            mainMenu();
          }
        });
      }
    });
  });
}

async function connectWebSocket(userId, proxy, deviceId) {
  const socketURL = "wss://proxy.wynd.network:4650/";
  let ws;

  const connectionOptions = {
    headers: { "User-Agent": userAgent },
    rejectUnauthorized: false,
    agent: proxy ? new WebSocket.Client({ proxy }) : undefined
  };

  function initializeWebSocket() {
    ws = new WebSocket(socketURL);

    ws.on("open", () => {
      console.log(`\x1b[34m[${userId}] Koneksi berhasil\x1b[0m`);

      const validateJwt = JSON.stringify({
        jwt: { action: "getCurrentVersion" },
        action: "VALIDATE_JWT"
      });
      ws.send(validateJwt);

      const pingPayload = JSON.stringify({
        id: uuidv4(),
        version: "1.0.0",
        action: "PING",
        data: {}
      });
      ws.send(pingPayload);
      console.log("PING:", pingPayload);

      setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          const pingPayload = JSON.stringify({
            id: uuidv4(),
            version: "1.0.0",
            action: "PING",
            data: {}
          });
          ws.send(pingPayload);
          console.log(pingPayload);
        }
      }, 2 * 60 * 1000); // tiap 2 menit
    });

    ws.on("message", (data) => {
      const message = JSON.parse(data);
      console.log(
        `\x1b[36mPesan diterima untuk User ID ${userId}:\x1b[0m`,
        message
      );
   
      if (message.action === "AUTH") {
        const authResponse = {
          id: message.id,
          origin_action: "AUTH",
          result: {
            browser_id: deviceId,
            user_id: userId,
            user_agent: userAgent,
            timestamp: Math.floor(Date.now() / 1000),
            device_type: "extension",
            version: "4.26.2",
            extension_id: "lkbnfiajjmbhnfledhphioinpickokdi"
          }
        };
        console.log(`\x1b[35m[${userId}] Mengirim respons AUTH\x1b[0m`);
        ws.send(JSON.stringify(authResponse));
      } else if (message.action === "PONG") {
        const pongResponse = {
          id: message.id,
          origin_action: "PONG"
        };
        ws.send(JSON.stringify(pongResponse));
        console.log("PONG:", pongResponse);
        console.log("===================");
      }
    });

    ws.on("error", (error) => {
      console.error(
        `\x1b[31m[${userId}] Terjadi kesalahan: ${error.message}\x1b[0m`
      );
    });

    ws.on("close", () => {
      console.log(
        `\x1b[31m[${userId}] Koneksi ditutup, mencoba ulang...\x1b[0m`
      );
      setTimeout(initializeWebSocket, 5000); // Mencoba ulang setelah 5 detik
    });
  }

  initializeWebSocket();
}

async function establishWebSocketConnection(userId, proxy = null) {
  const deviceId = uuidv4();
  const ipclient = await getClientIp();
  console.log("IP:", ipclient);
  console.log("\x1b[32mDevice ID:\x1b[0m", deviceId);
  console.log("\x1b[33mUser ID:\x1b[0m", userId);
  console.log("\x1b[36mUser Agent:\x1b[0m", userAgent);
  console.log("===================");

  connectWebSocket(userId, proxy, deviceId);
}

async function getClientIp() {
  try {
    const response = await axios.get(
      "https://api.bigdatacloud.net/data/client-ip",
      {
        headers: {
          "Sec-Ch-Ua":
            '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
          Accept: "application/json, text/plain, */*",
          "Sec-Ch-Ua-Mobile": "?0",
          "User-Agent": userAgent,
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Dest": "empty",
          "Accept-Encoding": "gzip, deflate, br",
          "Accept-Language": "en-US,en;q=0.9",
          Priority: "u=1, i"
        },
        http2: true 
      }
    );
    return response.data.ipString;
  } catch (error) {
    console.error("Gagal mendapatkan IP client:", error.message);
  }
}

function mainMenu() {
  clearConsole();

  console.log("\x1b[34mPilih opsi:\x1b[0m");
  console.log("1. Login untuk mendapatkan User ID");
  console.log("2. Mulai Farming");
  console.log("===================");

  rl.question("\x1b[36mMasukkan nomor pilihan:\x1b[0m ", (choice) => {
    if (choice === "1") {
      loginUser();
    } else if (choice === "2") {
      const userIds = loadUserIds();
      if (userIds.length === 0) {
        console.error(
          "\x1b[31mTidak ada User ID yang ditemukan di users.txt!\x1b[0m"
        );
        console.log("===================");
        mainMenu();
      } else {
        const tasks = userIds.map((userId) =>
          establishWebSocketConnection(userId)
        );
        Promise.all(tasks);
      }
    } else {
      console.error("\x1b[31mPilihan tidak valid!\x1b[0m");
      console.log("===================");
      mainMenu();
    }
  });
}

mainMenu();
