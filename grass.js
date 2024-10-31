const fs = require('fs');
const readline = require('readline');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const UserAgent = require('user-agents');
const axios = require('axios');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function getRandomUserAgent() {
    const userAgentInstance = new UserAgent();
    return userAgentInstance.toString();
}

function clearConsole() {
    console.clear();
    console.log('===================');
    console.log('\x1b[35mBY: wrightL\x1b[0m');
    console.log('\x1b[34mGITHUB: https://github.com/wrightL-dev\x1b[0m');
    console.log('\x1b[36mTELEGRAM CHANNEL: https://t.me/tahuri01\x1b[0m');
    console.log('===================');
}

function loadProxy() {
    try {
        const proxy = fs.readFileSync('proxy.txt', 'utf8').trim();
        return proxy ? proxy : null;
    } catch (error) {
        console.log('\x1b[31mFile proxy.txt tidak ditemukan! Menggunakan koneksi tanpa proxy.\x1b[0m');
        console.log('===================');
        return null;
    }
}

function loadUserIds() {
    try {
        const data = fs.readFileSync('users.txt', 'utf8');
        return data.split('\n').map(line => line.trim()).filter(Boolean);
    } catch (error) {
        console.error('\x1b[31mFile users.txt tidak ditemukan atau format tidak valid!\x1b[0m');
        console.log('===================');
        return [];
    }
}

async function loginUser() {
    rl.question('\x1b[33mMasukkan Username:\x1b[0m ', async (username) => {
        rl.question('\x1b[33mMasukkan Password:\x1b[0m ', async (password) => {
            try {
                const response = await axios.post('https://api.getgrass.io/login', {
                    username: username,
                    password: password
                }, {
                    headers: {
                        'Content-Type': 'text/plain;charset=UTF-8',
                        'Origin': 'https://app.getgrass.io',
                        'Referer': 'https://app.getgrass.io/',
                        'User-Agent': getRandomUserAgent(),
                        'sec-ch-ua': '"Not)A;Brand";v="24", "Chromium";v="116"',
                        'sec-ch-ua-mobile': '?0',
                        'sec-ch-ua-platform': '"Linux"'
                    }
                });

                const { accessToken, refreshToken, userId } = response.data.result.data;
                console.log(`\x1b[32mLogin berhasil! User ID: ${userId}\x1b[0m`);
                console.log('===================');
                
                fs.appendFileSync('users.txt', `${userId}\n`, 'utf8');
                console.log(`\x1b[34mUser ID disimpan di users.txt\x1b[0m`);
                console.log('===================');

                rl.question('\x1b[36mIngin login akun lagi? (y/n):\x1b[0m ', (answer) => {
                    if (answer.toLowerCase() === 'y') {
                        loginUser();
                    } else {
                        mainMenu();
                    }
                });
            } catch (error) {
                console.error(`\x1b[31mLogin gagal: ${error.response.data.message}\x1b[0m`);
                console.log('===================');
                rl.question('\x1b[36mIngin coba lagi? (y/n):\x1b[0m ', (answer) => {
                    if (answer.toLowerCase() === 'y') {
                        loginUser();
                    } else {
                        mainMenu();
                    }
                });
            }
        });
    });
}

async function establishWebSocketConnection(userId, proxy = null) {
    const deviceId = uuidv4();
    const userAgent = getRandomUserAgent();

    console.log('\x1b[32mDevice ID:\x1b[0m', deviceId);
    console.log('\x1b[33mUser ID:\x1b[0m', userId);
    console.log('\x1b[36mUser Agent:\x1b[0m', userAgent);
    console.log('===================');

    const socketURL = 'wss://proxy.wynd.network:4650/';

    while (true) {
        try {
            await new Promise(resolve => setTimeout(resolve, 20000));
            const connectionOptions = {
                headers: { 'User-Agent': userAgent },
                rejectUnauthorized: false,
                agent: proxy ? new WebSocket.Client({ proxy }) : undefined
            };

            const ws = new WebSocket(socketURL, connectionOptions);

            ws.on('open', () => {
                console.log(`\x1b[34m[${userId}] Koneksi berhasil, PING dikirim\x1b[0m`);
                console.log('===================');
                const pingPayload = JSON.stringify({
                    id: uuidv4(),
                    version: '1.0.0',
                    action: 'PING',
                    data: {}
                });
                ws.send(pingPayload);
            });

            ws.on('message', (data) => {
                const message = JSON.parse(data);
                console.log(`\x1b[36mPesan diterima untuk User ID ${userId}:\x1b[0m`, message);
                console.log('===================');

                if (message.result && message.result.balance !== undefined) {
                    console.log(`\x1b[32m[${userId}] Balance diperbarui: ${message.result.balance}\x1b[0m`);
                    console.log('===================');
                }

                if (message.action === 'AUTH') {
                    const authResponse = {
                        id: message.id,
                        origin_action: 'AUTH',
                        result: {
                            browser_id: deviceId,
                            user_id: userId,
                            user_agent: userAgent,
                            timestamp: Math.floor(Date.now() / 1000),
                            device_type: 'extension',
                            version: '2.5.0'
                        }
                    };
                    console.log(`\x1b[35m[${userId}] Mengirim respons AUTH\x1b[0m`);
                    console.log('===================');
                    ws.send(JSON.stringify(authResponse));
                } else if (message.action === 'PONG') {
                    const pongResponse = { id: message.id, origin_action: 'PONG' };
                    console.log(`\x1b[34m[${userId}] PONG diterima, membalas...\x1b[0m`);
                    console.log('===================');
                    ws.send(JSON.stringify(pongResponse));
                }
            });

            ws.on('error', (error) => {
                console.error(`\x1b[31m[${userId}] Terjadi kesalahan: ${error.message}\x1b[0m`);
                console.log('===================');
            });

            ws.on('close', () => {
                console.log(`\x1b[31m[${userId}] Koneksi ditutup, mencoba ulang...\x1b[0m`);
                console.log('===================');
            });

            await new Promise(resolve => ws.on('close', resolve));
        } catch (error) {
            console.error(`\x1b[31m[${userId}] Terjadi kesalahan: ${error.message}\x1b[0m`);
            console.log('===================');
            await new Promise(resolve => setTimeout(resolve, 20000));
        }
    }
}

function mainMenu() {
    clearConsole();
    console.log('\x1b[34mPilih opsi:\x1b[0m');
    console.log('1. Login untuk mendapatkan User ID');
    console.log('2. Mulai Farming');
    console.log('===================');

    rl.question('\x1b[36mMasukkan nomor pilihan:\x1b[0m ', (choice) => {
        if (choice === '1') {
            loginUser();
        } else if (choice === '2') {
            const userIds = loadUserIds();
            if (userIds.length === 0) {
                console.error('\x1b[31mTidak ada User ID yang ditemukan di users.txt!\x1b[0m');
                console.log('===================');
                mainMenu();
            } else {
                const tasks = userIds.map(userId => establishWebSocketConnection(userId));
                Promise.all(tasks).catch(error => console.error('Error in farming:', error));
            }
        } else {
            console.error('\x1b[31mPilihan tidak valid!\x1b[0m');
            console.log('===================');
            mainMenu();
        }
    });
}

mainMenu();