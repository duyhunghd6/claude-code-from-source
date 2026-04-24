# Chương 9: Fork Agents và Prompt Cache

## The Ninety-Five Percent Insight (Nhận định 95 phần trăm)

Khi một parent agent spawn năm child agent song song, phần áp đảo trong API request của mỗi child là giống hệt nhau. System prompt giống nhau. Tool definitions giống nhau. Conversation history giống nhau. Assistant message đã kích hoạt việc spawn cũng giống nhau. Thứ duy nhất khác là chỉ thị cuối cùng: "bạn xử lý database migration," "bạn viết tests," "bạn cập nhật docs."

Trong một fork điển hình với hội thoại đã ấm, shared prefix có thể là 80,000 tokens. Chỉ thị cho mỗi child có thể là 200 tokens. Tức là trùng lặp 99.75%. Prompt cache của Anthropic giảm 90% chi phí cho cached input tokens. Nếu bạn khiến 80,000 tokens đó cache hit cho child 2 đến 5, bạn vừa cắt 90% input cost của bốn request đó. Với parent, đây là khác biệt giữa chi $4 và chi $0.50 cho cùng một lần dispatch song song.

Cái bẫy là prompt caching yêu cầu byte-exact. Không phải "na ná đủ dùng." Không phải "tương đương ngữ nghĩa." Từng byte phải khớp, ký tự nối ký tự, từ byte đầu tiên của system prompt đến byte cuối cùng trước điểm nội dung per-child bắt đầu khác nhau. Thừa một khoảng trắng, đảo thứ tự một tool definition, một feature flag cũ làm thay đổi một mảnh system prompt -- và cache miss. Toàn bộ prefix bị xử lý lại với giá đầy đủ.

Fork agents là câu trả lời của Claude Code cho ràng buộc này. Chúng không chỉ là tiện ích để "spawn child với context" -- chúng là prompt cache exploitation mechanism được ngụy trang thành tính năng orchestration. Mọi quyết định thiết kế trong hệ thống fork đều truy về một câu hỏi: làm sao đảm bảo byte-identical prefixes giữa các child chạy song song?

---

## What a Fork Child Inherits (Fork child thừa hưởng gì)

Một fork agent thừa hưởng bốn thứ từ parent, và nó thừa hưởng theo reference hoặc bản sao byte-exact, không phải bằng cách tính lại.

**1. The system prompt.** Không regenerate -- mà thread qua. Các byte system prompt đã render của parent được truyền qua `override.systemPrompt`, lấy từ `toolUseContext.renderedSystemPrompt`. Đây chính là chuỗi đã được gửi trong API call gần nhất của parent.

**2. The tool definitions.** Fork agent definition khai báo `tools: ['*']`, nhưng với cờ `useExactTools` đặt true, child nhận trực tiếp mảng tool đã assemble của parent. Không filter, không reorder, không re-serialize.

**3. The conversation history.** Mọi message parent đã trao đổi với API -- user turns, assistant turns, tool calls, tool results -- được clone vào context của child qua `forkContextMessages`.

**4. The thinking configuration and model.** Fork definition chỉ định `model: 'inherit'`, tức resolve về đúng model của parent. Cùng model nghĩa là cùng tokenizer, cùng context window, cùng cache namespace.

Bản thân fork agent definition là tối giản -- gần như no-op:

Fork agent definition được cố ý giữ tối giản -- nó kế thừa mọi thứ từ parent. Nó chỉ định toàn bộ tools (`'*'`), kế thừa model của parent, dùng bubble mode cho permissions (để prompt hiển thị ở terminal của parent), và cung cấp một hàm system prompt no-op không bao giờ thực sự được gọi -- prompt thật đi qua override channel, đã render sẵn và byte-stable.

---

## The Byte-Identical Prefix Trick (Mẹo tiền tố giống byte)

API request gửi tới Claude có cấu trúc cụ thể: system prompt, rồi tools, rồi messages. Để prompt cache hit, mọi byte từ đầu request đến một prefix boundary nào đó phải giống hệt nhau giữa các request.

Fork agents đạt điều này bằng cách đóng băng ba lớp:

**Layer 1: System prompt via threading, not recomputation.**

Khi system prompt của parent agent được render cho API call gần nhất, kết quả được giữ trong `toolUseContext.renderedSystemPrompt`. Đây là chuỗi sau mọi dynamic interpolation -- GrowthBook feature flags, chi tiết environment, mô tả MCP server, nội dung skill, file CLAUDE.md. Fork child nhận đúng chuỗi này.

Tại sao không gọi lại `getSystemPrompt()`? Vì việc tạo system prompt không thuần (pure). GrowthBook flags chuyển từ trạng thái cold sang warm khi SDK fetch remote config. Một flag trả `false` ở lượt đầu của parent có thể trả `true` khi fork child khởi chạy. Nếu system prompt có khối điều kiện bị chặn bởi flag đó, prompt render lại sẽ lệch dù chỉ một ký tự. Cache hỏng. Xử lý lại đủ giá 80,000 tokens, nhân năm child.

Thread các byte đã render loại bỏ cả lớp sai lệch này.

**Layer 2: Tool definitions via exact passthrough.**

Sub-agent thông thường đi qua `resolveAgentTools()`, nơi tool pool bị filter theo mảng `tools` và `disallowedTools` trong agent definition, áp khác biệt permission mode, và có thể reorder tools. Mảng tool serialized kết quả sẽ khác parent -- khác tập con, khác thứ tự, khác annotation quyền.

Fork agents bỏ qua toàn bộ bước đó:

```typescript
const resolvedTools = useExactTools
  ? availableTools  // parent's exact array
  : resolveAgentTools(agentDefinition, availableTools, isAsync).resolvedTools
```

Cờ `useExactTools` chỉ được đặt true trên đường fork. Child nhận nguyên tool pool của parent. Cùng tools, cùng thứ tự, cùng serialization. Điều này bao gồm cả việc giữ Agent tool trong pool của child, dù child bị cấm dùng -- bỏ nó đi sẽ đổi mảng tool và làm cache miss.

**Layer 3: Message array construction.**

Đây là nơi `buildForkedMessages()` làm việc cẩn thận. Hàm này dựng hai message cuối nằm giữa shared history và per-child directive:

Hàm `buildForkedMessages()` dựng hai message cuối nằm giữa shared history và per-child directive. Thuật toán:

1. Clone assistant message của parent (giữ nguyên tất cả khối `tool_use` với ID gốc).
2. Với mỗi khối `tool_use`, tạo `tool_result` bằng chuỗi placeholder hằng số (giống hệt giữa mọi child).
3. Dựng một user message duy nhất chứa toàn bộ placeholder results, rồi đến per-child directive được bọc trong boilerplate tag.
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

Mảng message kết quả cho mỗi child trông như sau:

```
[...shared_history, assistant(all_tool_uses), user(placeholder_results..., directive)]
```

Mọi phần tử trước directive đều giống nhau giữa các child. `FORK_PLACEHOLDER_RESULT` -- chuỗi hằng `'Fork started -- processing in background'` -- đảm bảo ngay cả các khối tool result cũng byte-identical. Giá trị `tool_use_id` giống nhau vì chúng tham chiếu cùng assistant message. Chỉ khối văn bản cuối, chứa chỉ thị per-child, là thay đổi.

Cache boundary rơi ngay trước khối văn bản cuối đó. Mọi thứ phía trên -- có thể là hàng chục nghìn tokens của system prompt, tool definitions, conversation history, và placeholder results -- cache hit với giảm giá 90% cho mọi child sau child đầu.

---

## The Fork Boilerplate Tag (Thẻ boilerplate của fork)

Chỉ thị của mỗi child được bọc trong một thẻ XML boilerplate phục vụ hai mục đích: hướng dẫn child hành xử ra sao, và làm marker để phát hiện fork đệ quy.

Boilerplate chứa khoảng 10 quy tắc. Những quy tắc then chốt:

- **Override chỉ thị fork của parent.** System prompt của parent nói "mặc định dùng fork" -- boilerplate nói rõ với child: "chỉ thị đó dành cho parent. Bạn CHÍNH LÀ fork. KHÔNG spawn sub-agents."
- **Thực thi im lặng, báo cáo một lần.** Không tạo văn bản hội thoại giữa các lần gọi tool. Dùng tool trực tiếp, rồi xuất summary có cấu trúc.
- **Ở đúng phạm vi.** Child không được mở rộng ra ngoài chỉ thị của nó.
- **Định dạng output có cấu trúc.** Response phải theo mẫu Scope/Result/Key files/Files changed/Issues để parent dễ parse khi nhiều child báo về cùng lúc.

Quy tắc 1 đặc biệt thú vị. System prompt của parent -- thứ fork child kế thừa nguyên văn vì lý do cache -- có chỉ thị kiểu "mặc định dùng fork khi có công việc song song." Nếu child làm theo, nó sẽ fork child của chính nó, tạo đệ quy agent vô hạn. Boilerplate ghi đè rõ ràng: "chỉ thị đó dành cho parent. Bạn CHÍNH LÀ fork."

Định dạng output có cấu trúc (Scope/Result/Key files/Files changed/Issues) không phải để trang trí. Nó bó đầu ra của child vào báo cáo thực tế, giúp parent parse và gom kết quả dễ hơn khi năm child báo lại đồng thời.

---

## Recursive Fork Prevention (Ngăn fork đệ quy)

Fork child giữ Agent tool trong tool pool của nó. Nó buộc phải vậy -- bỏ đi sẽ đổi mảng tool đã serialized và làm prompt cache miss. Nhưng nếu child thực sự gọi Agent tool mà không có `subagent_type`, đường fork sẽ lại kích hoạt, tạo grandchild fork. Grandchild này thừa hưởng context còn lớn hơn (hội thoại parent + child), rồi spawn các fork của riêng nó, cứ thế tiếp diễn.

Hai lớp chặn ngăn chuyện này:

**Primary guard: querySource check.** Khi fork child được spawn, `context.options.querySource` của nó được đặt thành `'agent:builtin:fork'`. Hàm `call()` kiểm tra điều này trước khi cho phép đi theo nhánh fork:

```typescript
// In AgentTool.call():
if (effectiveType === undefined) {
  // Fork path -- but are we already in a fork?
  if (querySource === 'agent:builtin:fork') {
    // Reject: already a fork child
  }
}
```

Đây là fast path. Nó chỉ kiểm tra một chuỗi duy nhất trong options object.

**Fallback guard: message scanning.** Ngăn fork dùng hai guard: thẻ `querySource` đặt tại lúc spawn (fast path -- một phép so sánh chuỗi), và fallback quét message history để tìm boilerplate XML tag. Fallback tồn tại vì `querySource` sống qua autocompact, nhưng trong các edge case khi nó không được thread đúng cách, fallback quét message sẽ chặn vòng đệ quy. Đây là cách belt-and-suspenders, nơi chi phí check (quét messages) là rất nhỏ so với chi phí fork đệ quy ngoài ý muốn (API spend chạy mất kiểm soát).

Tại sao cần fallback? Vì Claude Code có tính năng autocompact, sẽ viết lại mảng message khi context quá dài. Autocompact có thể viết lại nội dung message nhưng giữ `querySource` trong options. Về lý thuyết, chỉ `querySource` là đủ. Trong thực tế, fallback quét message bắt được edge case nơi `querySource` không được thread chuẩn -- một cách belt-and-suspenders mà chi phí check (quét messages) là nhỏ bé so với chi phí fork đệ quy vô tình (runaway API spend).

---

## The Sync-to-Async Transition (Chuyển từ sync sang async)

Fork child bắt đầu chạy ở foreground: message của nó stream vào terminal của parent, và parent bị chặn để chờ hoàn tất. Nhưng nếu child chạy quá lâu thì sao? Claude Code cho phép backgrounding ngay giữa lúc thực thi -- user (hoặc auto-timeout) có thể đẩy một foreground agent đang chạy sang background mà không mất công việc nào.

Cơ chế này bất ngờ là rất gọn:

1. Khi một foreground agent được đăng ký qua `registerAgentForeground()`, một background signal promise được tạo.

2. Vòng lặp sync của parent chạy race giữa stream message của agent và background signal:

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

3. Khi background signal kích hoạt, foreground iterator được kết thúc êm qua `iterator.return()`. Việc này kích hoạt khối `finally` của generator, nơi xử lý cleanup.

4. Một instance `runAgent()` mới được spawn với `isAsync: true`, dùng cùng agent ID và message history đã tích lũy tới thời điểm đó. Agent tiếp tục đúng chỗ đã dừng, nhưng giờ chạy ở background.

5. Lời gọi synchronous `call()` ban đầu trả về `{ status: 'async_launched' }`, và parent tiếp tục hội thoại.

Không có công việc nào mất vì message history chính là state của agent. Sidechain transcript trên đĩa chứa mọi message agent đã tạo. Instance async mới replay từ transcript này và tiếp tục tại điểm instance sync đã dừng.

---

## Auto-Backgrounding (Tự động đẩy nền)

Khi biến môi trường `CLAUDE_AUTO_BACKGROUND_TASKS` hoặc cờ GrowthBook `tengu_auto_background_agents` được bật, foreground agents sẽ tự động chuyển sang background sau 120 giây:

Khi bật qua biến môi trường hoặc feature flag, foreground agents sẽ tự động được đẩy nền sau 120 giây. Khi tắt, hàm trả về 0 (không auto-backgrounding).

Đây là một quyết định UX có hệ quả chi phí. Foreground agent chặn terminal của parent -- user không thể gõ, không thể ra chỉ thị mới, không thể spawn agent khác. Hai phút đủ dài để agent hoàn thành hầu hết task ngắn theo kiểu synchronous (nơi streaming output cho phản hồi hữu ích), nhưng cũng đủ ngắn để task dài không giữ terminal làm con tin.

Trong thí nghiệm fork, câu hỏi auto-backgrounding trở nên không còn ý nghĩa: mọi lần fork spawn đều bị ép async ngay từ đầu. Tham số `run_in_background` bị ẩn hoàn toàn khỏi schema. Mỗi fork child chạy ở background, báo lại qua `<task-notification>` khi xong, và parent không bao giờ bị chặn.

---

## When Fork Is NOT Used (Khi KHÔNG dùng Fork)

Fork là một trong nhiều chế độ orchestration, và nó được cố ý loại trừ trong ba trường hợp:

**Coordinator mode.** Coordinator mode và fork mode loại trừ lẫn nhau. Coordinator có mô hình ủy quyền có cấu trúc: nó giữ kế hoạch, giao task cho worker bằng prompt tường minh, và theo dõi tiến độ. Cách "kế thừa mọi thứ" của fork sẽ phá điều này. Một coordinator bị fork sẽ kế thừa system prompt của parent coordinator (nói rằng "bạn là coordinator, hãy ủy quyền công việc"), và child sẽ cố điều phối thay vì thực thi. Hàm `isForkSubagentEnabled()` kiểm tra `isCoordinatorMode()` trước và trả false nếu đang bật.

**Non-interactive sessions.** SDK và API consumers (`--print` mode, Claude Agent SDK) chạy mà không có terminal. `permissionMode: 'bubble'` của fork hiển thị permission prompts lên terminal của parent -- vốn không tồn tại trong non-interactive mode. Thay vì xây flow quyền riêng, đường fork đơn giản là bị tắt. SDK consumers dùng chọn `subagent_type` tường minh.

**Explicit subagent_type.** Khi model chỉ định `subagent_type` (ví dụ: `"Explore"`, `"Plan"`, `"general-purpose"`), đường fork không kích hoạt. Fork chỉ chạy khi bỏ trống `subagent_type`. Điều này cho model chọn giữa "tôi muốn một agent chuyên biệt với system prompt và tool set riêng" (type tường minh) và "tôi muốn một bản sao kế thừa context của chính tôi để xử lý song song" (bỏ trống type).

---

## The Economics (Bài toán kinh tế)

Xét một kịch bản cụ thể. Developer yêu cầu Claude Code refactor một module. Parent agent phân tích codebase, lập kế hoạch, rồi dispatch năm fork child song song: một child cập nhật database schema, một child viết lại service layer, một child cập nhật router, một child sửa tests, và một child cập nhật types.

Tại thời điểm này trong hội thoại, shared context đã rất lớn:
- System prompt: ~4,000 tokens
- Tool definitions (40+ tools): ~12,000 tokens
- Conversation history (analysis + planning): ~30,000 tokens
- Assistant message với năm khối tool_use: ~2,000 tokens
- Placeholder tool results: ~500 tokens

Tổng shared prefix: ~48,500 tokens. Per-child directive: ~200 tokens.

Không dùng fork (năm agent độc lập, mỗi agent có context mới và system prompt riêng):
- Mỗi child xử lý system prompt + tools + task prompt của chính nó
- Không có cache sharing (khác system prompts, khác tool sets)
- Chi phí: 5 x xử lý input giá đầy đủ

Dùng fork (byte-identical prefixes):
- Child 1: 48,700 tokens giá đầy đủ (cache miss ở request đầu)
- Child 2-5: 48,500 tokens ở 10% giá (cache hit) + 200 tokens giá đầy đủ mỗi child
- Chi phí hiệu dụng cho child 2-5: ~4,850 + 200 = ~5,050 token tương đương mỗi child

Mức tiết kiệm tăng theo kích thước context và số lượng child. Với một phiên đã ấm có 100K tokens history và spawn 8 fork song song, phần cache savings có thể vượt 90% so với chi phí input tokens nếu không chia sẻ.

Đó là lý do mọi quyết định thiết kế trong hệ thống fork -- thread thay vì tính lại, exact tool passthrough, placeholder results, kể cả việc giữ Agent tool trong pool của child dù bị cấm dùng -- đều tối ưu cho một mục tiêu: byte-identical prefixes. Mỗi quyết định đánh đổi một chút thanh lịch hoặc an toàn để đổi lấy giảm chi phí API đo được.

---

## Design Tensions (Các lực căng thiết kế)

Hệ thống fork có những đánh đổi tường minh đáng để hiểu:

**Isolation vs. cache efficiency.** Fork child kế thừa mọi thứ, bao gồm cả conversation history có thể không liên quan đến task của nó. Một child đang viết lại tests không cần 15 message nơi parent bàn về database schema design. Nhưng giữ các message đó mới giúp prefix giống hệt. Lược bỏ history không liên quan sẽ tiết kiệm context window nhưng làm cache miss. Cược thiết kế ở đây là cache savings lớn hơn chi phí context overhead.

**Safety vs. cache efficiency.** Agent tool được giữ trong tool pool của fork child dù child không được phép dùng. Bỏ nó đi sẽ an toàn hơn (child không thể thử fork), nhưng sẽ đổi serialization của mảng tool. Boilerplate tag và recursive fork guards là các kiểm soát bù -- ngăn ở runtime thay vì loại bỏ tĩnh.

**Simplicity vs. cache efficiency.** Placeholder tool results là một sự giả lập. Child thấy `'Fork started -- processing in background'` cho mọi khối tool_use trong assistant message của parent, bất kể những tool call đó thực sự làm gì. Điều này chấp nhận được vì chỉ thị của child đã nói rõ phải làm gì -- nó không cần tool results chính xác từ lượt dispatch của parent. Nhưng cũng có nghĩa conversation history của child về mặt kỹ thuật là thiếu nhất quán. Placeholder được chọn vì ngắn gọn và đồng nhất, không phải vì chính xác.

Mỗi đánh đổi này phản ánh cùng một ưu tiên: khi bạn trả tiền theo token cho API calls ở quy mô lớn, byte-identical prefixes đáng để bẻ kiến trúc xoay quanh chúng.

---

## Apply This: Designing for Prompt Cache Efficiency

Mẫu fork agent có thể tổng quát vượt ra ngoài Claude Code. Bất kỳ hệ thống nào dispatch nhiều LLM call song song từ cùng một context đều có thể hưởng lợi từ cache-aware request construction. Các nguyên tắc:

**1. Thread rendered prompts, do not recompute.** Nếu system prompt của bạn có bất kỳ nội dung động nào -- feature flags, timestamps, user preferences, biến thể A/B test -- hãy chụp kết quả đã render và truyền cho child theo giá trị. Tính lại có rủi ro sai lệch.

**2. Freeze the tool array.** Nếu child của bạn cần các tool set khác nhau, bạn đang từ bỏ cache sharing trên khối tools. Hãy cân nhắc giữ full tool set và dùng runtime guards (như quy tắc "do not use Agent" trong fork boilerplate) thay vì compile-time removal.

**3. Maximize the shared prefix, minimize the per-child suffix.** Hãy cấu trúc mảng message sao cho mọi phần dùng chung nằm ở đầu, và nội dung per-child được nối ở cuối. Trộn xen kẽ mảnh shared và per-child sẽ làm vỡ cache boundary.

**4. Use constant placeholders for variable content.** Khi cấu trúc message bắt buộc phải có phản hồi cho các tool call trước đó, hãy dùng chuỗi placeholder giống hệt cho mọi child thay vì kết quả thực (vốn khác nhau).

**5. Measure the break-even.** Cache sharing có overhead: context window lớn hơn cho mỗi child (vì mang history không liên quan), runtime guards thay cho an toàn tĩnh, độ phức tạp kiến trúc cao hơn. Hãy tính xem mô hình song song của bạn (bao nhiêu child, shared prefix lớn cỡ nào) có thật sự tiết kiệm tiền sau khi tính thêm tokens context hay không.

Hệ thống fork agent, về cốt lõi, là một động cơ khai thác prompt cache. Nó trả lời câu hỏi mà mọi người xây multi-agent system sớm muộn đều gặp: khi cache cho bạn giảm giá 90% với prefix lặp lại, bạn sẵn sàng tái cấu trúc kiến trúc đến mức nào để lấy được mức giảm đó? Câu trả lời của Claude Code là: rất xa.