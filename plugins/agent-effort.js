// 每个 agent 的推理档位：模型跟随会话选择，不绑定 provider。
// 只有当前模型声明了这个档位名时才覆盖本次请求的 reasoningEffort；找不到就跳过，用模型默认。
//
// 钩子依据：packages/plugin/src/effect/session.ts:37-39（SessionContext 带 agent，options 可变）
const LEVELS = {
  research: "high",
  reviewer: "max",
  curator: "high",
  worker: "high",
  operator: "low",
  surfing: "low",
  archivist: "low",
}

const supported = new Map()
const ref = (providerID, id) => `${providerID}/${id}`

// 只认精确档位名：模型没有这个档位就不覆盖，交给模型默认强度。
const choose = (variants, level) => (variants.has(level) ? level : undefined)

export default {
  id: "agent-effort",
  setup: async (ctx) => {
    await ctx.model.transform((editor) => {
      supported.clear()
      for (const model of editor.list()) {
        if (!model.variants?.length) continue
        supported.set(ref(model.providerID, model.id), new Set(model.variants.map((variant) => String(variant.id))))
      }
    })

    await ctx.session.hook("context", (event) => {
      const variants = supported.get(ref(event.model.providerID, event.model.id))
      const level = LEVELS[String(event.agent)]
      if (!variants || !level) return
      const chosen = choose(variants, level)
      if (!chosen) return
      event.options.reasoningEffort = chosen
    })
  },
}
