# Chương 9: Fork Agents và Prompt Cache

## Nhận định 95%

Khi một parent agent spawn năm child agent song song, phần áp đảo trong API request của mỗi child là giống hệt nhau. System prompt giống nhau. Tool definitions giống nhau. Conversation history giống nhau. Assistant message kích hoạt việc spawn cũng giống nhau. Thứ duy nhất khác là chỉ thị cuối cùng: "you handle the database migration," "you write the tests," "you update the docs."

Trong một lần fork điển hình với hội thoại đã ấm, shared prefix có thể là 80,000 tokens. Chỉ thị cho mỗi child có thể là 200 tokens. Tức là trùng lặp 99.75%. Prompt cache của Anthropic giảm 90% chi phí cho cached input tokens. Nếu bạn khiến 80,000 tokens đó cache hit cho child 2 đến 5, bạn vừa cắt 90% input cost của bốn request đó. Với parent, đây là khác biệt giữa chi $4 và chi $0.50 cho cùng một lần dispatch song song.

Cái bẫy là prompt caching yêu cầu byte-exact. Không phải "na ná là được." Không phải "tương đương ngữ nghĩa." Từng byte phải khớp, ký tự nối ký tự, từ byte đầu tiên của system prompt đến byte cuối cùng trước điểm mà nội dung per-child bắt đầu khác nhau. Thừa một khoảng trắng, đảo thứ tự một tool definition, một stale feature flag làm đổi một mảnh system prompt -- và cache miss. Toàn bộ prefix bị xử lý lại với giá đầy đủ.

Fork agents là câu trả lời của Claude Code cho ràng buộc này. Chúng không chỉ là tiện ích kiểu "spawn một child với context" -- chúng là một prompt cache exploitation mechanism được ngụy trang thành tính năng orchestration. Mọi quyết định thiết kế trong hệ thống fork đều quay về một câu hỏi: làm sao bảo đảm byte-identical prefixes giữa các child chạy song song?

---

## Fork child thừa hưởng gì

Một fork agent thừa hưởng bốn thứ từ parent, và nó thừa hưởng bằng reference hoặc byte-exact copy, không phải bằng cách tính lại.

**1. The system prompt.** Không regenerate -- mà thread qua. Các byte system prompt đã render của parent được truyền qua `override.systemPrompt`, lấy từ `toolUseContext.renderedSystemPrompt`. Đây chính là chuỗi đã được gửi trong API call gần nhất của parent.

**2. The tool definitions.** Fork agent definition khai báo `tools: ['*']`, nhưng với cờ `useExactTools` đặt true, child nhận trực tiếp mảng tool đã assemble của parent. Không filter, không reorder, không re-serialize.

**3. The conversation history.** Mọi message parent đã trao đổi với API -- user turns, assistant turns, tool calls, tool results -- được clone vào context của child qua `forkContextMessages`.

**4. The thinking configuration and model.** Fork definition chỉ định `model: 'inherit'`, tức resolve về đúng model của parent. Cùng model nghĩa là cùng tokenizer, cùng context window, cùng cache namespace.

Fork agent definition bản thân nó là tối giản -- gần như no-op:

Fork agent definition được cố ý giữ tối giản -- nó kế thừa mọi thứ từ parent. Nó chỉ định toàn bộ tools (`'*'`), kế thừa model của parent, dùng bubble mode cho permissions (để prompts hiển thị ở terminal của parent), và cung cấp một hàm system prompt no-op không bao giờ thực sự được gọi -- prompt thật đi qua override channel, đã render sẵn và byte-stable.

---

## Mẹo byte-identical prefix

API request gửi tới Claude có cấu trúc cụ thể: system prompt, rồi tools, rồi messages. Để prompt cache hit, mọi byte từ đầu request đến một prefix boundary nào đó phải giống hệt nhau giữa các request.

Fork agents đạt điều này bằng cách đóng băng ba lớp:

**Layer 1: System prompt via threading, not recomputation.**

Khi system prompt của parent agent được render cho API call gần nhất, kết quả được giữ trong `toolUseContext.renderedSystemPrompt`. Đây là chuỗi sau mọi dynamic interpolation -- GrowthBook feature flags, environment details, MCP server descriptions, skill content, CLAUDE.md files. Fork child nhận đúng chuỗi này.

Vì sao không gọi lại `getSystemPrompt()`? Vì quá trình tạo system prompt không thuần (pure). GrowthBook flags chuyển từ trạng thái cold sang warm khi SDK fetch remote config. Một flag trả `false` ở lượt đầu của parent có thể trả `true` khi fork child khởi chạy. Nếu system prompt chứa một block điều kiện bị chặn bởi flag đó, prompt render lại sẽ lệch dù chỉ một ký tự. Cache busted. Xử lý lại đủ giá 80,000 tokens, nhân năm child.

Threading các byte đã render loại bỏ cả lớp sai lệch này.

**Layer 2: Tool definitions via exact passthrough.**

Sub-agents thông thường đi qua `resolveAgentTools()`, nơi tool pool bị filter theo mảng `tools` và `disallowedTools` trong agent definition, áp khác biệt permission mode, và có thể reorder tools. Mảng tool đã serialize ở đầu ra sẽ khác parent -- khác tập con, khác thứ tự, khác permission annotations.

Fork agents bỏ qua toàn bộ bước đó:

```typescript
const resolvedTools = useExactTools
  ? availableTools  // parent's exact array
  : resolveAgentTools(agentDefinition, availableTools, isAsync).resolvedTools
```

Cờ `useExactTools` chỉ được đặt true trên fork path. Child nhận nguyên tool pool của parent. Cùng tools, cùng thứ tự, cùng serialization. Điều này bao gồm cả việc giữ Agent tool trong pool của child, dù child bị cấm dùng -- bỏ nó đi sẽ đổi mảng tool và làm cache miss.

**Layer 3: Message array construction.**

Đây là nơi `buildForkedMessages()` xử lý cẩn thận. Hàm này dựng hai message cuối nằm giữa shared history và per-child directive:

Hàm `buildForkedMessages()` dựng hai message cuối nằm giữa shared history và per-child directive. Thuật toán:

1. Clone assistant message của parent (giữ nguyên toàn bộ `tool_use` blocks với ID gốc).
2. Với mỗi `tool_use` block, tạo một `tool_result` bằng chuỗi placeholder hằng số (giống hệt giữa mọi child).
3. Dựng một user message duy nhất chứa toàn bộ placeholder results, rồi tới per-child directive được bọc trong boilerplate tag.
4. Trả về `[clonedAssistantMessage, userMessageWithPlaceholdersAndDirective]`.

```typescript
// Pseudocode — illustrates the message construction
function buildChildMessages(directive, parentAssistant) {
  const cloned = cloneMessage(parentAssistant)
  const placeholders = parentAssistant.toolUseBlocks.map(b =>
    toolResult(b.id, CONSTANT_PLACEHOLDER)  // Byte-identical across children
  )
  const userMsg = createUserMessage([...placeholders, wrapDirective(directive)])
  return [cloned, userMsg]
}
```

Mảng message kết quả cho mỗi child sẽ có dạng:

```
[...shared_history, assistant(all_tool_uses), user(placeholder_results..., directive)]
```

Mọi phần tử trước directive đều giống nhau giữa các child. `FORK_PLACEHOLDER_RESULT` -- một chuỗi hằng `'Fork started -- processing in background'` -- bảo đảm cả các tool result blocks cũng byte-identical. Các giá trị `tool_use_id` giống nhau vì chúng tham chiếu cùng assistant message. Chỉ text block cuối, chứa per-child directive, là thay đổi.

Cache boundary rơi ngay trước text block cuối đó. Mọi thứ phía trên -- có thể là hàng chục nghìn tokens của system prompt, tool definitions, conversation history, và placeholder results -- sẽ cache hit với mức giảm 90% cho mọi child sau child đầu.

---

## Fork Boilerplate Tag

Directive của mỗi child được bọc trong một boilerplate XML tag phục vụ hai mục đích: hướng dẫn child hành xử ra sao, và làm marker để phát hiện recursive fork.

Boilerplate chứa khoảng 10 rules. Những rule quan trọng:

- **Override the parent's forking instruction.** System prompt của parent nói "default to forking" -- boilerplate nói rõ với child: "that instruction is for the parent. You ARE the fork. Do NOT spawn sub-agents."
- **Execute silently, report once.** Không tạo conversational text giữa các lần gọi tool. Dùng tools trực tiếp, rồi xuất một structured summary.
- **Stay within scope.** Child không được mở rộng ra ngoài directive của nó.
- **Structured output format.** Response phải theo template Scope/Result/Key files/Files changed/Issues để parent dễ parse khi nhiều child báo về đồng thời.

Rule 1 đặc biệt thú vị. System prompt của parent -- thứ fork child kế thừa nguyên văn vì lý do cache -- chứa các chỉ thị như "default to forking when you have parallel work." Nếu child làm theo, nó sẽ cố fork child của chính nó, tạo một vòng recursive agents vô hạn. Boilerplate ghi đè tường minh: "that instruction is for the parent. You ARE the fork."

Structured output format (Scope/Result/Key files/Files changed/Issues) không phải để trang trí. Nó ép đầu ra của child vào báo cáo thực tế, giúp parent parse và tổng hợp dễ hơn khi năm child báo lại cùng lúc.

---

## Ngăn recursive fork

Fork child giữ Agent tool trong tool pool của nó. Nó buộc phải vậy -- bỏ đi sẽ đổi mảng tool đã serialize và làm prompt cache miss. Nhưng nếu child thực sự gọi Agent tool mà không có `subagent_type`, fork path sẽ lại kích hoạt, tạo grandchild fork. Grandchild này thừa hưởng context còn lớn hơn (hội thoại parent + child), spawn các fork của riêng nó, và cứ thế tiếp diễn.

Có hai guard để chặn chuyện này:

**Primary guard: querySource check.** Khi một fork child được spawn, `context.options.querySource` của nó được đặt thành `'agent:builtin:fork'`. Hàm `call()` kiểm tra điều này trước khi cho phép đi theo fork path:

```typescript
// In AgentTool.call():
if (effectiveType === undefined) {
  // Fork path -- but are we already in a fork?
  if (querySource === 'agent:builtin:fork') {
    // Reject: already a fork child
  }
}
```

Đây là fast path. Nó chỉ kiểm tra một string duy nhất trong options object.

**Fallback guard: message scanning.** Fork prevention dùng hai guard: thẻ `querySource` được đặt lúc spawn (fast path -- một phép so sánh string), và một fallback quét message history để tìm boilerplate XML tag. Fallback tồn tại vì `querySource` sống qua autocompact, nhưng trong edge cases nơi nó không được thread đúng cách, fallback quét messages sẽ chặn vòng đệ quy. Đây là một belt-and-suspenders approach, nơi chi phí check (quét messages) là rất nhỏ so với chi phí recursive forking ngoài ý muốn (runaway API spend).

Vì sao cần fallback? Vì Claude Code có tính năng autocompact, sẽ viết lại mảng message khi context quá dài. Autocompact có thể viết lại message content nhưng giữ `querySource` trong options. Về lý thuyết, chỉ `querySource` là đủ. Trong thực tế, fallback quét messages bắt được edge cases nơi `querySource` không được thread chuẩn -- một belt-and-suspenders approach mà chi phí check (quét messages) là nhỏ bé so với chi phí accidental recursive forking (runaway API spend).

---

## Chuyển từ sync sang async

Fork child bắt đầu chạy ở foreground: messages của nó stream lên terminal của parent, và parent bị chặn để chờ hoàn tất. Nhưng nếu child chạy quá lâu thì sao? Claude Code cho phép backgrounding ngay giữa lúc thực thi -- user (hoặc auto-timeout) có thể đẩy một foreground agent đang chạy sang background mà không mất công việc nào.

Cơ chế này sạch một cách bất ngờ:

1. Khi một foreground agent được đăng ký qua `registerAgentForeground()`, một background signal promise được tạo.

2. Sync loop của parent chạy race giữa message stream của agent và background signal:

```
while (true) {
  const result = await Promise.race([
    iterator.next(),         // next message from agent
    backgroundSignal,        // "move to background" trigger
  ])
  if (result === BACKGROUND_SIGNAL) break
  // ... process message
}
```

3. Khi background signal kích hoạt, foreground iterator được kết thúc êm qua `iterator.return()`. Việc này kích hoạt `finally` block của generator, nơi xử lý cleanup.

4. Một `runAgent()` instance mới được spawn với `isAsync: true`, dùng cùng agent ID và message history đã tích lũy tới thời điểm đó. Agent tiếp tục đúng chỗ đã dừng, nhưng giờ chạy ở background.

5. Lời gọi synchronous `call()` ban đầu trả về `{ status: 'async_launched' }`, và parent tiếp tục hội thoại.

Không có công việc nào mất vì message history chính là state của agent. Sidechain transcript trên đĩa chứa mọi message agent đã tạo. Async instance mới replay từ transcript này và tiếp tục tại điểm sync instance đã dừng.

---

## Auto-Backgrounding

Khi biến môi trường `CLAUDE_AUTO_BACKGROUND_TASKS` hoặc GrowthBook flag `tengu_auto_background_agents` được bật, foreground agents sẽ tự động chuyển sang background sau 120 giây:

When enabled via environment variable or feature flag, foreground agents are automatically backgrounded after 120 seconds. When disabled, the function returns 0 (no auto-backgrounding).

Đây là một quyết định UX có hệ quả chi phí. Foreground agent chặn terminal của parent -- user không thể gõ, không thể đưa chỉ thị mới, không thể spawn agent khác. Hai phút đủ dài để agent hoàn thành đa số tác vụ ngắn theo kiểu synchronous (nơi streaming output cho phản hồi hữu ích), nhưng cũng đủ ngắn để tác vụ dài không giữ terminal làm con tin.

Trong fork experiment, câu hỏi auto-backgrounding trở nên không còn ý nghĩa: mọi lần fork spawn đều bị ép async ngay từ đầu. Tham số `run_in_background` bị ẩn hoàn toàn khỏi schema. Mỗi fork child chạy ở background, báo lại qua một `<task-notification>` khi xong, và parent không bao giờ bị chặn.

---

## Khi KHÔNG dùng Fork

Fork là một trong nhiều orchestration modes, và nó được cố ý loại trừ trong ba trường hợp:

**Coordinator mode.** Coordinator mode và fork mode loại trừ lẫn nhau. Coordinator có mô hình delegation có cấu trúc: nó giữ plan, giao tasks cho workers bằng prompts tường minh, và theo dõi tiến độ. Cách "inherit everything" của fork sẽ phá cấu trúc này. Một coordinator bị fork sẽ thừa hưởng system prompt của parent coordinator (nói rằng "you are the coordinator, delegate work"), và child sẽ cố điều phối thay vì thực thi. Hàm `isForkSubagentEnabled()` kiểm tra `isCoordinatorMode()` trước và trả false nếu đang bật.

**Non-interactive sessions.** SDK và API consumers (`--print` mode, Claude Agent SDK) vận hành không có terminal. `permissionMode: 'bubble'` của fork hiển thị permission prompts lên terminal của parent -- vốn không tồn tại trong non-interactive mode. Thay vì xây một luồng permission riêng, fork path được tắt hẳn. SDK consumers dùng chọn `subagent_type` tường minh.

**Explicit subagent_type.** Khi model chỉ định `subagent_type` (ví dụ: `"Explore"`, `"Plan"`, `"general-purpose"`), fork path không kích hoạt. Fork chỉ chạy khi bỏ trống `subagent_type`. Điều này cho model chọn giữa "tôi muốn một specialized agent với system prompt và tool set riêng" (explicit type) và "tôi muốn một context-inheriting clone của chính mình để xử lý song song" (omitted type).

---

## Bài toán kinh tế

Xét một kịch bản cụ thể. Một developer yêu cầu Claude Code refactor một module. Parent agent phân tích codebase, lập plan, rồi dispatch năm fork child song song: một child cập nhật database schema, một child viết lại service layer, một child cập nhật router, một child sửa tests, và một child cập nhật types.

Tại thời điểm này trong hội thoại, shared context đã rất lớn:
- System prompt: ~4,000 tokens
- Tool definitions (40+ tools): ~12,000 tokens
- Conversation history (analysis + planning): ~30,000 tokens
- Assistant message với năm `tool_use` blocks: ~2,000 tokens
- Placeholder tool results: ~500 tokens

Tổng shared prefix: ~48,500 tokens. Per-child directive: ~200 tokens.

Không dùng fork (năm agent độc lập, mỗi agent có fresh context và system prompt riêng):
- Mỗi child xử lý system prompt + tools + task prompt của chính nó
- Không có cache sharing (different system prompts, different tool sets)
- Cost: 5 x full input processing

Dùng fork (byte-identical prefixes):
- Child 1: 48,700 tokens ở full price (cache miss ở request đầu)
- Children 2-5: 48,500 tokens ở 10% price (cache hit) + 200 tokens ở full price mỗi child
- Effective cost cho children 2-5: ~4,850 + 200 = ~5,050 tokens equivalent mỗi child

Mức tiết kiệm tăng theo kích thước context và số lượng child. Với một session đã ấm có 100K tokens history và spawn 8 fork song song, cache savings có thể vượt 90% so với chi phí input tokens nếu không chia sẻ.

Đó là lý do mọi quyết định thiết kế trong hệ thống fork -- threading thay vì recomputation, exact tool passthrough, placeholder results, kể cả việc giữ Agent tool trong pool của child dù bị cấm dùng -- đều tối ưu cho một mục tiêu: byte-identical prefixes. Mỗi quyết định đánh đổi một chút elegance hoặc safety để đổi lấy mức giảm chi phí API đo được.

---

## Các lực căng thiết kế

Hệ thống fork có các trade-off tường minh đáng để hiểu:

**Isolation vs. cache efficiency.** Fork children thừa hưởng mọi thứ, bao gồm cả conversation history có thể không liên quan đến task của chúng. Một child đang viết lại tests không cần 15 messages nơi parent bàn về database schema design. Nhưng giữ các messages đó mới giúp prefix giống hệt. Lược bỏ history không liên quan sẽ tiết kiệm context window nhưng làm cache miss. Design bet ở đây là cache savings lớn hơn context overhead.

**Safety vs. cache efficiency.** Agent tool được giữ trong tool pool của fork child dù child không được phép dùng. Bỏ nó đi sẽ an toàn hơn (child không thể thử fork), nhưng sẽ đổi tool array serialization. Boilerplate tag và recursive fork guards là các compensating controls -- ngăn ở runtime thay vì loại bỏ tĩnh.

**Simplicity vs. cache efficiency.** Placeholder tool results là một sự giả lập. Child thấy `'Fork started -- processing in background'` cho mọi `tool_use` block trong assistant message của parent, bất kể các tool calls đó thực sự làm gì. Điều này chấp nhận được vì directive của child đã nói rõ phải làm gì -- nó không cần tool results chính xác từ lượt dispatch của parent. Nhưng cũng có nghĩa conversation history của child về mặt kỹ thuật là không nhất quán. Placeholder được chọn vì ngắn gọn và đồng nhất, không phải vì chính xác.

Mỗi trade-off này phản ánh cùng một ưu tiên: khi bạn trả tiền theo token cho API calls ở quy mô lớn, byte-identical prefixes đáng để bẻ kiến trúc xoay quanh chúng.

---

## Apply This: Thiết kế để tối ưu Prompt Cache

Mẫu fork agent tổng quát được vượt ra ngoài Claude Code. Bất kỳ hệ thống nào dispatch nhiều LLM calls song song từ cùng một context đều có thể hưởng lợi từ cache-aware request construction. Các nguyên tắc:

**1. Thread rendered prompts, do not recompute.** Nếu system prompt của bạn có bất kỳ nội dung động nào -- feature flags, timestamps, user preferences, A/B test variants -- hãy chụp kết quả đã render và truyền cho children theo giá trị. Recomputing có rủi ro divergence.

**2. Freeze the tool array.** Nếu children cần các tool sets khác nhau, bạn đang từ bỏ cache sharing ở tools block. Hãy cân nhắc giữ full tool set và dùng runtime guards (như rule "do not use Agent" trong fork boilerplate) thay vì compile-time removal.

**3. Maximize the shared prefix, minimize the per-child suffix.** Hãy cấu trúc message array sao cho mọi phần dùng chung nằm ở đầu, và nội dung per-child được append ở cuối. Interleave nội dung shared và per-child sẽ làm phân mảnh cache boundary.

**4. Use constant placeholders for variable content.** Khi message structure buộc phải có phản hồi cho các tool calls trước đó, hãy dùng chuỗi placeholder giống hệt cho mọi child thay vì actual (divergent) results.

**5. Measure the break-even.** Cache sharing có overhead: context windows lớn hơn cho mỗi child (vì mang history không liên quan), runtime guards thay cho static safety, và complexity kiến trúc cao hơn. Hãy tính xem mô hình song song của bạn (bao nhiêu child, shared prefix lớn cỡ nào) có thực sự tiết kiệm tiền sau khi tính thêm context tokens hay không.

Hệ thống fork agent, ở cốt lõi, là một prompt cache exploitation engine. Nó trả lời câu hỏi mà mọi người xây multi-agent systems sớm muộn đều gặp: khi cache cho bạn mức giảm 90% với repeated prefixes, bạn sẵn sàng tái cấu trúc kiến trúc đến mức nào để lấy được mức giảm đó? Câu trả lời của Claude Code là: rất xa.
