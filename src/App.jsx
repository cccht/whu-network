import React, {useEffect, useState} from 'react';
import {
    Button,
    Card,
    Descriptions,
    Form,
    Input,
    message, Modal,
    Select,
    Spin,
    Switch,
    Tabs,
    Typography
} from 'antd';
const { Text } = Typography;
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
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState(''); // 新增状态用于存储密码
    const [connectionType, setConnectionType] = useState(''); // 新增状态用于存储接入类型
    const [welcomeTip, setWelcomeTip] = useState('');
    const [data, setData] = useState(null); // 存储请求到的数据
    const [networkChecked, setNetworkChecked] = useState(false); // 检查网络状态

    const [autoLoginDis, setAutoLoginDis] = useState(false); // 断连自动登录状态
    const [autoLoginDisInterval, setAutoLoginDisInterval] = useState(10); // 断连时间间隔，单位为分钟
    const [keepConnected, setKeepConnected] = useState(false); // 保持连接状态
    const [keepConnectedInterval, setKeepConnectedInterval] = useState(10); // 自动发送请求时间间隔，单位为分钟
    const [showModal, setShowModal] = useState(true); // 控制弹窗显示
    const handleAgree = () => {
        setShowModal(false); // 用户同意后关闭弹窗
    };

    const handleCancel = () => {
        // 用户拒绝使用软件，关闭窗口
        window.close(); // 关闭窗口
    };
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
    const checkNetwork = async () => {
        try {
            message.info('正在检查网络连接...');
            const result = await ipcRenderer.invoke('check-network'); // 调用 Electron 后端的网络检查方法
            message.success(result.message);
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
    useEffect(() => {
        checkNetwork();
        // const intervalId = setInterval(async () => {
        //     await checkNetwork();
        // }, 500000); // 每5秒检查一次网络连接
        //
        // return () => clearInterval(intervalId); // 清理定时器
    }, []);
    useEffect(() => {
        let intervalId;
        // 根据选择的开关和时间间隔设置定时器
        if (keepConnected) {
            intervalId = setInterval(async () => {
                await checkNetwork();
            }, keepConnectedInterval * 60 * 1000); // 转换为毫秒
        }

        return () => clearInterval(intervalId); // 清理定时器
    }, [keepConnected, keepConnectedInterval]); // 依赖于开关状态和时间间隔

    useEffect(() => {
        let autoLoginIntervalId;
        // 根据选择的开关和时间间隔设置定时器
        if (autoLoginDis) {
            autoLoginIntervalId = setInterval(async () => {
                await checkNetwork(); // 如果需要自动登录检查网络
            }, autoLoginDisInterval * 60 * 1000); // 转换为毫秒
        }

        return () => clearInterval(autoLoginIntervalId); // 清理定时器
    }, [autoLoginDis, autoLoginDisInterval]); // 依赖于开关状态和时间间隔

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
    const keyNameMap = {
        userIndex: '用户索引',
        message: '消息',
        result: '获取结果',
        keepaliveInterval: '保持活动间隔',
        maxLeavingTime: '最大离开时间',
        maxFlow: '最大流',
        userName: '用户名',
        userId: '用户身份',
        userIp: '用户IP',
        userMac: '用户MAC',
        webGatePort: '网络网关端口',
        webGateIp: '网络网关',
        service: '服务',
        realServiceName: '实际服务名称',
        loginType: '登录类型',
        userGroup: '用户组',
        accountFee: '账户费用',
        hasMabInfo: '有MabInfo',
        isAlowMab: '无感认证',
        userPackage: '使用包',
        selfUrl: '自身网址',
        redirectUrl: '重定向网址',
        portalIp: '门户网站',
        isSuccessService: '成功服务',
        isCloseWinAllowed: '关闭窗口允许',
        checkUserLogout: '用户登出检查',
        samEdition: '版本',
        isFaq: '常见问题',
        pcClient: 'PC客户端',
        pcClientUrl: 'PC客户端URL',
        phoneClient: '手机客户端',
        isAutoLogin: '自动登录',
        domianName: '域名',
        netFlowKey: '网络流量密钥',
        errorflowurl: '错误流量URL',
        isErrorMsg: '错误消息',
        successUrl: '成功URL',
        mabInfoMaxCount: 'MAB最大数量'
        // 添加更多映射
    };

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
                            <Button onClick={checkNetwork} type="primary"
                                    style={{marginLeft: '5px'}}>刷新状态</Button>
                            <Button onClick={delStore} type="primary" danger
                                    style={{marginLeft: '5px'}}>清除缓存</Button>
                            <Button onClick={handleLogout} type="primary" danger
                                    style={{marginLeft: '5px'}}>下线</Button>
                        </div>

                    </div>


                    <Tabs defaultActiveKey="1">
                        <TabPane tab="用户信息" key="1">
                            {data ? (
                                <Descriptions bordered column={1}>
                                    {Object.entries(data)
                                        .filter(([key]) => keyNameMap[key]) // 仅保留 keyNameMap 中存在的键
                                        .map(([key, value]) => (
                                            <Descriptions.Item label={keyNameMap[key]} key={key}>
                                                {value === null ? '无' : value.toString()}
                                            </Descriptions.Item>
                                        ))}
                                </Descriptions>
                            ) : (
                                <p>没有可展示的数据。</p>
                            )}
                        </TabPane>
                        <TabPane tab="网络及软件设置" key="2">
                            <div style={{ padding: '16px' }}>
                                <Card style={{ marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Text>记住密码</Text>
                                        <Switch
                                            checked={rememberPassword}
                                            onChange={setRememberPassword}
                                        />
                                    </div>
                                </Card>
                                <Card style={{ marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Text>自动登录</Text>
                                        <Switch
                                            checked={autoLogin}
                                            onChange={setAutoLogin}
                                        />
                                    </div>
                                </Card>
                                <Card style={{ marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Text>断连自动登录</Text>
                                        <Switch
                                            checked={autoLoginDis}
                                            onChange={setAutoLoginDis}
                                        />
                                    </div>
                                    <div style={{ marginTop: '10px' }}>
                                        <Text>断连时间间隔:</Text>
                                        <Select
                                            value={autoLoginDisInterval}
                                            onChange={setAutoLoginDisInterval}
                                            style={{ width: '100px', marginLeft: '10px' }}
                                        >
                                            {[5, 10, 15, 30, 60].map((minutes) => (
                                                <Option key={minutes} value={minutes}>
                                                    {minutes} 分钟
                                                </Option>
                                            ))}
                                        </Select>
                                    </div>
                                </Card>
                                <Card style={{ marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Text>保持连接</Text>
                                        <Switch
                                            checked={keepConnected}
                                            onChange={setKeepConnected}
                                        />
                                    </div>
                                    <div style={{ marginTop: '10px' }}>
                                        <Text>自动发送请求时间间隔:</Text>
                                        <Select
                                            value={keepConnectedInterval}
                                            onChange={setKeepConnectedInterval}
                                            style={{ width: '100px', marginLeft: '10px' }}
                                        >
                                            {[5, 10, 15, 30, 60].map((minutes) => (
                                                <Option key={minutes} value={minutes}>
                                                    {minutes} 分钟
                                                </Option>
                                            ))}
                                        </Select>
                                    </div>
                                </Card>
                            </div>
                        </TabPane>
                        <TabPane tab="帮助" key="3">
                            <div style={{padding: '16px'}}>
                                <h2>免责声明</h2>
                                <p>
                                    本软件提供的信息仅供参考，使用者在使用本软件前应仔细阅读本免责声明。我们努力确保所提供信息的准确性和及时性，但不对信息的完整性、准确性或可靠性做出任何保证。
                                </p>
                                <p>
                                    在任何情况下，对于因使用或无法使用本软件而导致的任何直接、间接、偶然、特殊或后果性的损害，我们不承担任何责任。这包括但不限于因使用本软件所引起的利润损失、业务中断、信息丢失或其他损失。
                                </p>
                                <p>
                                    用户在使用本软件时，应遵守当地法律法规。我们不对用户使用本软件的合法性或合规性负责。
                                </p>
                                <p>
                                    我们保留随时修改本免责声明的权利，修改后的免责声明将在本软件中发布。请用户定期查看本免责声明，以了解任何更新。
                                </p>
                                <p>
                                    继续使用本软件即表示您同意接受本免责声明的所有条款。如果您不同意本免责声明的条款，请勿使用本软件。
                                </p>
                            </div>
                        </TabPane>
                    </Tabs>
                </div>

            )}
            {/* 免责声明弹窗 */}
            <Modal
                title="免责声明"
                visible={showModal}
                onOk={handleAgree}
                onCancel={handleCancel}
                okText="同意"
                cancelText="不同意"
            >
                <p>
                    本软件提供的信息仅供参考，使用者在使用本软件前应仔细阅读本免责声明。我们努力确保所提供信息的准确性和及时性，但不对信息的完整性、准确性或可靠性做出任何保证。
                </p>
                <p>
                    在任何情况下，对于因使用或无法使用本软件而导致的任何直接、间接、偶然、特殊或后果性的损害，我们不承担任何责任。这包括但不限于因使用本软件所引起的利润损失、业务中断、信息丢失或其他损失。
                </p>
                <p>
                    用户在使用本软件时，应遵守当地法律法规。我们不对用户使用本软件的合法性或合规性负责。
                </p>
                <p>
                    继续使用本软件即表示您同意接受本免责声明的所有条款。如果您不同意本免责声明的条款，请勿使用本软件。
                </p>
            </Modal>
        </div>
    );
};

export default App;
