# Jarvis · 人格与安全段改写插件（完整包）

一个 magpie 网关插件：**按 agent 独立替换系统提示词的身份行、删除或替换默认安全段**，其余提示词逐字保留。带可视化设置页。

## 快速开始（3 步）

```bash
# 1. 解压本包，进入目录
cd jarvis-system-prompt

# 2. 安装（二选一）
./install.sh                      # 自动找 magpie 并安装
magpie plugin add "$(pwd)"        # 或手动

# 3. 打开 magpie 侧栏 → 插件 → Jarvis（贾维斯）→ 改配置 → 保存
```

保存后**下一条请求生效**，不用重启任何 agent。

## 默认行为（开箱即用）

| 项 | 默认 |
|---|---|
| 生效 agent | Claude Code、ZCode |
| 身份 | 换成 `You are Jarvis,Chinese name: 贾维斯.` |
| 默认安全段（`IMPORTANT: …`） | 删除 |
| 旁路请求（标题/审查/分类，工具数 < 3） | 原样放行，不改 |
| 其余提示词 / 工具定义 / 用户消息 | 逐字保留 |

## 文档导航

| 文件 | 内容 |
|---|---|
| [docs/01-安装.md](docs/01-安装.md) | 三种安装方式、更新、卸载、环境要求 |
| [docs/02-设置页.md](docs/02-设置页.md) | 设置页每个控件的含义与操作 |
| [docs/03-命令行配置.md](docs/03-命令行配置.md) | options 全表 + 常用命令示例 |
| [docs/04-样本与安全策略.md](docs/04-样本与安全策略.md) | 人格样本机制、安全段三档语义、插入位置规则 |
| [docs/05-扩展.md](docs/05-扩展.md) | 加样本、加 agent、改页面 |
| [docs/06-测试与验证.md](docs/06-测试与验证.md) | 单元测试、抓包对比、A/B 验证法 |
| [docs/07-故障排查.md](docs/07-故障排查.md) | 不生效、重复插入、旁路被改等问题的排查 |

## 常用命令速查

```bash
magpie plugin list                                   # 看插件状态
magpie plugin options jarvis-system-prompt           # 看当前配置
magpie plugin off jarvis-system-prompt               # 临时关闭（恢复原提示）
magpie plugin on  jarvis-system-prompt               # 重新打开
magpie plugin add "$(pwd)"                           # 改过代码/页面后重新加载
node --test test.mjs                                 # 跑 24 条单元测试
```

## 包内结构

```
package.json / jarvis.middleware.js / prompt.js / page/   插件本体（可直接安装）
test.mjs                                                  单元测试
install.sh                                                一键安装
docs/                                                     中文使用文档
LICENSE                                                   MIT
```

## 安全 properties

- **fail-open**：插件任何异常都原样放行，不会弄挂请求
- **幂等**：网关分块/分阶段/重试多次调用时，自定义文本全局只注入一份
- **块结构保留**：不破坏 `cache_control` 提示缓存断点
- **不含任何私有内容**：默认配置只有公开样本，无个人路径、无个人提示词

许可：MIT
