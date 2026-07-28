# 模型优先改造计划

日期：2026-06-24

本文记录 `species` 的下一阶段改造方向。核心原则是：

> 充分考虑模型智能，面向模型设计系统，提供说明、工具、信息。尽量避免使用规则、固定模式、行为模板。避免设置会人为限制模型能力的参数或配置。

项目原始命题仍然成立：

> 系统维护边界，agent 生成秩序。

目前的偏差不在理念，而在实现方式。为了防止房间退化成调度器或工作流引擎，代码里逐渐增加了更多协议、生命周期状态、prompt 规则、fixture 路径和评测计数。结果是，模型面对的不是一个可理解、可行动、可审计的房间，而是一套越来越大的动作语法和治理词汇。

本改造的目标不是移除结构，而是把结构放回正确层级：

- 硬边界留在确定性代码里。
- 工具、信息、上下文暴露给模型。
- 社会秩序尽量由模型基于房间证据生成。
- 行为模板只作为临时兼容或测试夹具，不作为产品心智。

## 核心诊断

项目最强的部分是确定性边界：

- append-only `RoomLedger`
- constitution 对强制发言、中央 active agent、公共记忆污染、副作用审批的约束
- provider timeout、degradation、secret masking
- context budget、omission tracking
- private capability result 和 explicit side-effect gate

这些应该保留，而且应该继续是确定性的。

主要漂移点在模型交互和社会层：

- `AgentIntention` 已经变成一个大型固定动作 DSL。
- live provider prompt 在模型进入房间前，先要求它理解大量 lifecycle 规则。
- seed adapter 和测试 fixture 有明显关键词路由和 canned response。
- persona 模板包含 habits、interactionRules、boundaries，容易变成行为脚本。
- long-run evaluation 有变成治理计分板的风险，鼓励覆盖指定社会动作，而不是观察真实涌现质量。

一句话：项目在防止“工作流化”的过程中，堆出了另一种工作流语法。

## 保留什么

### 确定性边界内核

继续由代码硬性维护会损害房间或外部世界的边界：

- ledger append、replay、idempotency、hash chain
- context window、message pressure、speaker budget
- provider 健康状态、诊断截断、secret masking
- memory commit gate、public-memory pollution guard
- side-effect approval、scope、expiry、result linkage
- capability execution boundary

这些是墙、门、配电箱，不是 agent 的台词本。

### Context Packet 的方向

`AgentContextPacket` 和 context fragment 的方向是对的：refs、omission、audit、budget 都是在给模型可用信息。后续应把它们整理成更容易读的模型上下文，而不是继续把 projection 的内部字段直接平铺给模型。

### Wake 是敲门，不是命令

wake/rate/speaker budget 可以保留为带宽机制，但它们不应成为房间秩序的来源。wake score 应该被解释为“谁可能需要看到这次敲门”，而不是“谁负责处理这件事”。

## 目标架构

### 1. `ModelRoomBrief`

新增 `ModelRoomBrief`，由现有 `AgentContextPacket` 生成，作为 provider-facing 的主入口。

它应该先让模型进入房间，再让模型看到机器结构：

1. 当前可见对话
2. 房间章程，短句即可
3. 当前成员与柔性连续性提示
4. 相关 social object cards
5. 可用工具与 capability affordances
6. 硬边界
7. 被省略的上下文和不确定性
8. audit refs

当前 `src/agents/live.ts` 里的 `roomEnvironmentBriefing` 是正确方向。下一步不是继续追加更多禁止语，而是减少 always-on 规则，把当前 turn 真正相关的 affordance 选出来。

### 2. Social Object Cards

把庞大的 `ContextRefRecord.states` 转换为模型可读卡片。内部 projection 可以继续复杂，但给模型看的对象应保持一致形状：

```ts
type ModelSocialObjectCard = {
  kind: string;
  ref: string;
  status?: string;
  readableSummary: string;
  whyVisibleNow: string;
  evidenceRefs: string[];
  hardBoundary?: string;
  availableAffordances?: string[];
};
```

典型卡片：

- memory claim：摘要、状态、source refs、contest refs、为什么仍是 provisional
- open question：问题、来源、已有回应、仍未解决的部分
- protocol：临时 etiquette、scope、expiry、contestability
- handoff / invitation：social knock、目标、理由、回应历史
- archive：可读 time skeleton、遗漏、争议、repair pressure
- provider boundary：运行时事实、受影响 agent、当前社会压力、repair approval boundary
- persona continuity：连续性证据、accepted/contested role claim、daily mood evidence

模型不应该从几百个 optional projection field 里猜房间含义。

### 3. `RoomProposalEnvelope`

逐步把 `AgentIntention` 从“模型本体论”降级为兼容层。模型应该可以返回自然发言加 proposed room events。

目标输出形状：

```ts
type RoomProposalEnvelope = {
  reply?: {
    content: string;
    refs?: string[];
  };
  silence?: {
    reason: string;
    refs?: string[];
  };
  proposedEvents?: RoomProposal[];
  toolRequests?: RoomToolRequest[];
  rationale?: string;
};
```

模型表达判断，runtime 验证这个判断是否能落到 ledger。

验证失败时，不应简单把输出压成 generic `stay_silent`。更好的结果是：

- 生成一个有界 clarification question
- 记录 rejected proposal 及原因
- 记录 provider-output validation diagnostic
- 只有在确实没有可用贡献时才转为 silence

### 4. 工具作为 Affordance

capability 应该被呈现为 agent 改善理解的工具，而不是工作流步骤。

read-only capability result 继续返回 private agent context。side-effectful operation 继续变成 approval request。

工具说明应强调：

- 它能提供什么信息
- 没有审批时不能做什么
- 需要哪些 refs、path、query 或 scope
- 返回结果会以什么形式进入 agent 私有上下文或房间 ledger

这符合“提供工具和信息”，但不把房间改造成 task runner。

## 重点改造点

### Prompt Layer

改造 `src/agents/live.ts`，避免继续扩张一个巨型 provider instruction。

当前问题：

- prompt 先给固定 `AgentIntention` 菜单
- lifecycle 语义通过大量禁止语重复出现
- output examples 容易成为行为模板
- compact prompt 仍然要求模型操作 DSL

目标：

- 短 hard-boundary instruction
- `ModelRoomBrief`
- 当前 turn 相关 affordance cards
- 小输出契约
- validation/repair 交给 runtime

### Intention Layer

迁移期保留 `AgentIntention`，但不要为每个社会细节继续扩张 union。

新增通用 proposal path：

- `reply`
- `silence`
- `propose_room_event`
- `request_tool`
- `request_side_effect_approval`

旧 intention 先映射到新 envelope。新的 provider path 优先输出 envelope，再由 runtime 验证并转换成 ledger events。

### Context Layer

把 model-facing context 从 projection field dump 改成 typed readable snapshots。

第一批卡片建议：

1. memory claim
2. open question
3. protocol / handoff / invitation
4. archive
5. provider boundary

### Persona Layer

persona 不应再像行为模板。

把 `interactionRules`、habits、titles、boundaries 改写成连续性证据和倾向，而不是命令文本。provider brief 里应采用这样的语气：

- “这个成员过去经常……”
- “当前连续性证据显示……”
- “此 packet 没有 accepted role claim……”

避免：

- 固定 job name
- 反复的 “do not” 行为脚本
- 基于 persona title 的角色式路由

### Seed And Demo Layer

seed 行为应明确属于 fixture/demo，不作为模型智能证明。

逐步减少 keyword-routed canned replies。若需要 seed adapter，应让它只验证边界，或者隔离在 evaluation-only fixture 里。

### Evaluation Layer

保留硬不变量测试，弱化行为模板测试。

好的测试：

- 不强制发言
- 无未审批副作用
- memory acceptance 需要可见 evidence/review
- accepted memory 仍可 contest
- context packet 先给对话再给 metadata
- omitted context 以 uncertainty 暴露
- provider failure 不变成人格或沉默判断
- ledger replay parity

有风险的测试：

- 要求精确覆盖某些 social choice kinds
- 要求固定 action ratio
- 把指定 proposal sequence 当成 living-room quality
- 要求一次 long-run 表演所有社会动作

long-run report 应衡量 diversity、evidence、contestability、safety、readability，而不是成为治理计分板。

## 迁移计划

### Phase 0: 规则盘点

盘点 prompt text、validators、lifecycle rules、regex classifiers、evaluation assertions、persona instructions。

每项归类为：

- hard boundary
- soft guidance
- model information
- tool affordance
- behavior template
- compatibility shim

此阶段不删功能，只产出改造地图。

### Phase 1: 增加 `ModelRoomBrief`

从现有 `AgentContextPacket` 旁路生成 brief，不改变 runtime 行为。

验收：

- visible conversation 出现在 metadata 前
- room charter 很短
- 相关 refs 保留
- omitted context 明确可见
- raw implementation ids 不作为自然发言 opener
- social objects 不读 raw JSON 也能理解

### Phase 2: Prompt Diet

把 live provider prompt 切到 `ModelRoomBrief` + selected affordance cards。

验收：

- prompt 总长度下降
- always-on lifecycle rule text 下降
- output examples 更少、更通用
- 旧 `AgentIntention` 兼容路径仍可用

### Phase 3: Proposal Compatibility Layer

引入 `RoomProposalEnvelope`，并将旧 `AgentIntention` 映射进去。

之后允许 provider 返回旧 shape 或新 shape。

验收：

- 旧测试仍通过
- invalid proposal 被 reject 或 clarify，而不是静默转成 generic silence
- side-effect request 仍必须审批
- unsupported social proposal 可以作为 reviewable room pressure 保留

### Phase 4: Social Object Cards

为 memory、question、protocol、invitation、handoff、archive、provider boundary、persona continuity 建 card builder。

验收：

- card 有 readable summary、evidence refs、hard boundary
- card 按 relevance 选择，不总是 dump
- model-facing card 不包含隐藏 workflow command

### Phase 5: Soften Persona, Seed, Evaluation

把 persona instructions 改成 continuity evidence。把 seed scripts 移到 fixture/demo scope。把 long-run evaluation 改成 invariant + quality properties。

验收：

- live provider prompt 不再像行为模板
- seed tests 不再冒充 live model intelligence
- long-run pass 不要求固定社会编舞

## 第一刀

最安全的第一刀：

1. 新增 `ModelRoomBrief` types。
2. 从现有 context 生成 brief，不改变 runtime 行为。
3. 加 golden tests，验证 brief 顺序和可读性。
4. 加 prompt-size 对比 fixture 或测试。
5. 保留当前 provider prompt 作为 fallback。

这一步能立刻把方向从“更多规则”拉回“更好的模型可见世界”，同时不破坏现有房间。

## 未来设计检查

每个新功能进入项目时，先问三个问题：

1. 这是保护资源、记忆信任或副作用的硬边界吗？
2. 这是帮助模型推理的信息或工具吗？
3. 还是在告诉模型应该如何行动的行为模板？

优先接受前两类。第三类默认可疑，除非它是明确临时、局部、可移除的兼容层。
