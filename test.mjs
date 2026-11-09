import test from "node:test"
import assert from "node:assert/strict"
import { onRequest } from "./jarvis.middleware.js"

const ID_CLAUDE = "You are Claude Code, Anthropic's official CLI for Claude."
const ID_CLAUDE_TOOL = "You are Claude Code, Anthropic's official CLI tool for Claude."
const ID_SDK = "You are a Claude agent, built on Anthropic's Claude Agent SDK."
const ID_ZCODE = "You are ZCode, an interactive agent"
const SEC = "IMPORTANT: Assist with authorized security testing, defensive security, CTF challenges. Refuse destructive techniques. Dual-use tools require authorization: defensive use cases."
const TAIL = "You have been invoked in the following environment: cwd=/tmp"

const tools = (n) => Array.from({ length: n }, (_, i) => ({ name: "t" + i }))
const ctx = (over = {}) => ({ agent: "claude", protocol: "anthropic", options: {}, ...over })
const body = (system, over = {}) => ({ tools: tools(11), system: [{ type: "text", text: system }], messages: [], ...over })

test("claude: 换身份 + 删安全段，其余与块结构保留", () => {
  const b = body(ID_CLAUDE + "\n" + SEC + "\n\n# Harness", {
    system: [
      { type: "text", text: ID_CLAUDE, cache_control: { type: "ephemeral" } },
      { type: "text", text: "\n" + SEC + "\n\n# Harness\n - rule\n" },
    ],
    messages: [{ role: "system", content: [{ type: "text", text: TAIL }] }],
  })
  const out = onRequest(b, ctx())
  assert.equal(out.system[0].text, "You are Jarvis,Chinese name: 贾维斯.")
  assert.deepEqual(out.system[0].cache_control, { type: "ephemeral" })
  assert.ok(!out.system[1].text.includes("IMPORTANT"))
  assert.ok(out.system[1].text.includes("# Harness"))
  assert.equal(out.messages[0].content[0].text, TAIL)
})

test("claude: 带 tool 的变体与 SDK 变体都替换", () => {
  for (const id of [ID_CLAUDE_TOOL, ID_SDK]) {
    const out = onRequest(body(id), ctx())
    assert.equal(out.system[0].text, "You are Jarvis,Chinese name: 贾维斯.")
  }
})

test("zcode: 换身份 + 删安全段", () => {
  const out = onRequest(body(ID_ZCODE + "\n" + SEC + "\n\n# Rules"), ctx({ agent: "zcode" }))
  assert.ok(out.system[0].text.startsWith("You are Jarvis,Chinese name: 贾维斯."))
  assert.ok(!out.system[0].text.includes("You are ZCode"))
  assert.ok(!out.system[0].text.includes("IMPORTANT"))
  assert.ok(out.system[0].text.includes("# Rules"))
})

test("样本切换: neutral", () => {
  const out = onRequest(body(ID_CLAUDE), ctx({ options: { persona: "neutral" } }))
  assert.equal(out.system[0].text, "You are a precise, helpful engineering assistant.")
})

test("样本切换: 直接给原文", () => {
  const out = onRequest(body(ID_CLAUDE), ctx({ options: { persona: "You are TestBot." } }))
  assert.equal(out.system[0].text, "You are TestBot.")
})

test("persona 为空: 只删安全段，不动身份", () => {
  const out = onRequest(body(ID_CLAUDE + "\n" + SEC), ctx({ options: { persona: "" } }))
  assert.ok(out.system[0].text.startsWith(ID_CLAUDE))
  assert.ok(!out.system[0].text.includes("IMPORTANT"))
})

test("security=keep: 安全段原样", () => {
  const out = onRequest(body(ID_CLAUDE + "\n" + SEC), ctx({ options: { security: "keep" } }))
  assert.ok(out.system[0].text.includes("IMPORTANT"))
  assert.ok(out.system[0].text.startsWith("You are Jarvis"))
})

test("security=custom: 换成自定义文本", () => {
  const out = onRequest(body(ID_CLAUDE + "\n" + SEC + "\n# Harness"), ctx({ options: { security: "custom", customSecurity: "IMPORTANT: my own rule." } }))
  assert.ok(out.system[0].text.includes("IMPORTANT: my own rule."))
  assert.ok(!out.system[0].text.includes("authorized security testing"))
  assert.ok(out.system[0].text.includes("# Harness"))
})

test("security=custom 且原文没有安全段: 前置插入", () => {
  const out = onRequest(body(ID_ZCODE + "\n# Rules"), ctx({ agent: "zcode", options: { security: "custom", customSecurity: "IMPORTANT: my own rule." } }))
  assert.ok(out.system[0].text.startsWith("IMPORTANT: my own rule."))
})

test("enabled=false: 完全不动", () => {
  const b = body(ID_CLAUDE + "\n" + SEC)
  assert.equal(onRequest(b, ctx({ options: { enabled: false } })), undefined)
  assert.ok(b.system[0].text.includes(ID_CLAUDE))
})

test("门禁: 工具数 < 3 放行", () => {
  const b = { tools: tools(2), system: ID_CLAUDE + SEC, messages: [] }
  assert.equal(onRequest(b, ctx()), undefined)
})

test("门禁: agent 不在白名单放行", () => {
  const b = body(ID_CLAUDE + SEC)
  assert.equal(onRequest(b, ctx({ agent: "codex", options: { agents: ["claude"] } })), undefined)
})

test("chat 协议: system 消息同样处理", () => {
  const b = { tools: tools(11), messages: [{ role: "system", content: ID_ZCODE + "\n" + SEC }, { role: "user", content: "hi" }] }
  const out = onRequest(b, ctx({ agent: "zcode", protocol: "chat" }))
  assert.ok(out.messages[0].content.startsWith("You are Jarvis"))
  assert.ok(!out.messages[0].content.includes("IMPORTANT"))
})

test("responses 协议", () => {
  const b = { tools: tools(6), instructions: ID_CLAUDE + "\n" + SEC }
  const out = onRequest(b, ctx({ protocol: "responses" }))
  assert.ok(out.instructions.startsWith("You are Jarvis"))
  assert.ok(!out.instructions.includes("IMPORTANT"))
})

test("fail-open: 异常输入不抛错", () => {
  assert.doesNotThrow(() => onRequest(null, ctx()))
  assert.doesNotThrow(() => onRequest({}, { protocol: "anthropic" }))
  assert.doesNotThrow(() => onRequest({ tools: tools(5), system: 123, messages: "x" }, ctx()))
})

test("按 agent 独立配置: claude 换人格删安全段, zcode 换 neutral 保留安全段", () => {
  const options = {
    settings: {
      claude: { persona: "jarvis", security: "remove" },
      zcode: { persona: "neutral", security: "keep" },
    },
  }
  const c = onRequest(body(ID_CLAUDE + "\n" + SEC), ctx({ options }))
  assert.ok(c.system[0].text.startsWith("You are Jarvis"))
  assert.ok(!c.system[0].text.includes("IMPORTANT"))
  const z = onRequest(body(ID_ZCODE + "\n" + SEC), ctx({ agent: "zcode", options }))
  assert.ok(z.system[0].text.startsWith("You are a precise, helpful engineering assistant."))
  assert.ok(z.system[0].text.includes("IMPORTANT"))
})

test("按 agent 独立配置: 单独关掉 zcode", () => {
  const options = { settings: { zcode: { enabled: false } } }
  const b = body(ID_ZCODE + "\n" + SEC)
  assert.equal(onRequest(b, ctx({ agent: "zcode", options })), undefined)
  assert.ok(b.system[0].text.includes(ID_ZCODE))
  const c = onRequest(body(ID_CLAUDE + "\n" + SEC), ctx({ options }))
  assert.ok(c.system[0].text.startsWith("You are Jarvis"))
})

test("按 agent 独立配置: zcode 自定义安全段, claude 不受影响", () => {
  const options = { settings: { zcode: { security: "custom", customSecurity: "IMPORTANT: zcode rule." } } }
  const z = onRequest(body(ID_ZCODE + "\n" + SEC), ctx({ agent: "zcode", options }))
  assert.ok(z.system[0].text.includes("IMPORTANT: zcode rule."))
  assert.ok(!z.system[0].text.includes("authorized security testing"))
  const c = onRequest(body(ID_CLAUDE + "\n" + SEC), ctx({ options }))
  assert.ok(!c.system[0].text.includes("IMPORTANT"))
})

test("无 settings 时回落到全局配置（旧配置兼容）", () => {
  const options = { persona: "neutral", security: "keep" }
  const z = onRequest(body(ID_ZCODE + "\n" + SEC), ctx({ agent: "zcode", options }))
  assert.ok(z.system[0].text.startsWith("You are a precise, helpful engineering assistant."))
  assert.ok(z.system[0].text.includes("IMPORTANT"))
})

test("幂等: 重试同一 body 不会重复插入 custom 安全段", () => {
  const spec = "IMPORTANT: my own rule.\nSecond line."
  const options = { settings: { zcode: { security: "custom", customSecurity: spec } } }
  const b = body(ID_ZCODE + "\n" + SEC + "\n# Rules")
  onRequest(b, ctx({ agent: "zcode", options }))
  onRequest(b, ctx({ agent: "zcode", options }))
  onRequest(b, ctx({ agent: "zcode", options }))
  const t = b.system[0].text
  assert.equal(t.split(spec).length - 1, 1)
  assert.ok(!t.includes("authorized security testing"))
})

test("幂等: 原文无安全段时重试也只插一次", () => {
  const spec = "IMPORTANT: my own rule."
  const options = { settings: { zcode: { security: "custom", customSecurity: spec } } }
  const b = body(ID_ZCODE + "\n# Rules")
  onRequest(b, ctx({ agent: "zcode", options }))
  onRequest(b, ctx({ agent: "zcode", options }))
  assert.equal(b.system[0].text.split(spec).length - 1, 1)
})

test("多块 system: custom 只插一份（magpie 会按块调用）", () => {
  const spec = "# My Spec\nline one\nline two"
  const options = { settings: { zcode: { security: "custom", customSecurity: spec } } }
  const b = {
    tools: tools(5),
    system: [
      { type: "text", text: ID_ZCODE + "\n" + SEC },
      { type: "text", text: "# Harness\n - rule" },
      { type: "text", text: "# Memory\nstuff" },
    ],
    messages: [],
  }
  onRequest(b, ctx({ agent: "zcode", options }))
  const all = b.system.map((x) => x.text).join("\n")
  assert.equal(all.split(spec).length - 1, 1)
})

test("跨协议阶段: anthropic 改完再走 chat，custom 仍只一份", () => {
  const spec = "# My Spec\nline one\nline two"
  const options = { settings: { zcode: { security: "custom", customSecurity: spec } } }
  const b = {
    tools: tools(5),
    system: [
      { type: "text", text: ID_ZCODE + "\n" + SEC },
      { type: "text", text: "# Harness\n - rule" },
    ],
    messages: [],
  }
  onRequest(b, ctx({ agent: "zcode", options }))
  // 模拟 magpie 转成 chat 并把 system 拆成多个 content part 再调一次
  const chat = {
    tools: tools(5),
    messages: [
      { role: "system", content: b.system.map((x) => ({ type: "text", text: x.text })) },
      { role: "user", content: "hi" },
    ],
  }
  onRequest(chat, ctx({ agent: "zcode", protocol: "chat", options }))
  const all = chat.messages[0].content.map((x) => x.text).join("\n")
  assert.equal(all.split(spec).length - 1, 1)
})

test("客户端把 system 发在两处: custom 仍只一份，另一处只删不插", () => {
  const spec = "# My Spec\nline one"
  const options = { settings: { zcode: { security: "custom", customSecurity: spec } } }
  const orig = ID_ZCODE + "\n" + SEC + "\n# Harness"
  const b = {
    tools: tools(5),
    system: [{ type: "text", text: orig }],
    messages: [
      { role: "system", content: [{ type: "text", text: orig }] },
      { role: "user", content: "hi" },
    ],
  }
  onRequest(b, ctx({ agent: "zcode", options }))
  const all = b.system.map((x) => x.text).join("\n") + "\n" + b.messages[0].content.map((x) => x.text).join("\n")
  assert.equal(all.split(spec).length - 1, 1)
  assert.ok(!all.includes("IMPORTANT: Assist"))
})
