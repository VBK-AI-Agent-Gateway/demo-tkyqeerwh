# 新款荣威 RX5 · 手机控车 APP × 车机 TSP 服务 接口规范

版本：v1.0（草案）
适用范围：手机控车 APP（车主端）、车机 TSP 平台、车辆网关（T-Box/TBOX）
环境划分：**Demo Mock 环境**（演示联调） 与 **Official 开放环境**（生产）

---

## 0. 通用约定

### 0.1 Base URL

| 环境 | Base URL | 说明 |
|---|---|---|
| Demo Mock | `https://mock-tsp.vbk-demo.cn/tsp/v1` | 本地桩数据，指令不真实下发，随机延迟 200–800ms |
| Official | `https://open-tsp.roewe.com/tsp/v1` | 官方开放网关，需 APP Key + 签名 |

> 后文路径均相对 Base URL。

### 0.2 通用请求头

```
Content-Type: application/json; charset=utf-8
X-App-Key: {appKey}                // 开放平台分配
X-Device-Id: {deviceId}            // 手机唯一标识（OAID/IDFV）
X-Trace-Id: {uuid}                 // 链路追踪，全链路透传
X-Timestamp: {unixMilli}           // 服务端允许 ±5 分钟偏差
X-Sign: {sign}                     // 仅 Official 必填，见 0.4
X-Token: {accessToken}             // 除登录/绑定外均必填
```

Mock 环境忽略 `X-Sign`，`X-Token` 任意非空字符串即可。

### 0.3 通用响应体

```json
{
  "code": 0,
  "message": "success",
  "traceId": "b1c2...e9",
  "serverTime": 1730419260123,
  "data": {}
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| code | int | 0 成功，非 0 见错误码表 |
| message | string | 错误描述，前端可直接展示 |
| traceId | string | 服务端链路 ID |
| serverTime | long | 服务端毫秒时间戳 |
| data | object/array | 业务数据，失败时为 null |

### 0.4 签名算法（仅 Official）

```
signStr = appSecret + "&" + sortedKVJoin(params) + "&" + X-Timestamp
sign    = hex(hmacSHA256(signSecret, signStr)).toUpperCase()
```

- 参与签名：业务 query/body 参数 + `X-Timestamp`
- 字典序升序拼接 `k=v&k=v`
- 签名失败返回 `code=40001`

### 0.5 幂等与超时重试（全局策略）

| 接口类型 | 客户端超时 | 重试策略 | 幂等键 |
|---|---|---|---|
| 查询类 GET | 5s | 失败重试 2 次，间隔 300ms 退避 | 无要求 |
| 绑定/鉴权类 | 8s | 不自动重试，用户手动触发 | `requestId` |
| 远程指令类 | 首包 3s（返回受理号） | **不自动重试**，用户手动重发需新 `cmdId` | `cmdId` |
| 状态上报（车→云） | 10s | 指数退避 1s/2s/4s，最多 5 次；仍失败转离线缓存 | `msgId` |
| 推送（云→APP） | — | APP 侧重连后拉取离线消息 | `msgId` |

服务端侧：
- 指令执行结果 30s 未回调 → 置为 `TIMEOUT`，推送 `cmd.timeout` 事件
- 重复 `cmdId` 直接返回首次受理结果（幂等）

---

## 1. 车辆绑定（bind）

### 1.1 获取验证码 `POST /bind/sms-code`

请求：

```json
{
  "phone": "13800138000",
  "scene": "BIND",          // BIND | LOGIN | UNBIND
  "captchaTicket": "tk_xxx"  // 图形验证码票据，Official 必填
}
```

响应 `data`：

```json
{ "smsId": "sms_001", "expireIn": 60, "cooldown": 60 }
```

### 1.2 绑定车辆 `POST /bind/vehicle`

请求：

```json
{
  "requestId": "req_8f3a...",       // 幂等键
  "phone": "13800138000",
  "smsCode": "8888",
  "vin": "LSJA24E62NS000123",       // 17 位 VIN
  "vehicleName": "我的RX5",
  "role": "OWNER"                    // OWNER | FAMILY | GUEST
}
```

响应 `data`：

```json
{
  "bindId": "bind_20241101_001",
  "vin": "LSJA24E62NS000123",
  "model": "荣威RX5 2025款 300TGI",
  "energyType": "FUEL",              // FUEL | EV | PHEV
  "boundAt": 1730419260000
}
```

### 1.3 我的车辆列表 `GET /bind/vehicles`

参数：`page=1&size=20`

响应 `data`：

```json
{
  "total": 1,
  "list": [
    {
      "bindId": "bind_001",
      "vin": "LSJA24E62NS000123",
      "plateNo": "沪AD88888",
      "model": "荣威RX5 2025款 300TGI",
      "energyType": "FUEL",
      "isDefault": true,
      "role": "OWNER",
      "lastOnlineAt": 1730419200000
    }
  ]
}
```

### 1.4 解绑 `POST /bind/unbind`

请求：`{ "requestId": "...", "bindId": "bind_001", "smsCode": "8888" }`
响应 `data`：`{ "unbind": true }`

---

## 2. 车辆状态上报（车→云，TBOX 通道）

> 手机端为消费方，通过 **2.1 轮询 / 2.2 订阅推送** 获取；车机 TBOX 按下述格式上报。

### 2.1 车辆实时状态查询（APP 拉取） `GET /vehicle/status`

参数：`vin=LSJA...`

响应 `data`：

```json
{
  "vin": "LSJA24E62NS000123",
  "gps": { "lat": 31.2304, "lng": 121.4737, "address": "上海市黄浦区人民大道", "fix": true },
  "energy": {
    "energyType": "FUEL",
    "fuelPercent": 68,
    "fuelLevelL": 34.0,
    "rangeKm": 436,
    "evPercent": null,
    "odoKm": 12860
  },
  "engine": { "powerState": "OFF", "gear": "P", "speedKmh": 0, "rpm": 0 },
  "climate": { "inTempC": 26, "outTempC": 26, "acOn": false },
  "doors": {
    "fl": "CLOSED", "fr": "CLOSED", "rl": "CLOSED", "rr": "CLOSED",
    "trunk": "CLOSED", "hood": "CLOSED",
    "locked": true, "unlockedBy": null
  },
  "windows": { "fl": "CLOSED", "fr": "CLOSED", "rl": "CLOSED", "rr": "CLOSED", "sunroof": "TILTED" },
  "lights": { "head": "OFF", "hazard": "OFF", "interior": "OFF" },
  "tires": {
    "unit": "kPa",
    "fl": 248, "fr": 246, "rl": 250, "rr": 249,
    "tpmsState": "NORMAL"           // NORMAL | LOW | HIGH | SENSOR_FAULT
  },
  "position": { "parked": true, "parkedSince": 1730412000000 },
  "signal": { "rssi": -72, "online": true },
  "reportedAt": 1730419200000,
  "dataSource": "TBOX"               // TBOX | DEMO_MOCK
}
```

门窗枚举：`CLOSED | OPEN | TILTED | JAMMED | UNKNOWN`
电源枚举：`OFF | ACC | ON | CRANKING | DRIVING`

### 2.2 状态变更订阅（长连接推送）

通道：WebSocket `wss://.../tsp/v1/ws?token=...` 或厂商长连接 SDK

事件：`vehicle.status.changed`

```json
{
  "event": "vehicle.status.changed",
  "msgId": "msg_001",
  "vin": "LSJA24E62NS000123",
  "changed": ["doors", "windows"],      // 变更字段，客户端按需局部刷新
  "data": { /* 同 2.1 data 结构 */ },
  "reportedAt": 1730419260000
}
```

### 2.3 车端上行报文（TBOX → 云，参考）

```
POST /internal/tbox/report
Header: X-TBox-Sign / X-VIN
{
  "msgId": "up_9x8y",         // 幂等
  "vin": "LSJA...",
  "seq": 100234,               // 单调递增，去重乱序
  "ts": 1730419260000,
  "payload": { ... }           // 同 2.1 data
}
```

响应：`{ "code": 0, "dup": false }`，重复 msgId 返回 `dup=true`。

---

## 3. 远程指令下发（APP → 云 → 车）

### 3.1 指令清单

| cmd | 名称 | 参数 | 预计执行 |
|---|---|---|---|
| `door.unlock` | 解锁 | — | ≤5s |
| `door.lock` | 闭锁 | — | ≤5s |
| `horn.light` | 寻车（鸣笛闪灯） | `times`(1–3) | ≤5s |
| `climate.ac` | 空调 | `on`,`targetC`(16–32),`seatHeat`(0–3) | ≤15s |
| `trunk.open` | 后备箱开启 | — | ≤8s |
| `window.ctrl` | 车窗 | `position`(0–100), `windows[]` | ≤10s |
| `engine.start` | 远程启动 | — | ≤15s（需二次确认） |
| `engine.stop` | 远程熄火 | — | ≤8s |
| `charge.start/stop` | 充电控制（EV/PHEV） | — | ≤10s |

### 3.2 下发指令 `POST /cmd/dispatch`

请求：

```json
{
  "cmdId": "cmd_20241101_0001",   // 幂等键，客户端生成 uuid
  "vin": "LSJA24E62NS000123",
  "cmd": "climate.ac",
  "args": { "on": true, "targetC": 24 },
  "clientTs": 1730419260000
}
```

响应（**受理成功，非执行完成**）：

```json
{
  "code": 0,
  "data": {
    "cmdId": "cmd_20241101_0001",
    "acceptNo": "acc_7788",       // 受理号，用于查询
    "status": "ACCEPTED",         // ACCEPTED | EXECUTING
    "etaMs": 5000,
    "timeoutSec": 30
  }
}
```

### 3.3 查询指令结果 `GET /cmd/result`

参数：`cmdId=cmd_20241101_0001`

响应 `data`：

```json
{
  "cmdId": "cmd_20241101_0001",
  "cmd": "climate.ac",
  "status": "SUCCESS",            // ACCEPTED | EXECUTING | SUCCESS | FAILED | TIMEOUT | CANCELED
  "failCode": null,
  "failMsg": null,
  "executedAt": 1730419263000
}
```

> APP 建议：下发后本地轮询本接口 0s/1s/2s/4s/8s，或订阅事件 `cmd.result`。

### 3.4 指令结果推送事件

```json
{
  "event": "cmd.result",
  "msgId": "msg_002",
  "cmdId": "cmd_20241101_0001",
  "status": "SUCCESS",
  "data": { /* 同 3.3 data */ }
}
```

---

## 4. 蓝牙钥匙鉴权（BLE Key）

### 4.1 钥匙生命周期

```
创建邀请 → 手机生成密钥对 → 上报公钥(注册) → 车端预置 → 挑战-应答握手 → 解锁/启动
```

### 4.2 创建钥匙邀请 `POST /key/invite`

请求：`{ "requestId": "...", "vin": "LSJA...", "phone": "138...", "role": "FAMILY", "expireHours": 720 }`
响应 `data`：`{ "inviteId": "inv_001", "qrcodeContent": "roewekey://inv_001?s=SIGN", "expireAt": 1730678400000 }`

### 4.3 注册钥匙（手机侧） `POST /key/register`

请求：

```json
{
  "requestId": "...",
  "inviteId": "inv_001",
  "devicePubKey": "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...",   // P-256 SPKI Base64
  "deviceId": "ios_xxx",
  "deviceModel": "iPhone 16"
}
```

响应 `data`：

```json
{
  "keyId": "key_001",
  "vin": "LSJA24E62NS000123",
  "role": "FAMILY",
  "validFrom": 1730419260000,
  "validTo": 1736659260000,
  "permissions": ["BLE_UNLOCK", "BLE_START", "PASSIVE_ENTRY"]
}
```

### 4.4 挑战应答鉴权 `POST /key/challenge`（车端 BLE GATT 调用或经云端中继）

请求（手机发起）：

```json
{
  "keyId": "key_001",
  "nonce": "9f8e7d6c...",            // 车端下发的 16B 随机数
  "counter": 1024,                    // 防重放，单调递增
  "ts": 1730419260000,
  "sig": "base64(ECDSA_P256(sign(devicePrivKey, nonce||counter||vin)))",
  "action": "UNLOCK"                  // UNLOCK | START | PASSIVE_ENTRY
}
```

响应 `data`：

```json
{
  "result": "ALLOW",                  // ALLOW | DENY
  "denyCode": null,
  "sessionToken": "ble_sess_abc",     // 会话票据，后续指令复用，TTL 300s
  "serverSig": "base64(...)"          // 手机验签用，防中间人
}
```

### 4.5 钥匙管理

- `GET /key/list?vin=` → 我的钥匙列表（keyId、role、有效期、权限、设备型号、状态）
- `POST /key/disable` `{ "keyId": "key_001" }` → 挂失/停用
- `POST /key/delete` `{ "keyId": "key_001" }` → 删除

安全要求（Official）：
- counter 严格单调，服务端记录 last counter，回退即 `DENY`
- 同 nonce 5 分钟内不可复用
- 钥匙过期/停用即时同步至车端（经 TBOX 下发名单）

---

## 5. 消息推送

### 5.1 推送通道

| 通道 | 用途 | Mock 环境 |
|---|---|---|
| WebSocket 长连接 | 在线实时事件 | `wss://mock.../ws` 直连回放 |
| 厂商推送（APNs/华为/小米） | 离线拉起 | Mock 不推送，走站内信 |
| 站内信 | 历史记录 | `GET /message/list` |

### 5.2 消息拉取 `GET /message/list`

参数：`page&size&unreadOnly=true&types=cmd,alarm,system`

响应 `data`：

```json
{
  "total": 12,
  "unread": 3,
  "list": [
    {
      "msgId": "msg_100",
      "type": "alarm",               // cmd | alarm | system | service
      "title": "胎压预警",
      "body": "右后轮胎压低于 220 kPa，请及时检查",
      "level": "WARN",               // INFO | WARN | CRITICAL
      "vin": "LSJA...",
      "payload": { "tire": "rr", "kpa": 218 },
      "read": false,
      "createdAt": 1730419260000
    }
  ]
}
```

### 5.3 已读回执 `POST /message/read`

请求：`{ "msgIds": ["msg_100", "msg_101"] }`（≤100 条/次）
响应：`{ "readCount": 2 }`

### 5.4 典型推送事件一览

| event | 触发 |
|---|---|
| `vehicle.status.changed` | 门窗/胎压/电量变化 |
| `cmd.result` | 远程指令完成/失败/超时 |
| `vehicle.alarm` | 被动安防（异动、拖车、低胎压） |
| `key.expiring` | 蓝牙钥匙 7 天/1 天到期 |
| `service.reminder` | 保养/年检提醒 |

---

## 6. 错误码表

### 6.1 通用错误

| code | 含义 | 客户端处理 |
|---|---|---|
| 0 | 成功 | — |
| 40001 | 签名错误 | 检查签名/时钟 |
| 40002 | 时间戳过期 | 校准时间 |
| 40100 | 未登录/Token 缺失 | 跳登录 |
| 40101 | Token 过期 | 静默刷新一次，失败跳登录 |
| 40300 | 无权限（非绑定车主） | 提示并引导绑定 |
| 40400 | 资源不存在 | 提示 |
| 42900 | 限流 | 退避重试（≥2s） |
| 50000 | 服务内部错误 | 可重试 1 次 |
| 50300 | 服务不可用 | 展示降级页 |

### 6.2 业务错误

| code | 含义 |
|---|---|
| 41001 | 验证码错误/过期 |
| 41002 | 验证码发送过于频繁（60s） |
| 41101 | VIN 格式非法 |
| 41102 | VIN 未激活或不在可绑定列表 |
| 41103 | 该车辆已被他人绑定 |
| 41104 | 已达绑定上限（5 辆） |
| 42101 | 车辆离线，指令无法下发 |
| 42102 | 指令参数不合法 |
| 42103 | 车辆状态不允许该指令（如行驶中禁开窗） |
| 42104 | 指令执行失败（车端返回） |
| 42105 | 指令超时（30s） |
| 42106 | 重复 cmdId（幂等返回原结果，data 原样） |
| 42107 | 下发频率超限（同车 10 条/分钟） |
| 43001 | 蓝牙钥匙邀请码无效/过期 |
| 43002 | 钥匙已停用或过期 |
| 43003 | 鉴权失败（签名/nonce/counter 校验不过） |
| 43004 | counter 重放 |
| 43005 | 超出钥匙权限（如无 START 权限） |
| 44001 | 消息 ID 不存在 |

### 6.3 Mock 环境模拟错误

Mock 支持通过 `X-Mock-Scenario` 请求头注入：

| scenario | 效果 |
|---|---|
| `vehicle.offline` | 返回 42101 |
| `cmd.fail` | 指令受理后 3s 回调 FAILED |
| `cmd.timeout` | 指令永不回调，30s 后 TIMEOUT |
| `slow` | 全接口延迟 3s（测超时） |
| `auth.expire` | 返回 40101（测登出跳转） |
| `key.replay` | 返回 43004 |

---

## 7. Mock 与 Official 差异对照

| 维度 | Demo Mock | Official 开放接口 |
|---|---|---|
| 域名 | `mock-tsp.vbk-demo.cn` | `open-tsp.roewe.com` |
| 鉴权 | 任意 token | APP Key + HMAC-SHA256 签名 + Token |
| 数据 | 确定性桩数据（VIN 尾号驱动），状态可被 scenario 覆盖 | 真实 TBOX 上报 |
| 指令 | 本地模拟，`dataSource=DEMO_MOCK`，固定 1.2s 成功（可注入失败场景） | 经 TBOX 下发实车，30s 超时 |
| 蓝牙钥匙 | 本地验签（Mock 固定密钥对），挑战应答恒 ALLOW（除 replay 场景） | P-256 真实验签 + 车端名单 |
| 推送 | WS 回放脚本，可手动触发事件 | 长连接 + 厂商离线推送 |
| 限流 | 100 次/分钟/设备 | 按合同 QPS（默认 10 QPS/接口） |
| SLA | 无 | 99.9%，状态查询 P95 < 300ms |
| 错误码 | 同一套 | 同一套 |

**切换方式**：APP 内 `设置 → 开发者 → TSP 环境` 切换 Base URL；或构建期注入 `TSP_BASE_URL`。

---

## 8. 联调示例时序（远程开空调）

```
APP                     TSP                        TBOX
 |--- POST /cmd/dispatch (cmdId=c1, climate.ac) -->|
 |<-- 2020 {acceptNo, status:ACCEPTED} -----------|   (3s 超时首包)
 |                                                |--- 下行指令 --->|
 |<== WS event cmd.result EXECUTING ==============|                |
 |                                                |<-- 执行空调 ---|
 |                                                |-- 执行结果 -->|
 |<== WS event cmd.result SUCCESS ================|
 |--- GET /cmd/result?cmdId=c1 ------------------>|  (兜底轮询)
 |<-- {status:SUCCESS} ---------------------------|
```

失败分支：30s 无 `cmd.result` → TSP 置 TIMEOUT → 推送 `cmd.result{status:TIMEOUT}` → APP 提示"指令超时，请检查车辆网络"。

---

*文档随接口变更同步维护；Breaking Change 需升版本号 `/tsp/v2` 并保留 v1 兼容期 6 个月。*