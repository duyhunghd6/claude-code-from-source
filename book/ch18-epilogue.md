# Chương 18: Những gì chúng ta học được

## Năm cược kiến trúc

Claude Code không phải agentic system duy nhất. Nó cũng không phải hệ thống đầu tiên. Nhưng nó đã đặt ra năm cược kiến trúc khiến nó khác biệt trong bức tranh chung của các agent framework, và sau gần hai nghìn tệp cùng mười bảy chương, năm cược đó đáng để phân tích kỹ.

### Cược 1: Generator loop thay vì callback

Phần lớn agent framework đưa cho bạn một pipeline: định nghĩa tool, đăng ký handler, rồi để framework điều phối. Lập trình viên viết callback. Framework quyết định khi nào gọi callback đó.

Claude Code làm ngược lại. Hàm `query()` là một async generator -- lập trình viên nắm quyền điều khiển vòng lặp. Model stream phản hồi, generator yield tool call, bên gọi thực thi chúng, nối thêm kết quả, rồi generator tiếp tục lặp. Có một hàm, một luồng dữ liệu, một nơi duy nhất mà mọi tương tác đều đi qua. 10 terminal state và 7 continuation state trong return type của generator mã hóa mọi kết cục có thể xảy ra. Vòng lặp chính là hệ thống.

Cược ở đây là: một hàm generator duy nhất, kể cả khi phình lên 1.700 dòng, vẫn dễ hiểu hơn một callback graph phân tán. Sau khi đọc source, cược này đã thắng. Muốn hiểu vì sao một session kết thúc, bạn nhìn vào một hàm. Muốn thêm terminal state mới, bạn thêm một variant vào một discriminated union. Type system buộc bạn xử lý đầy đủ mọi nhánh. Nếu dùng callback architecture, logic này sẽ rải ra hàng chục tệp, và tương tác giữa callback sẽ ngầm ẩn thay vì hiển lộ trong control flow.

### Cược 2: File-based memory thay vì database

Chương 11 đã lập luận chi tiết, nhưng ý nghĩa kiến trúc ở đây vượt khỏi riêng phần memory. Quyết định dùng tệp Markdown thuần thay vì SQLite, vector database, hay cloud service là một cược vào tính minh bạch thay vì tính năng. Database cho truy vấn phong phú hơn, tra cứu nhanh hơn, và bảo đảm giao dịch. Tệp không có những thứ đó. Điều tệp mang lại là lòng tin.

Một người dùng mở `~/.claude/projects/myapp/memory/MEMORY.md` bằng vim và thấy chính xác agent đang nhớ gì về họ sẽ có mối quan hệ rất khác với hệ thống, so với người phải hỏi agent "bạn nhớ gì về tôi?" rồi hy vọng câu trả lời đầy đủ. Thiết kế file-based biến trạng thái tri thức của agent thành thứ có thể quan sát từ bên ngoài, không chỉ là thứ agent tự báo cáo. Điều này quan trọng hơn hiệu năng truy vấn. Hệ thống recall dựa trên LLM bù cho storage đơn giản bằng retrieval thông minh -- một Sonnet side-query chọn năm memory liên quan từ manifest chính xác hơn embedding similarity và không cần hạ tầng bổ sung.

### Cược 3: Tool tự mô tả thay vì bộ điều phối trung tâm

Các agent framework thường cung cấp tool registry: bạn mô tả tool trong một cấu hình trung tâm, rồi framework trình chúng cho model. Claude Code để tool tự mô tả chính nó. Mỗi `Tool` object mang theo tên, mô tả, input schema, phần đóng góp vào prompt, cờ an toàn đồng thời, và logic thực thi. Việc của tool system không phải mô tả tool cho model -- mà là để tool tự mô tả.

Cược này phát huy rõ ở extensibility. MCP tool (Chương 15) trở thành first-class citizen chỉ bằng cách triển khai cùng một interface. Một tool từ MCP server và một built-in tool là không thể phân biệt đối với model. Hệ thống không cần tầng "MCP tool adapter" riêng -- bước wrapping tạo ra một `Tool` object chuẩn, và từ đó pipeline sẵn có xử lý toàn bộ: kiểm tra quyền, thực thi đồng thời, budgeting kết quả, hook interception.

### Cược 4: Fork agent để chia sẻ cache

Chương 9 đã nói về cơ chế fork: một sub-agent khởi chạy với toàn bộ hội thoại của parent trong context window, dùng chung prompt cache của parent. Đây không phải một tối ưu tiện tay -- mà là cược kiến trúc rằng mô hình cache sharing xứng đáng với độ phức tạp của quản lý vòng đời fork.

Phương án thay thế -- tạo một agent mới với bản tóm tắt hội thoại -- đơn giản hơn nhưng đắt hơn. Mỗi agent mới phải trả toàn bộ chi phí xử lý context từ đầu. Agent fork nhận prefix đã được cache của parent gần như miễn phí (giảm khoảng 90% chi phí input token), nên việc spawn agent cho tác vụ nhỏ trở nên kinh tế: memory extraction, code review, verification pass. Background memory extraction agent (Chương 11) chạy sau mỗi lượt query loop, và chi phí của nó thấp chính vì dùng chung cache với parent. Nếu không có fork-based cache sharing, agent đó sẽ quá đắt.

### Cược 5: Hook thay vì plugin

Hầu hết extensibility system dùng plugin -- code đăng ký khả năng và chạy trong host process. Claude Code dùng hook -- process bên ngoài chạy tại các lifecycle point và giao tiếp qua exit code cùng JSON trên stdin/stdout.

Cược ở đây là process isolation đáng giá hơn overhead. Plugin có thể làm crash host. Hook chỉ crash process của chính nó. Plugin có thể rò rỉ bộ nhớ vào heap của host. Bộ nhớ của hook chết theo process của nó. Plugin đòi một API surface phải versioning và bảo trì. Hook chỉ cần stdin, stdout, và exit code -- một protocol ổn định từ năm 1971.

Overhead là có thật: spawn một process cho mỗi lần gọi hook tốn vài mili giây mà callback in-process không tốn. Fast path -70% cho internal callback (Chương 12) cho thấy hệ thống hiểu rõ chi phí này quan trọng. Nhưng với external hook -- user script, team linter, enterprise policy server -- bảo đảm isolation giúp hệ thống mở rộng an toàn hơn. Một doanh nghiệp có thể triển khai policy enforcement dựa trên hook mà không lo hook script lỗi sẽ làm crash session của lập trình viên.

---

## Điều gì chuyển giao được, điều gì không

Không phải pattern nào trong Claude Code cũng tổng quát hóa được. Một số là hệ quả của quy mô, nguồn lực, hoặc ràng buộc cụ thể mà các nhóm xây agent khác có thể không có.

### Pattern chuyển giao được cho mọi agent

**Generator loop pattern.** Bất kỳ agent nào cần stream phản hồi, xử lý tool call, và quản lý nhiều terminal state đều hưởng lợi khi làm vòng lặp tường minh thay vì ẩn sau callback. Discriminated union return type -- mã hóa chính xác vì sao vòng lặp dừng -- là pattern loại bỏ hẳn một lớp bug kiểu "vì sao agent dừng?".

**File-based memory với LLM recall.** Chi tiết triển khai là của Claude Code, nhưng nguyên tắc -- lưu trữ đơn giản kết hợp retrieval thông minh -- áp dụng cho mọi agent cần lưu tri thức qua nhiều session. Four-type taxonomy (user, feedback, project, reference) và derivability test ("điều này có thể được suy ra lại từ trạng thái project hiện tại không?") là các design heuristic có thể tái sử dụng.

**Kênh đọc/ghi bất đối xứng cho remote execution.** Khi reads là stream tần suất cao và writes là RPC tần suất thấp, tách riêng hai kênh là đúng bất kể transport protocol cụ thể là gì.

**Bitmap pre-filter cho search.** Bất kỳ agent nào tìm trên chỉ mục tệp lớn đều hưởng lợi từ bitmap chữ cái 26-bit làm pre-filter. Bốn byte mỗi mục, một phép so sánh số nguyên cho mỗi ứng viên -- tỷ lệ chi phí/lợi ích cực kỳ ấn tượng.

**Prompt cache stability như một mối quan tâm kiến trúc.** Nếu agent của bạn dùng API có prompt caching, cấu trúc prompt theo thứ tự nội dung ổn định trước và nội dung biến động sau không phải tối ưu nhỏ -- đó là quyết định kiến trúc quyết định luôn cấu trúc chi phí.

### Pattern đặc thù ở quy mô của Claude Code

**Forked terminal renderer.** Claude Code đã fork Ink và viết lại rendering pipeline bằng packed typed arrays, pool-based interning, và cell-level diffing vì nó cần streaming 60fps trong terminal. Phần lớn agent render lên web interface hoặc log đơn giản. Mức đầu tư kỹ thuật này chỉ hợp lý khi terminal rendering là UI chính và tần suất streaming cao.

**Hơn 50 checkpoint startup profiling.** Điều này có ý nghĩa khi bạn có hàng trăm nghìn người dùng và lấy mẫu 0,5% vẫn cho dữ liệu đủ mạnh về mặt thống kê. Với agent nhỏ hơn, hệ thống đo thời gian đơn giản hơn là đủ.

**Tám loại MCP transport.** Claude Code hỗ trợ stdio, SSE, HTTP, WebSocket, SDK, hai biến thể IDE, và Claude.ai proxy vì nó phải tích hợp với mọi topology triển khai. Đa số agent chỉ cần stdio và HTTP.

**Hooks snapshot security model.** Việc đóng băng cấu hình hook tại startup và không ngầm đọc lại là một phòng vệ cho mối đe dọa rất cụ thể: mã độc trong repository sửa hook sau khi người dùng chấp nhận trust dialog. Điều này quan trọng khi agent chạy trên repository bất kỳ với cấu hình `.claude/` không đáng tin. Agent chỉ chạy trong môi trường tin cậy có thể dùng quản lý hook đơn giản hơn.

---

## Cái giá của độ phức tạp

Gần hai nghìn tệp. Đổi lại được gì, và tốn gì?

Số lượng tệp dễ gây hiểu lầm nếu dùng làm thước đo độ phức tạp. Phần lớn trong đó là hạ tầng test, type definition, configuration schema, và bộ Ink renderer đã fork. Độ phức tạp hành vi thực sự tập trung ở một số ít tệp mật độ cao: `query.ts` (1.700 dòng, agent loop), `hooks.ts` (4.900 dòng, hệ thống lifecycle interception), `REPL.tsx` (5.000 dòng, interactive orchestrator), và các hàm xây prompt của hệ thống memory.

Độ phức tạp đến từ ba nguồn, mỗi nguồn mang một kiểu khác nhau:

**Đa dạng protocol.** Hỗ trợ năm terminal keyboard protocol, tám loại MCP transport, bốn remote execution topology, và bảy configuration scope là phức tạp một cách bản chất. Mỗi protocol thêm vào làm codebase tăng tuyến tính, không phải theo hàm mũ -- nhưng tổng cộng lại rất lớn. Đây là accidental complexity theo nghĩa Brooks: nó đến từ môi trường (phân mảnh terminal, tiến hóa MCP transport, topology triển khai từ xa), không phải từ cốt lõi bài toán.

**Tối ưu hiệu năng.** Pool-based rendering, bitmap search pre-filter, sticky cache latch, và speculative tool execution đều thêm độ phức tạp để đổi lấy cải thiện hiệu năng có đo đạc. Độ phức tạp này được biện minh bằng số liệu -- mọi tối ưu đều có dữ liệu profiling chỉ ra bottleneck trước đó. Rủi ro là các tối ưu tích lũy rồi tương tác với nhau, khiến hot path khó sửa hơn.

**Tinh chỉnh hành vi.** Prompt instruction của hệ thống memory, staleness warning, verification protocol, chỉ thị chống mẫu "ignore memory" -- đây không phải code complexity. Đây là prompt complexity, và nó có gánh nặng bảo trì kiểu khác. Khi hành vi model đổi qua các phiên bản, các prompt instruction từng được tinh chỉnh kỹ qua eval có thể phải tinh chỉnh lại. Hạ tầng eval (được nhắc khắp codebase bằng case number và eval score) là lớp phòng thủ chống regression, nhưng đòi đầu tư liên tục.

Gánh nặng bảo trì của hệ thống này là đáng kể. Một kỹ sư mới đọc codebase không chỉ phải hiểu code path mà còn phải hiểu kết quả eval dẫn đến từng cách viết prompt, production incident dẫn đến từng security check, và performance profile dẫn đến từng tối ưu. Comment trong code rất kỹ -- nhiều chỗ có case number eval và số đo trước/sau -- nhưng comment kỹ trong gần hai nghìn tệp tự nó cũng là một gánh nặng đọc.

---

## Agentic system đang đi về đâu

Bốn xu hướng hiện ra từ các pattern trong Claude Code, và chúng chỉ về hướng mà cả lĩnh vực đang tiến tới.

### MCP như universal protocol

Chương 15 mô tả Claude Code là một trong những MCP client hoàn chỉnh nhất. Ý nghĩa không nằm ở triển khai cụ thể của Claude Code -- mà ở việc MCP tồn tại. Một protocol chuẩn cho tool discovery và invocation có nghĩa là tool xây cho một agent có thể dùng với mọi agent nói MCP. Hiệu ứng hệ sinh thái là rõ ràng: một MCP server cho Postgres, khi đã xây xong, phục vụ mọi agent hỗ trợ MCP. Khoản đầu tư tích hợp tool của lập trình viên trở nên portable.

Hàm ý cho người xây agent: nếu bạn đang tự định nghĩa một tool protocol riêng, rất có thể bạn đang đi sai hướng. MCP đã đủ tốt, đang tốt dần lên, và lợi thế hệ sinh thái của chuẩn chung sẽ cộng dồn theo thời gian. Hãy xây MCP client, đóng góp cho spec, và để protocol tiến hóa qua phản hồi cộng đồng.

### Điều phối multi-agent

Sub-agent system của Claude Code (Chương 8), task coordination (Chương 10), và cơ chế fork (Chương 9) là những triển khai sớm của pattern multi-agent. Chúng giải quyết các bài toán cụ thể -- cache sharing, parallel exploration, structured verification -- nhưng cũng phơi bày thách thức cốt lõi: coordination overhead.

Mọi message giữa các agent đều tốn token. Mọi fork chia sẻ cache nhưng thêm một nhánh hội thoại mà parent sớm muộn cũng phải reconcile. State machine của hệ thống Task (queued, running, completed, failed, cancelled) là bộ máy điều phối làm tăng độ phức tạp mà không tăng thêm khả năng. Khi agent mạnh hơn, áp lực sẽ chuyển từ "làm sao điều phối nhiều agent?" sang "làm sao để một agent đủ mạnh để không cần điều phối?"

Bằng chứng hiện tại cho thấy hai hướng sẽ cùng tồn tại. Tác vụ đơn giản dùng single-agent. Tác vụ phức tạp dùng multi-agent system có điều phối. Thách thức kỹ thuật là hạ coordination overhead đủ thấp để điểm giao cắt nghiêng về multi-agent cho công việc thực sự song song, không chỉ cho công việc phức tạp.

### Persistent memory

Hệ thống memory của Claude Code là phiên bản 1 của persistent memory cho agent. Thiết kế file-based, four-type taxonomy, LLM-powered recall, staleness system, và KAIROS mode cho session dài đều là lời giải thế hệ đầu cho một bài toán chắc chắn còn tiến hóa mạnh.

Các hệ thống memory tương lai có thể thêm structured retrieval (hệ thống hiện tại lấy cả tệp; tương lai có thể lấy fact cụ thể), cross-project transfer learning (sở thích người dùng áp dụng khắp nơi, quy ước dự án thì không), và collaborative memory (team memory ở Chương 11 là bước đầu, nhưng sync, conflict resolution, và access control vẫn còn tối giản).

Câu hỏi mở là liệu cách tiếp cận file-based có scale được không. Ở mức 200 memory mỗi project, nó hoạt động tốt. Ở mức 2.000 memory mỗi project, manifest cho Sonnet side-query sẽ quá lớn, consolidation quá đắt, và index vượt giới hạn. Cược kiến trúc files-over-databases sẽ gặp bài kiểm tra khó nhất khi mức sử dụng tăng cao.

### Vận hành tự chủ

KAIROS mode, background memory extraction agent, auto-dream consolidation, speculative tool execution -- tất cả đều là bước tiến toward autonomous operation. Agent làm việc hữu ích mà không cần được yêu cầu: nhớ những gì bạn quên bảo nó nhớ, tự consolidate tri thức khi bạn ngủ, bắt đầu chạy tool tiếp theo trước khi phản hồi hiện tại kết thúc.

Quỹ đạo đã rõ. Agent tương lai sẽ bớt phản ứng và chủ động hơn. Chúng sẽ nhận ra pattern người dùng chưa mô tả, gợi ý sửa lỗi người dùng chưa yêu cầu, và tự duy trì tri thức mà không cần lệnh `/remember` tường minh. Hệ thống memory của Claude Code, với lưới an toàn extraction nền và các heuristic prompt-engineered về "nên lưu gì", là bản mẫu cho tương lai đó.

Ràng buộc ở đây là lòng tin. Vận hành tự chủ đòi hỏi người dùng tin rằng agent sẽ làm đúng khi không có giám sát. File-based memory, hook system có thể quan sát, staleness warning, permission dialog -- tất cả đều tồn tại vì lòng tin phải được xây dựng, không thể mặc định. Con đường đến agent tự chủ hơn đi qua agent minh bạch hơn.

---

## Kết luận

Mười bảy chương. Sáu abstraction cốt lõi. Một generator loop ở trung tâm, tool mở rộng ra ngoài, memory kéo ngược về thời gian, hook canh giữ vòng ngoài, một rendering engine chuyển mọi thứ thành ký tự trên màn hình, và MCP nối nó với thế giới bên ngoài codebase.

Pattern sâu nhất trong Claude Code không phải một kỹ thuật đơn lẻ. Đó là quyết định lặp đi lặp lại: đẩy độ phức tạp ra biên. Rendering system đẩy độ phức tạp vào pool và diff -- bên trong pipeline, mọi thứ chỉ là so sánh số nguyên. Input system đẩy độ phức tạp vào tokenizer và keybinding resolver -- bên trong handler, mọi thứ là typed action. Memory system đẩy độ phức tạp vào write protocol và recall selector -- bên trong hội thoại, mọi thứ là context. Agent loop đẩy độ phức tạp vào terminal state và tool system -- bên trong loop, nó chỉ là: stream, collect, execute, append, repeat.

Mỗi biên hấp thụ hỗn loạn và xuất ra trật tự. Raw byte trở thành `ParsedKey`. Tệp Markdown trở thành recalled memory. MCP JSON-RPC trở thành `Tool` object. Hook exit code trở thành permission decision. Ở một phía của mỗi biên, thế giới lộn xộn -- năm keyboard protocol, OAuth server mong manh, memory stale, hook repository không đáng tin. Ở phía còn lại, thế giới có kiểu, có ranh giới, và được xử lý đầy đủ mọi nhánh.

Nếu bạn đang xây một agentic system, đây là bài học chuyển giao được. Không phải những kỹ thuật cụ thể -- bạn có thể không cần pool-based rendering, KAIROS mode, hay tám loại MCP transport. Mà là nguyên lý: định nghĩa boundary, hấp thụ độ phức tạp tại đó, và giữ phần giữa chúng sạch. Biên là nơi kỹ thuật khó nhất. Nội bộ là nơi kỹ thuật dễ chịu nhất. Hãy thiết kế để phần nội bộ luôn sáng sủa, rồi đầu tư ngân sách độ phức tạp của bạn vào phần rìa.

Mã nguồn là mở. Con cua đã giữ tấm bản đồ trong càng. Hãy đọc nó.