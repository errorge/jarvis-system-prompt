import { identities, samples, security } from "./prompt.js"

function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const sec = new RegExp(esc(security.start) + "[\\s\\S]*?" + esc(security.end) + "\\s*", "g")

function perAgent(o, agent) {
  const s = o.settings && typeof o.settings === "object" ? o.settings[agent] : null
  return s && typeof s === "object" ? s : {}
}

function makeFix(agent, o) {
  const per = perAgent(o, agent)
  const key = typeof per.persona === "string" ? per.persona : (typeof o.persona === "string" ? o.persona : "jarvis")
  const persona = Object.prototype.hasOwnProperty.call(samples, key) ? samples[key] : key
  const rules = identities.filter((r) => r.agent === agent).map((r) => [r.from, persona])
  const pick = (v) => (v === "keep" || v === "custom" ? v : null)
  const mode = pick(per.security) || pick(o.security) || "remove"
  const custom = typeof per.customSecurity === "string" ? per.customSecurity : (typeof o.customSecurity === "string" ? o.customSecurity : "")
  // 一次请求里 custom 只允许出现一份：跨块、跨协议阶段都靠它判重
  let inserted = false
  const fix = (text) => {
    if (typeof text !== "string" || !text) return text
    let out = text
    if (persona) for (const [re, to] of rules) out = out.replace(re, to)
    if (mode === "remove") out = out.replace(sec, "")
    else if (mode === "custom") {
      if (out.includes(security.start)) {
        // 同一份提示词可能被客户端发在两处（system + system 消息）：
        // custom 只注入第一次，其余出现处只删默认安全段
        out = out.replace(sec, inserted ? "" : (custom ? custom + "\n\n" : ""))
        inserted = true
      } else if (custom && out.includes(custom)) {
        inserted = true
      } else if (custom && !inserted) {
        out = custom + "\n\n" + out
        inserted = true
      }
    }
    return out
  }
  fix.custom = custom
  fix.seen = () => { inserted = true }
  return fix
}

function textParts(content) {
  if (typeof content === "string") return [{ text: content }]
  if (Array.isArray(content)) return content.filter((p) => p && typeof p === "object" && typeof p.text === "string")
  return []
}

function fixContent(content, fix) {
  if (typeof content === "string") return fix(content)
  if (Array.isArray(content)) {
    const parts = textParts(content)
    if (fix.custom && parts.some((p) => p.text.includes(fix.custom))) fix.seen()
    for (const p of parts) p.text = fix(p.text)
  }
  return content
}

function fixSystemMessages(body, fix) {
  if (!Array.isArray(body.messages)) return
  const msgs = body.messages.filter((m) => m && (m.role === "system" || m.role === "developer"))
  const all = msgs.flatMap((m) => textParts(m.content))
  if (fix.custom && all.some((p) => p.text.includes(fix.custom))) fix.seen()
  for (const m of msgs) m.content = fixContent(m.content, fix)
}

function toolCount(body) {
  const tools = Array.isArray(body?.tools) ? body.tools : []
  if (!tools.length) return 0
  let n = tools.length
  if (tools[0] && Array.isArray(tools[0].functionDeclarations)) {
    n = 0
    for (const t of tools) n += t && Array.isArray(t.functionDeclarations) ? t.functionDeclarations.length : 0
  }
  return n
}

export function onRequest(body, ctx) {
  try {
    if (!body || typeof body !== "object") return
    const o = ctx?.options || {}
    if (o.enabled === false) return
    const agents = Array.isArray(o.agents) && o.agents.length ? o.agents : ["claude", "zcode"]
    const agent = ctx?.agent
    if (!agents.includes(agent)) return
    if (perAgent(o, agent).enabled === false) return
    if (toolCount(body) < (Number.isFinite(o.minTools) ? o.minTools : 3)) return
    const fix = makeFix(agent, o)

    if (ctx.protocol === "anthropic") {
      body.system = fixContent(body.system, fix)
      fixSystemMessages(body, fix)
    } else if (ctx.protocol === "chat") {
      fixSystemMessages(body, fix)
    } else if (ctx.protocol === "responses") {
      if (typeof body.instructions === "string") body.instructions = fix(body.instructions)
    } else if (ctx.protocol === "gemini") {
      const key = body.systemInstruction !== undefined ? "systemInstruction" : "system_instruction"
      const cur = body[key]
      if (cur && Array.isArray(cur.parts)) {
        for (const p of cur.parts) if (p && typeof p.text === "string") p.text = fix(p.text)
      }
    } else {
      return
    }
    return body
  } catch {
    return
  }
}
