import {app, BrowserWindow, ipcMain, Menu, Tray} from 'electron';
import path from 'path';
import axios from 'axios';
import {fileURLToPath} from 'url';

// 获取 __dirname 的替代方法
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let tray;

function createWindow() {
    // 如果窗口已存在，直接返回
    if (mainWindow) {
        return;
    }

    Menu.setApplicationMenu(null);

    mainWindow = new BrowserWindow({
        width: 800,
        height: 800,
        icon: path.join(__dirname, './public/favicon.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'), // 使用 __dirname 来确保路径正确
            contextIsolation: true,
            enableRemoteModule: false,
            nodeIntegration: false, // 确保为 false，增强安全性
        },
    });

    if (process.platform === 'darwin') {
        app.dock.setIcon(path.join(__dirname, './public/favicon.ico'));
    }

    // 这里加载你的 React 应用
    // mainWindow.loadURL('http://localhost:5173'); // 根据你的开发端口修改
    // mainWindow.loadFile('./dist/index.html')
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));

    // 打开开发者工具（可选）
    // mainWindow.webContents.openDevTools();

    // 监听窗口关闭事件
    mainWindow.on('close', (event) => {
        if (!app.isQuiting) {
            event.preventDefault();
            mainWindow.hide(); // 隐藏窗口
        }
    });
}

// 创建托盘图标
function createTray() {
    tray = new Tray(path.join(__dirname, './public/favicon.ico')); // 确保有一个托盘图标
    const contextMenu = Menu.buildFromTemplate([
        {
            label: '显示',
            click: () => {
                mainWindow.show();
            },
        },
        {
            label: '退出',
            click: () => {
                app.isQuiting = true;
                app.quit();
            },
        },
    ]);
    tray.setToolTip('武汉大学校园网客户端');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    });
}

app.whenReady().then(() => {
    createWindow(); // 确保只调用一次创建窗口
    createTray(); // 创建托盘
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow(); // 确保在没有窗口时创建新窗口
    }
});

// IPC 处理
ipcMain.on('minimize-to-tray', () => {
    mainWindow.hide(); // 隐藏窗口
});
// 处理 IPC 消息
ipcMain.handle('login', async (event, username, password, loginType) => {
    const getIndexUrl = "http://www.bilibili.com/"; // 确保使用 HTTPS

    try {
        const response = await axios.get(getIndexUrl);

        // 处理重定向
        if (response.status === 301 || response.status === 302) {
            const newUrl = response.headers['location']; // 获取重定向的 URL
            const redirectResponse = await axios.get(newUrl);
            // 这里可以处理重定向后的响应
            return { success: true, message: '已重定向', data: redirectResponse.data };
        }

        // 处理正常响应
        if (response.data.includes('bilibili')) {
            return { success: true, message: '已登录~' };
        }

        const indexUrl = response.data.split("'")[1];
        const parsedUrl = new URL(indexUrl);
        const queryString = parsedUrl.search;
        const ip = parsedUrl.hostname;
        const port = parsedUrl.port;

        const ipPortUrl = `http://${ip}:${port}`;
        const headers = {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Connection": "keep-alive",
            "Referer": getIndexUrl,
            "Upgrade-Insecure-Requests": "1",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
        };

        const indexResponse = await axios.get(indexUrl, { headers, validateStatus: false });

        const setCookie = indexResponse.headers['set-cookie'];
        let jsessionid = "";
        if (setCookie) {
            for (const cookie of setCookie) {
                if (cookie.includes("JSESSIONID")) {
                    jsessionid = cookie.split('=')[1].split(';')[0];
                }
            }
        }

        const loginUrl = `${ipPortUrl}/eportal/InterFace.do?method=login`;
        const loginHeaders = {
            "Accept": "*/*",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Connection": "keep-alive",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Cookie": `JSESSIONID=${jsessionid}`,
            "Origin": ipPortUrl,
            "Referer": indexUrl,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
        };

        const loginData = new URLSearchParams({
            userId: username,
            password: password,
            service: loginType,
            queryString: queryString,
            operatorPwd: "",
            operatorUserId: "",
            validcode: "",
            passwordEncrypt: "false"
        });

        const loginResponse = await axios.post(loginUrl, loginData, { headers: loginHeaders });

        if (loginResponse.status === 200) {
            const result = loginResponse.data;
            if (result.result === 'success') {
                return { success: true, message: '登录成功~', ip:ip, port:port, userIndex: result.userIndex };
            } else {
                return { success: false, message: '登录失败：' + (result.message || '未知错误') };
            }
        } else {
            return { success: false, message: '登录请求失败，状态码：' + loginResponse.status };
        }
    } catch (error) {
        return { success: false, message: '发生错误：' + error.message };
    }
});

ipcMain.handle('get_info', async (event, ip, port) => {
    const ipPortUrl = `http://${ip}:${port}`;
    const indexUrl = `${ipPortUrl}/eportal/success.jsp`;
    const headers = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Connection': 'keep-alive',
        'Host': `${ip}:${port}`,
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    };

    try {
        // 发送 GET 请求以获取用户信息
        const response = await axios.get(indexUrl, { headers });

        // 获取 Set-Cookie 头部以提取 JSESSIONID

        const setCookie = response.headers['set-cookie'];
        let jsessionid = "";
        if (setCookie) {
            for (const cookie of setCookie) {
                if (cookie.includes("JSESSIONID")) {
                    jsessionid = cookie.split('=')[1].split(';')[0];
                }
            }
        }

        // 获取在线用户信息
        const getOnlineUserInfoUrl = `${ipPortUrl}/eportal/InterFace.do?method=getOnlineUserInfo`;
        const getOnlineUserInfoHeaders = {
            'Accept': '*/*',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'Connection': 'keep-alive',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Cookie': `JSESSIONID=${jsessionid}`,
            'Origin': ipPortUrl,
            'Referer': indexUrl,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        };

        const getOnlineUserInfoData = new URLSearchParams({
            userIndex: ''
        });

        // 发送获取在线用户信息请求
        const getOnlineUserInfoResponse = await axios.post(getOnlineUserInfoUrl, getOnlineUserInfoData, { headers: getOnlineUserInfoHeaders });

        const userInfo = getOnlineUserInfoResponse.data;


        return { success: true, data: userInfo };

    } catch (error) {
        return { success: false, message: '发生错误：' + error.message };
    }
});
// 定义下线功能的处理器
ipcMain.handle('logout_user', async (event, ip, port) => {
    const logoutUrl = `http://${ip}:${port}/eportal/InterFace.do?method=logout`;

    const logoutHeaders = {
        "Accept": "*/*",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Connection": "keep-alive",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
    };

    try {
        // 发送 POST 请求以下线用户
        const logoutResponse = await axios.post(logoutUrl, { headers: logoutHeaders });

        // 解析返回的 JSON 数据
        const responseResult = logoutResponse.data; // 根据实际返回的格式调整

        return { success: true, result: responseResult };
    } catch (error) {
        return { success: false, message: '发生错误：' + error.message };
    }
});
// 处理网络检查的 IPC 消息
ipcMain.handle('check-network', async () => {
    const getIndexUrl = "http://www.bilibili.com/"; // 确保使用 HTTPS
    // Cannot read properties of undefined (reading 'connected')
    try {
        const response = await axios.get(getIndexUrl);

        // 处理重定向
        // if (response.status === 301 || response.status === 302) {
        //     return { connected: false, message: '无法连接到网络' };
        // }
        // 处理正常响应
        if (response.status===200&&response.data.includes('bilibili')) {
            return { success: true, message: '已连接到网络~' };
        }
        else return { success: false, message: '无法连接到网络' };
    } catch (error) {
        return { success: false, message: '无法连接到网络' };
    }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
