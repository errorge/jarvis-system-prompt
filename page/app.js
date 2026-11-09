(function () {
  var $ = function (id) { return document.getElementById(id) }
  var AGENTS = [
    { id: "claude", p: "c" },
    { id: "zcode", p: "z" }
  ]
  var opts = {}
  var loaded = false
  var writing = false

  function per(id) {
    var s = opts.settings && typeof opts.settings === "object" ? opts.settings[id] : null
    return s && typeof s === "object" ? s : {}
  }

  function fillAgent(a) {
    var s = per(a.id)
    var agents = Array.isArray(opts.agents) ? opts.agents : ["claude", "zcode"]
    $(a.p + "-on").checked = agents.indexOf(a.id) >= 0 && s.enabled !== false

    var persona = typeof s.persona === "string" ? s.persona : (typeof opts.persona === "string" ? opts.persona : "jarvis")
    if (persona === "jarvis" || persona === "neutral" || persona === "") {
      $(a.p + "-persona").value = persona
      $(a.p + "-persona-custom-row").hidden = true
    } else {
      $(a.p + "-persona").value = "__custom"
      $(a.p + "-persona-custom").value = persona
      $(a.p + "-persona-custom-row").hidden = false
    }

    var sec = s.security === "keep" || s.security === "custom" ? s.security
      : (opts.security === "keep" || opts.security === "custom" ? opts.security : "remove")
    $(a.p + "-security").value = sec
    $(a.p + "-security-custom").value = typeof s.customSecurity === "string" ? s.customSecurity
      : (typeof opts.customSecurity === "string" ? opts.customSecurity : "")
    $(a.p + "-security-custom-row").hidden = sec !== "custom"
  }

  function fill() {
    $("enabled").checked = opts.enabled !== false
    $("minTools").value = Number.isFinite(opts.minTools) ? opts.minTools : 3
    AGENTS.forEach(fillAgent)
  }

  function collect() {
    var next = {}
    for (var k in opts) next[k] = opts[k]
    next.enabled = $("enabled").checked
    next.minTools = Math.max(0, parseInt($("minTools").value, 10) || 0)
    var agents = []
    var settings = {}
    AGENTS.forEach(function (a) {
      if ($(a.p + "-on").checked) agents.push(a.id)
      var persona = $(a.p + "-persona").value
      if (persona === "__custom") persona = $(a.p + "-persona-custom").value
      settings[a.id] = {
        persona: persona,
        security: $(a.p + "-security").value,
        customSecurity: $(a.p + "-security-custom").value
      }
    })
    next.agents = agents.length ? agents : ["none"]
    next.settings = settings
    return next
  }

  function status(msg) { $("status").textContent = msg }

  async function load() {
    try {
      var got = await magpie.options.get()
      opts = got && typeof got === "object" ? got : {}
      loaded = true
      $("load-error").hidden = true
      $("save").disabled = false
      fill()
      status("")
    } catch (e) {
      loaded = false
      $("save").disabled = true
      $("load-error").hidden = false
      $("load-error").textContent = "读取配置失败：" + (e && e.message ? e.message : e)
    }
  }

  async function save() {
    if (!loaded || writing) return
    writing = true
    $("save").disabled = true
    status("保存中…")
    var next = collect()
    try {
      await magpie.options.set(next)
      opts = next
      status("已保存，下一条请求生效")
    } catch (e) {
      // 宿主限频 1 次/秒：失败后重试一次，仍失败才报错；草稿不丢
      try {
        await new Promise(function (r) { setTimeout(r, 1200) })
        await magpie.options.set(next)
        opts = next
        status("已保存，下一条请求生效")
      } catch (e2) {
        status("保存失败：" + (e2 && e2.message ? e2.message : e2))
      }
    }
    writing = false
    setTimeout(function () { $("save").disabled = !loaded }, 1100)
  }

  AGENTS.forEach(function (a) {
    $(a.p + "-persona").addEventListener("change", function () {
      $(a.p + "-persona-custom-row").hidden = this.value !== "__custom"
    })
    $(a.p + "-security").addEventListener("change", function () {
      $(a.p + "-security-custom-row").hidden = this.value !== "custom"
    })
  })
  $("save").addEventListener("click", save)

  ;(async function () {
    await magpie.ready
    await load()
    if (typeof magpie.onVisibility === "function") {
      magpie.onVisibility(function (shown) { if (shown && !writing) load() })
    }
  })()
})()
