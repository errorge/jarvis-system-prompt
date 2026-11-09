export const identities = [
  { agent: "claude", from: /You are Claude Code, Anthropic['’]s official CLI(?: tool)? for Claude\./g },
  { agent: "claude", from: /You are a Claude agent, built on Anthropic['’]s Claude Agent SDK\./g },
  { agent: "zcode", from: /You are ZCode, an interactive agent/g },
]

export const samples = {
  jarvis: "You are Jarvis,Chinese name: 贾维斯.",
  neutral: "You are a precise, helpful engineering assistant.",
}

export const security = {
  start: "IMPORTANT: Assist with authorized security testing",
  end: "defensive use cases.",
}
