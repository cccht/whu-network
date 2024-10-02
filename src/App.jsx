import React, {useEffect, useState} from 'react';
import {Button, Form, Input, message, Select, Spin, Switch, Tabs, Typography} from 'antd';
import './App.css';

const {Option} = Select;
const {ipcRenderer} = window.electron; // 从预加载脚本中获取 ipcRenderer
const {TabPane} = Tabs;
const {Title} = Typography;

const App = () => {
    const [form] = Form.useForm(); // 创建一个表单实例
    const [loading, setLoading] = useState(true);
    const [rememberPassword, setRememberPassword] = useState(false);
    const [autoLogin, setAutoLogin] = useState(false);
    const [minimizeToTray, setMinimizeToTray] = useState(false); // 新增状态
    const [quitApp, setQuitApp] = useState(false); // 新增状态
    // const [isLoggedIn, setIsLoggedIn] = useState(false); // 控制登录状态
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState(''); // 新增状态用于存储密码
    const [connectionType, setConnectionType] = useState(''); // 新增状态用于存储接入类型
    const [welcomeTip, setWelcomeTip] = useState('');
    const [data, setData] = useState(null); // 存储请求到的数据
    const [networkChecked, setNetworkChecked] = useState(false); // 检查网络状态
    useEffect(() => {
        // 监听 networkChecked 的变化
        if (!networkChecked) {
            const storedUsername = localStorage.getItem('username');
            const storedPassword = localStorage.getItem('password');
            const storedConnectionType = localStorage.getItem('connectionType');
            const storedRememberPassword = localStorage.getItem('rememberPassword') === 'true';
            const storedAutoLogin = localStorage.getItem('autoLogin') === 'true';
            const storedMinimizeToTray = localStorage.getItem('minimizeToTray') === 'true';
            const storedQuitApp = localStorage.getItem('quitApp') === 'true';

            if (storedUsername) {
                // 使用 form.setFieldsValue 来同步表单值
                form.setFieldsValue({
                    username: storedUsername,
                    password: storedPassword,
                    connectionType: storedConnectionType,
                });
                setRememberPassword(storedRememberPassword);
                setAutoLogin(storedAutoLogin);
                setMinimizeToTray(storedMinimizeToTray);
                setQuitApp(storedQuitApp);
                // setAutoLogin(false);
            }
        }
    }, [networkChecked, form]); // 添加 form 到依赖项中
    // 检查网络连接的状态
    useEffect(() => {
        const checkNetwork = async () => {
            try {
                const result = await ipcRenderer.invoke('check-network'); // 调用 Electron 后端的网络检查方法
                if (result.success) {
                    setNetworkChecked(true); // 网络已连接
                    let storedIp = localStorage.getItem('ip');
                    let storedPort = localStorage.getItem('port');

                    if (!storedIp) {
                        message.info('未缓存登录ip，使用校园网默认ip和port');
                        storedIp = '172.19.1.9';
                        storedPort = '8080';
                    }
                    await fetchUserInfo(storedIp, storedPort); // 登录成功后获取用户信息
                    setLoading(false);
                } else {
                    if (localStorage.getItem('storedAutoLogin')) {
                        message.info("已缓存登录信息，尝试自动登录~");
                        const storedUsername = localStorage.getItem('username');
                        const storedPassword = localStorage.getItem('password');
                        const storedConnectionType = localStorage.getItem('connectionType');
                        const result = await ipcRenderer.invoke('login', storedUsername, storedPassword, storedConnectionType);
                        if (result.success) {
                            message.success(result.message);
                            checkNetwork();
                        } else {
                            setNetworkChecked(false);
                            setLoading(false);
                        }
                    } else {
                        setNetworkChecked(false);
                        setLoading(false);
                    }
                }
            } catch (error) {
                console.error('网络连接失败：', error);
                message.error('未连接到网络', error);
                setLoading(false);
                setNetworkChecked(false);
            }
        };

        checkNetwork();
        // const intervalId = setInterval(async () => {
        //     await checkNetwork();
        // }, 500000); // 每5秒检查一次网络连接
        //
        // return () => clearInterval(intervalId); // 清理定时器
    }, []);

    // 获取用户信息
    const fetchUserInfo = async (ip, port) => {
        try {
            const result = await ipcRenderer.invoke('get_info', ip, port);
            if (result.data.result === "fail" || result.data.userName === null) {
                message.error(result.data.message);
                setNetworkChecked(false);
                setLoading(false);
            }
            if (result.success && result.data.userName != null) {
                setUsername(result.data.userName); // 设置用户名
                setWelcomeTip(result.data.welcomeTip); // 设置提示词
                localStorage.setItem('userIndex', result.data.userIndex);
                setData(result.data); // 设置其他数据
                message.success(result.data.message || "获取信息成功");
                setNetworkChecked(true);


            } else {
                setTimeout(() => {
                    setLoading(true);
                    message.error('获取信息失败，等待4s重新获取~');
                    fetchUserInfo(ip, port);
                }, 4000);
            }
        } catch (error) {
            message.error('发生错误：' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const onFinish = async (values) => {
        setLoading(true);
        try {
            const result = await ipcRenderer.invoke('login', values.username, values.password, values.connectionType); // 传递接入类型

            if (result.success) {
                message.success(result.message);
                fetchUserInfo(result.ip, result.port); // 登录成功后获取用户信息
                if (rememberPassword) {
                    localStorage.setItem('username', values.username);
                    localStorage.setItem('password', values.password);
                    localStorage.setItem('connectionType', values.connectionType);
                    localStorage.setItem('rememberPassword', rememberPassword);
                    localStorage.setItem('autoLogin', autoLogin);
                    localStorage.setItem('minimizeToTray', minimizeToTray);
                    localStorage.setItem('quitApp', quitApp);

                    message.success("已缓存登录信息~");
                } else {
                    localStorage.removeItem('username');
                    localStorage.removeItem('password');
                    localStorage.removeItem('connectionType');
                    localStorage.removeItem('rememberPassword');
                    localStorage.removeItem('autoLogin');
                    localStorage.removeItem('minimizeToTray');
                    localStorage.removeItem('quitApp');
                }
                message.info("3s 后自动退出或最小化到托盘~")
                // 在 3 秒后执行退出或最小化操作
                setTimeout(() => {
                    if (quitApp) {
                        ipcRenderer.send('quit-app');
                    }
                    if (minimizeToTray) {
                        // 这里添加代码来最小化到托盘
                        ipcRenderer.send('minimize-to-tray');
                    }
                }, 3000); // 3000 毫秒 = 3 秒
            } else {
                message.error(result.message);
            }
        } catch (error) {
            message.error('登录失败：' + error);
        }
        setLoading(false);
    };

    const handleLogout = async () => {
        let storedIp = localStorage.getItem('ip');
        let storedPort = localStorage.getItem('port');

        if (!storedIp) {
            message.info('未缓存登录ip，使用校园网默认ip和port');
            storedIp = '172.19.1.9';
            storedPort = '8080';
        }
        const result = await ipcRenderer.invoke('logout_user', storedIp, storedPort);
        if (result.success) {
            // message.success(result.message);
            message.success("已下线~");
            setNetworkChecked(false);
        } else {
            message.error(result.message);
        }
    }
    const delStore = async () => {
        localStorage.removeItem('username');
        localStorage.removeItem('password');
        localStorage.removeItem('connectionType');
        localStorage.removeItem('rememberPassword');
        localStorage.removeItem('autoLogin');
        localStorage.removeItem('minimizeToTray');
        localStorage.removeItem('quitApp');
    }

    if (loading) {
        return <div className="login-form" style={{
            textAlign: 'center',
            padding: '20px',
            width: "100%",
            height: '90%',
            margin: '0 auto',
        }}><Spin tip="加载中..."/></div>;
    }

    return (
        <div className="app-container">
            {!networkChecked ? (
                <div className="login-form" style={{
                    padding: '20px',
                    width: "400px",
                    height: '90%',
                    margin: '0 auto',
                }}>
                    <div style={{
                        width: "400px",
                        margin: '0 auto',
                        textAlign: 'center', // 图标居中
                    }}>
                        <a href="https://www.whu.edu.cn/" target="_blank" rel="noopener noreferrer">
                            <img src="../public/toplog1.png" className="logo" alt="Vite logo"/>
                        </a>
                    </div>
                    <Form onFinish={onFinish} style={{width: "400px"}} form={form}>
                        <Form.Item
                            name="username"
                            rules={[{required: true, message: '请输入用户名'}]}
                        >
                            <Input
                                placeholder="用户名"
                                value={username} // 使用缓存的用户名
                                onChange={e => setUsername(e.target.value)} // 更新状态
                                size="large" // 设置为大号输入框
                                style={{height: '40px'}} // 自定义高度
                            />
                        </Form.Item>
                        <Form.Item
                            name="password"
                            rules={[{required: true, message: '请输入密码'}]}
                        >
                            <Input.Password
                                placeholder="密码"
                                value={password} // 使用缓存的密码
                                onChange={e => setPassword(e.target.value)} // 更新状态
                                size="large" // 设置为大号输入框
                                style={{height: '40px'}} // 自定义高度
                            />
                        </Form.Item>
                        <Form.Item
                            name="connectionType"
                            rules={[{required: true, message: '请选择接入类型'}]}
                        >
                            <Select
                                placeholder="选择接入类型"
                                value={connectionType} // 使用缓存的接入类型
                                onChange={value => setConnectionType(value)} // 更新状态
                                size="large" // 设置为大号下拉框
                                style={{height: '40px'}} // 自定义高度
                            >
                                <Option value="Internet">校园网</Option>
                                <Option value="yidong">移动</Option>
                                <Option value="liantong">联通</Option>
                                <Option value="dianxin">电信</Option>
                            </Select>
                        </Form.Item>
                        <Form.Item>
                            <Switch
                                checked={rememberPassword}
                                onChange={setRememberPassword}
                                checkedChildren="保存密码"
                                unCheckedChildren="不保存密码"
                                style={{marginBottom: '10px'}} // 添加底部间距
                            />
                            <Switch
                                checked={autoLogin}
                                onChange={setAutoLogin}
                                style={{marginLeft: '10px', marginBottom: '10px'}} // 添加底部间距
                                checkedChildren="自动登录"
                                unCheckedChildren="不自动登录"
                            />
                            <Switch
                                checked={minimizeToTray}
                                onChange={setMinimizeToTray}
                                style={{marginLeft: '10px', marginBottom: '10px'}} // 添加底部间距
                                checkedChildren="登录后最小化托盘"
                                unCheckedChildren="保持窗口"
                            />
                            <Switch
                                checked={quitApp}
                                onChange={setQuitApp}
                                style={{marginLeft: '10px', marginBottom: '10px'}} // 添加底部间距
                                checkedChildren="不退出"
                                unCheckedChildren="登录后不退出"
                            />
                        </Form.Item>
                        <Form.Item>
                            <Button type="primary" htmlType="submit" loading={loading} size="large"
                                    style={{width: '100%', height: '40px'}}>
                                登录
                            </Button>
                        </Form.Item>
                    </Form>

                    <p className="read-the-docs" style={{textAlign: 'center'}}>
                        Code by <a href="#" rel="noopener noreferrer">
                        cccht
                    </a>
                    </p>
                </div>
            ) : (
                <div style={{
                    padding: '20px',
                    textAlign: "left",
                    width: '80%',
                    height: '90%',
                    margin: '0 auto',
                    position: 'absolute',
                    top: '20px'
                }}>
                    <div
                        style={{display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%"}}>
                        <div>
                            <Title level={2} style={{margin: 0, display: "flex", alignItems: "flex-end"}}>
                                {username}
                                ~~
                                <Title level={4} style={{margin: 0}}>
                                    {welcomeTip}
                                </Title>
                            </Title>
                        </div>
                        <div>
                            <Button onClick={delStore} type="primary" danger
                                    style={{marginLeft: '20px'}}>清除缓存</Button>
                            <Button onClick={handleLogout} type="primary" danger
                                    style={{marginLeft: '20px'}}>下线</Button>
                        </div>

                    </div>


                    <Tabs defaultActiveKey="1">
                        <TabPane tab="信息展示" key="1">
                            {data ? (
                                <div>
                                    <ul style={{listStyleType: 'none', padding: 0}}>
                                        {Object.entries(data).map(([key, value]) => (
                                            <li key={key} style={{
                                                marginBottom: '10px',
                                                wordWrap: 'break-word',
                                                maxWidth: '100%'
                                            }}>
                                                <strong>{key}:</strong> {value === null ? '无' : value.toString()}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : (
                                <p>没有可展示的数据。</p>
                            )}
                        </TabPane>
                        <TabPane tab="设置" key="2">
                            <p>设置页面内容...</p>
                        </TabPane>
                        <TabPane tab="帮助" key="3">
                            <p>帮助页面内容...</p>
                        </TabPane>
                    </Tabs>
                </div>

            )}
        </div>
    );
};

export default App;
