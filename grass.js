const fs = require("fs");
const readline = require("readline");
const { v4: uuidv4 } = require("uuid");
const WebSocket = require("ws");
const UserAgent = require("user-agents");
const axios = require("axios");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { Worker, isMainThread, workerData } = require("worker_threads");

const proxies = (() => {
  try {
    const proxyData = fs.readFileSync("./proxy.txt", "utf8");
    return proxyData.split("\n").map(line => line.trim()).filter(Boolean);
  } catch (error) {
    console.error("\x1b[31mFile proxy.txt tidak ditemukan atau format tidak valid!\x1b[0m");
    return [];
  }
})();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function getRandomUserAgent() {
  return new UserAgent().toString();
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
    return data.split("\n").map(line => line.trim()).filter(Boolean);
  } catch (error) {
    console.error("\x1b[31mFile users.txt tidak ditemukan atau format tidak valid!\x1b[0m");
    console.log("===================");
    return [];
  }
}


async function loginUser() {
  rl.question("\x1b[33mMasukkan Username:\x1b[0m ", async username => {
    rl.question("\x1b[33mMasukkan Password:\x1b[0m ", async password => {
      try {
        const response = await axios.post("https://api.getgrass.io/login", { username, password }, {
          headers: {
            "Content-Type": "text/plain;charset=UTF-8", Origin: "https://app.getgrass.io",
            Referer: "https://app.getgrass.io/", "User-Agent": getRandomUserAgent(),
            "sec-ch-ua": '"Not)A;Brand";v="24", "Chromium";v="116"', "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Linux"',
          },
        });
        const { userId } = response.data.result.data;
        console.log(`\x1b[32mLogin berhasil! User ID: ${userId}\x1b[0m`);
        console.log("===================");
        fs.appendFileSync("users.txt", `${userId}\n`, "utf8");
        rl.question("\x1b[36mIngin login akun lagi? (y/n):\x1b[0m ", answer => {
          if (answer.toLowerCase() === "y") loginUser();
          else mainMenu();
        });
      } catch (error) {
        console.error(`\x1b[31mLogin gagal: ${error.response?.data?.message || error.message}\x1b[0m`);
        console.log("===================");
        rl.question("\x1b[36mIngin coba lagi? (y/n):\x1b[0m ", answer => {
          if (answer.toLowerCase() === "y") loginUser();
          else mainMenu();
        });
      }
    });
  });
}

async function getClientIp() {
  try {
    const response = await axios.get("https://api.bigdatacloud.net/data/client-ip", { headers: { "User-Agent": userAgent, "Accept": "application/json" } });
    return response.data.ipString;
  } catch (error) {
    console.error("Gagal mendapatkan IP client:", error.message);
    return null;
  }
}

async function connectWebSocket(userId) {
  const deviceId = uuidv4();
  const ipclient = await getClientIp();
  console.log("IP:", ipclient || "Tidak diketahui");
  console.log("\x1b[32mDevice ID:\x1b[0m", deviceId);
  console.log("\x1b[33mUser ID:\x1b[0m", userId);
  console.log("\x1b[36mUser Agent:\x1b[0m", userAgent);
  console.log("===================");

  const socketURL = "wss://proxy.wynd.network:4650/";
  const ws = new WebSocket(socketURL, { headers: { "User-Agent": userAgent } });

  ws.on("open", () => {
    console.log(`\x1b[34m[${userId}] Koneksi berhasil tanpa proxy\x1b[0m`);
    ws.send(JSON.stringify({ jwt: { action: "getCurrentVersion" }, action: "VALIDATE_JWT" }));
    const pingPayload = JSON.stringify({ id: uuidv4(), version: "1.0.0", action: "PING", data: {} });
    ws.send(pingPayload);
    setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ id: uuidv4(), version: "1.0.0", action: "PING", data: {} })); }, 2 * 60 * 1000);
  });

  ws.on("message", data => {
    const message = JSON.parse(data);
    console.log(`\x1b[36mPesan diterima untuk User ID ${userId} tanpa proxy:\x1b[0m`, message);
    if (message.action === "AUTH") {
      const authResponse = {
        id: message.id, origin_action: "AUTH", result: {
          browser_id: deviceId, user_id: userId, user_agent: userAgent,
          timestamp: Math.floor(Date.now() / 1000), device_type: "extension",
          version: "4.26.2", extension_id: "lkbnfiajjmbhnfledhphioinpickokdi"
        }
      };
      ws.send(JSON.stringify(authResponse));
    } else if (message.action === "PONG") ws.send(JSON.stringify({ id: message.id, origin_action: "PONG" }));
  });

  ws.on("error", error => { 
    console.error(`\x1b[31m[${userId}] Terjadi kesalahan tanpa proxy: ${error.message}\x1b[0m`);
    setTimeout(() => connectWebSocket(userId), 5000);
});

ws.on("close", () => { 
    console.log(`\x1b[31m[${userId}] Koneksi ditutup tanpa proxy\x1b[0m`);
    setTimeout(() => connectWebSocket(userId), 5000);
});
}

async function connectWebSocketWithProxy(userId, proxy) {
  const deviceId = uuidv4();
  const ipclient = await getClientIp();
  const userAgent = getRandomUserAgent();
  console.log("IP:", ipclient || "Tidak diketahui");
  console.log("\x1b[32mDevice ID:\x1b[0m", deviceId);
  console.log("\x1b[33mUser ID:\x1b[0m", userId);
  console.log("\x1b[36mUser Agent:\x1b[0m", userAgent);
  console.log("\x1b[36mProxy:\x1b[0m", proxy);
  console.log("===================");

  const socketURL = "wss://proxy.wynd.network:4650/";
  const agent = new HttpsProxyAgent(proxy);
  const ws = new WebSocket(socketURL, { agent, headers: { "User-Agent": userAgent } });

  ws.on("open", () => {
    console.log(`\x1b[34m[${userId}] Koneksi berhasil dengan proxy: ${proxy}, deviceId: ${deviceId}\x1b[0m`);
    ws.send(JSON.stringify({ jwt: { action: "getCurrentVersion" }, action: "VALIDATE_JWT" }));
    const pingPayload = JSON.stringify({ id: uuidv4(), version: "1.0.0", action: "PING", data: {} });
    ws.send(pingPayload);
    setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ id: uuidv4(), version: "1.0.0", action: "PING", data: {} })); }, 2 * 60 * 1000);
  });

  ws.on("message", data => {
    const message = JSON.parse(data);
    console.log(`\x1b[36mPesan diterima untuk User ID ${userId} dengan proxy ${proxy}:\x1b[0m`, message);
    if (message.action === "AUTH") {
      const authResponse = { id: message.id, origin_action: "AUTH", result: { browser_id: deviceId, user_id: userId, user_agent: userAgent, timestamp: Math.floor(Date.now() / 1000), device_type: "extension", version: "4.26.2", extension_id: "lkbnfiajjmbhnfledhphioinpickokdi" } };
      ws.send(JSON.stringify(authResponse));
    } else if (message.action === "PONG") ws.send(JSON.stringify({ id: message.id, origin_action: "PONG" }));
  });

  ws.on("error", error => { /*console.error(`\x1b[31m[${userId}] Terjadi kesalahan dengan proxy ${proxy}: ${error.message}\x1b[0m`);*/ reconnect(); });
  ws.on("close", () => { /*console.log(`\x1b[31m[${userId}] Koneksi ditutup dengan proxy ${proxy}, mencoba ulang...\x1b[0m`);*/ reconnect(); });

  function reconnect() { setTimeout(() => { /*console.log(`\x1b[33m[${userId}] Mencoba menyambung kembali dengan proxy ${proxy}...\x1b[0m`);*/ connectWebSocketWithProxy(userId, proxy); }, 5000); }

}

function mainMenu() {
  clearConsole();
  console.log("Menu:");
  console.log("1. Login User");
  console.log("2. Koneksi WebSocket Tanpa Proxy");
  console.log("3. Koneksi WebSocket Dengan Proxy");
  console.log("4. Keluar");

  rl.question("\x1b[33mPilih opsi (1-4):\x1b[0m ", async option => {
    if (option === "1") loginUser();
    else if (option === "2") {
      const userIds = loadUserIds();
      if (userIds.length > 0) for (const userId of userIds) { connectWebSocket(userId); await delay(1000); }
      else { console.log("\x1b[31mTidak ada User ID yang ditemukan!\x1b[0m"); console.log("==================="); mainMenu(); }
    } else if (option === "3") {
      const userIds = loadUserIds();
      if (userIds.length > 0 && proxies.length > 0) userIds.forEach(userId => proxies.forEach(proxy => new Worker(__filename, { workerData: { userId, proxy } })));
      else { console.log("\x1b[31mTidak ada User ID atau proxy yang ditemukan!\x1b[0m"); console.log("==================="); mainMenu(); }

    } else if (option === "4") { console.log("\x1b[32mTerima kasih telah menggunakan program ini!\x1b[0m"); rl.close(); process.exit(0); }
    else { console.log("\x1b[31mOpsi tidak valid!\x1b[0m"); console.log("==================="); mainMenu(); }
  });
}

if (isMainThread) { clearConsole(); mainMenu(); } else { const { userId, proxy } = workerData; connectWebSocketWithProxy(userId, proxy); }
