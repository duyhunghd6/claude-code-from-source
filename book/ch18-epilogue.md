# Chương 18: What We Learned

## Five Architectural Bets (Năm cược kiến trúc)

Claude Code không phải hệ thống agentic duy nhất. Cũng không phải hệ thống đầu tiên. Nhưng nó đã đặt năm cược kiến trúc khiến nó khác biệt với bức tranh chung của các agent framework, và sau gần hai nghìn file cùng mười bảy chương, những cược này xứng đáng được mổ xẻ.

### Bet 1: The Generator Loop Over Callbacks (Ưu tiên generator loop thay vì callback)

Phần lớn agent framework đưa cho bạn một pipeline: định nghĩa tool, đăng ký handler, để framework điều phối. Lập trình viên viết callback. Framework quyết định khi nào gọi chúng.

Claude Code làm ngược lại. Hàm `query()` là một async generator -- lập trình viên sở hữu vòng lặp. Model stream phản hồi, generator yield tool call, bên gọi thực thi chúng, nối thêm kết quả, rồi generator lặp tiếp. Có một hàm, một luồng dữ liệu, một nơi mà mọi tương tác đều đi qua. 10 terminal state và 7 continuation state trong return type của generator mã hóa mọi kết cục có thể xảy ra. Vòng lặp chính là hệ thống.

Cược ở đây là một hàm generator duy nhất, kể cả khi nó phình lên 1.700 dòng, sẽ dễ hiểu hơn một callback graph phân tán. Sau khi nghiên cứu source, cược này đã thắng. Khi muốn hiểu vì sao một session kết thúc, bạn nhìn vào một hàm. Khi muốn thêm terminal state mới, bạn thêm một variant vào một discriminated union. Type system ép xử lý đầy đủ mọi nhánh. Kiến trúc callback sẽ rải logic này qua hàng chục file, và tương tác giữa callback sẽ ngầm ẩn thay vì hiển thị rõ trong control flow.

### Bet 2: File-Based Memory Over Databases (Dùng memory dựa trên file thay vì database)

Chương 11 đã lập luận chi tiết, nhưng ý nghĩa kiến trúc còn vượt ra ngoài memory. Quyết định dùng file Markdown thuần thay vì SQLite, vector database, hay cloud service là một cược đặt vào tính minh bạch thay vì tính năng. Database hỗ trợ truy vấn phong phú hơn, tra cứu nhanh hơn, và đảm bảo giao dịch. File không có những thứ đó. Thứ file mang lại là niềm tin.

Một người dùng mở `~/.claude/projects/myapp/memory/MEMORY.md` trong vim và thấy chính xác agent nhớ gì về họ sẽ có mối quan hệ hoàn toàn khác với hệ thống so với người dùng buộc phải hỏi agent "bạn nhớ gì về tôi?" rồi hy vọng câu trả lời là đầy đủ. Thiết kế dựa trên file biến trạng thái tri thức của agent thành thứ có thể quan sát từ bên ngoài, không chỉ là tự khai báo. Điều này quan trọng hơn hiệu năng truy vấn. Hệ thống recall chạy bằng LLM bù lại sự đơn giản của storage bằng trí thông minh truy xuất -- một side-query Sonnet chọn năm memory liên quan từ manifest chính xác hơn embedding similarity và không cần hạ tầng nào.

### Bet 3: Self-Describing Tools Over Central Orchestrators (Tool tự mô tả thay vì bộ điều phối trung tâm)

Agent framework thường cung cấp một tool registry: bạn mô tả tool trong cấu hình trung tâm, rồi framework đưa chúng cho model. Tool của Claude Code tự mô tả chính nó. Mỗi `Tool` object mang theo tên, mô tả, input schema, phần đóng góp vào prompt, cờ an toàn đồng thời, và logic thực thi. Việc của tool system không phải mô tả tool cho model -- mà là để tool tự mô tả.

Cược này trả cổ tức ở khả năng mở rộng. MCP tool (Chương 15) trở thành công dân hạng nhất bằng cách triển khai cùng một interface. Một tool từ MCP server và một tool tích hợp sẵn là không thể phân biệt với model. Hệ thống không cần thêm tầng "MCP tool adapter" riêng -- bước wrapping tạo ra `Tool` object chuẩn, và từ đó pipeline tool hiện có xử lý tất cả: kiểm tra quyền, thực thi đồng thời, budgeting kết quả, chặn bởi hook.

### Bet 4: Fork Agents for Cache Sharing (Fork agent để chia sẻ cache)

Chương 9 đã nói về cơ chế fork: một sub-agent khởi động với toàn bộ cuộc hội thoại của parent trong context window, chia sẻ prompt cache của parent. Đây không phải tối ưu tiện tay -- mà là một cược kiến trúc rằng mô hình chia sẻ cache đáng để gánh độ phức tạp của quản lý vòng đời fork.

Phương án khác -- sinh agent mới với bản tóm tắt hội thoại -- đơn giản hơn nhưng đắt. Mỗi agent mới trả toàn bộ chi phí xử lý context từ đầu. Agent fork nhận prefix đã cache của parent miễn phí (chiết khấu 90% token đầu vào), khiến việc spawn agent cho tác vụ nhỏ trở nên kinh tế: memory extraction, code review, verification pass. Agent trích xuất memory chạy nền (Chương 11) chạy sau mỗi lượt query loop, và chi phí của nó thấp chính vì chia sẻ cache của parent. Không có chia sẻ cache dựa trên fork, agent đó sẽ đắt đến mức khó chấp nhận.

### Bet 5: Hooks Over Plugins (Ưu tiên hook thay vì plugin)

Phần lớn hệ thống mở rộng dùng plugin -- code đăng ký năng lực và chạy trong process chủ. Claude Code dùng hook -- process bên ngoài chạy ở các lifecycle point và giao tiếp qua exit code cùng JSON trên stdin/stdout.

Cược là process isolation đáng giá hơn overhead. Plugin có thể làm host crash. Hook chỉ crash process của chính nó. Plugin có thể rò bộ nhớ vào heap của host. Bộ nhớ của hook chết theo process của nó. Plugin đòi hỏi API surface phải version và bảo trì. Hook chỉ cần stdin, stdout và exit code -- một protocol ổn định từ năm 1971.

Overhead là có thật: spawn một process cho mỗi lần gọi hook tốn vài mili giây mà callback trong-process không tốn. Đường fast path -70% cho callback nội bộ (Chương 12) cho thấy hệ thống hiểu rõ chi phí này quan trọng. Nhưng với hook bên ngoài -- script người dùng, linter của team, policy server doanh nghiệp -- đảm bảo cô lập giúp hệ thống mở rộng an toàn hơn. Doanh nghiệp có thể triển khai thực thi policy dựa trên hook mà không lo script hook lỗi định dạng sẽ làm crash phiên làm việc của lập trình viên.

---

## What Transfers, What Does Not (Điều gì chuyển giao được, điều gì thì không)

Không phải mẫu nào trong Claude Code cũng tổng quát hóa được. Một số là hệ quả của quy mô, nguồn lực, hoặc ràng buộc đặc thù mà đội xây agent khác có thể không gặp.

### Patterns That Transfer to Any Agent (Các mẫu chuyển giao được cho mọi agent)

**The generator loop pattern (mẫu generator loop).** Bất kỳ agent nào cần stream phản hồi, xử lý tool call, và quản lý nhiều terminal state đều có lợi khi làm vòng lặp tường minh thay vì giấu sau callback. Return type dạng discriminated union -- mã hóa chính xác vì sao vòng lặp dừng -- là mẫu loại bỏ cả một lớp debug kiểu "vì sao agent dừng?".

**File-based memory with LLM recall (memory dựa trên file với recall bằng LLM).** Chi tiết triển khai cụ thể là của Claude Code, nhưng nguyên lý -- lưu trữ đơn giản kết hợp truy xuất thông minh -- áp dụng cho mọi agent cần lưu tri thức qua nhiều phiên. Four-type taxonomy (user, feedback, project, reference) và derivability test ("điều này có thể suy ra lại từ trạng thái project hiện tại không?") là các heuristic thiết kế tái sử dụng được.

**Asymmetric read/write channels for remote execution (kênh đọc/ghi bất đối xứng cho thực thi từ xa).** Khi đọc là luồng tần suất cao và ghi là RPC tần suất thấp, tách hai kênh này là đúng bất kể protocol transport cụ thể là gì.

**Bitmap pre-filters for search (bộ lọc trước bằng bitmap cho tìm kiếm).** Mọi agent tìm trên index file lớn đều hưởng lợi từ bitmap 26-bit ký tự làm lớp pre-filter. Bốn byte mỗi entry, một phép so sánh số nguyên cho mỗi ứng viên -- tỷ lệ lợi ích/chi phí là rất ấn tượng.

**Prompt cache stability as an architectural concern (độ ổn định prompt cache là một mối quan tâm kiến trúc).** Nếu agent của bạn dùng API có prompt caching, tổ chức prompt với phần ổn định trước và phần biến động sau không chỉ là tối ưu -- đó là quyết định kiến trúc định hình cấu trúc chi phí của bạn.

### Patterns Specific to Claude Code's Scale (Các mẫu đặc thù cho quy mô của Claude Code)

**The forked terminal renderer.** Claude Code fork Ink và viết lại pipeline rendering với packed typed arrays, pool-based interning, và cell-level diffing vì nó cần stream 60fps trong terminal. Đa số agent render lên web interface hoặc log đầu ra đơn giản. Mức đầu tư kỹ thuật đó chỉ hợp lý khi terminal rendering là UI chính và bạn stream ở tần suất cao.

**The 50+ startup profiling checkpoints.** Có ý nghĩa khi bạn có hàng trăm nghìn người dùng và lấy mẫu 0.5% vẫn cho dữ liệu có ý nghĩa thống kê. Với agent nhỏ hơn, hệ thống timing đơn giản là đủ.

**Eight MCP transport types.** Claude Code hỗ trợ stdio, SSE, HTTP, WebSocket, SDK, hai biến thể IDE, và Claude.ai proxy vì nó phải tích hợp với mọi topology triển khai. Đa số agent chỉ cần stdio và HTTP.

**The hooks snapshot security model.** Đóng băng cấu hình hook lúc startup và không ngầm đọc lại là cách phòng thủ trước một mối đe dọa cụ thể: mã độc trong repository sửa hook sau khi người dùng đã chấp nhận trust dialog. Điều này quan trọng khi agent chạy trong repository bất kỳ với cấu hình `.claude/` không đáng tin. Agent chỉ chạy trong môi trường tin cậy có thể dùng quản lý hook đơn giản hơn.

---

## The Cost of Complexity (Cái giá của độ phức tạp)

Gần hai nghìn file. Đổi lại được gì, và tốn gì?

Số lượng file gây hiểu lầm nếu dùng làm thước đo độ phức tạp. Phần lớn là hạ tầng test, type definition, schema cấu hình, và bộ renderer Ink đã fork. Độ phức tạp hành vi thực sự tập trung ở một số ít file mật độ cao: `query.ts` (1.700 dòng, agent loop), `hooks.ts` (4.900 dòng, hệ thống chặn lifecycle), `REPL.tsx` (5.000 dòng, bộ điều phối tương tác), và các hàm dựng prompt của hệ thống memory.

Độ phức tạp đến từ ba nguồn, mỗi nguồn có tính chất khác nhau:

**Protocol diversity.** Hỗ trợ năm protocol bàn phím terminal, tám loại MCP transport, bốn topology thực thi từ xa, và bảy phạm vi cấu hình vốn đã phức tạp. Mỗi protocol bổ sung là một phần tăng tuyến tính vào codebase, không phải tăng theo hàm mũ -- nhưng tổng lại rất lớn. Độ phức tạp này là accidental theo nghĩa Brooks: nó đến từ môi trường (sự phân mảnh terminal, sự tiến hóa MCP transport, topology triển khai từ xa), không phải từ bản thân bài toán.

**Performance optimization.** Pool-based rendering, bitmap search pre-filter, sticky cache latch, và speculative tool execution đều thêm độ phức tạp để đổi lấy cải thiện hiệu năng đo được. Độ phức tạp này được biện minh bằng đo đạc -- mọi tối ưu đều có dữ liệu profiling chỉ ra nút thắt trước đó. Rủi ro là tối ưu tích lũy và tương tác với nhau theo cách khiến hot path khó sửa hơn.

**Behavioral tuning.** Hướng dẫn prompt của hệ thống memory, cảnh báo staleness, verification protocol, chỉ thị chống mẫu "ignore memory" -- đây không phải độ phức tạp code. Đây là độ phức tạp prompt, và nó mang gánh nặng bảo trì kiểu khác. Khi hành vi model đổi giữa các phiên bản, các chỉ thị prompt từng được tinh chỉnh kỹ bằng eval có thể phải tinh chỉnh lại. Hạ tầng eval (được nhắc khắp codebase qua số ca và điểm eval) là hàng phòng thủ chống regression, nhưng cần đầu tư liên tục.

Gánh nặng bảo trì của hệ thống này là đáng kể. Kỹ sư mới đọc codebase không chỉ cần hiểu code path mà còn phải hiểu kết quả eval đứng sau cách đặt câu trong prompt, các production incident đứng sau những kiểm tra bảo mật cụ thể, và profile hiệu năng đứng sau tối ưu cụ thể. Comment trong code rất kỹ -- nhiều chỗ có số ca eval và đo đạc trước/sau -- nhưng comment kỹ trong gần hai nghìn file cũng tự nó là một gánh nặng đọc.

---

## Where Agentic Systems Are Heading (Hệ thống agentic đang đi về đâu)

Bốn xu hướng hiện ra từ các mẫu trong Claude Code, và chúng chỉ hướng nơi cả lĩnh vực đang tiến tới.

### MCP as the Universal Protocol (MCP như giao thức phổ quát)

Chương 15 mô tả Claude Code là một trong những MCP client đầy đủ nhất. Ý nghĩa không nằm ở triển khai của Claude Code -- mà ở việc MCP tồn tại. Một protocol chuẩn hóa cho khám phá và gọi tool có nghĩa là tool xây cho một agent sẽ dùng được với mọi agent nói MCP. Hiệu ứng hệ sinh thái là quá rõ: một MCP server cho Postgres, khi đã xây xong, phục vụ mọi agent nói MCP. Khoản đầu tư của lập trình viên vào tích hợp tool là khoản đầu tư có thể mang đi nơi khác.

Hệ quả cho người xây agent: nếu bạn đang định nghĩa protocol tool riêng, rất có thể bạn đang chọn sai. MCP đủ tốt, đang tốt lên, và lợi thế hệ sinh thái của protocol chuẩn sẽ cộng dồn theo thời gian. Hãy xây MCP client, đóng góp vào spec, và để protocol tiến hóa qua phản hồi cộng đồng.

### Multi-Agent Coordination (Điều phối đa agent)

Hệ thống sub-agent của Claude Code (Chương 8), điều phối task (Chương 10), và cơ chế fork (Chương 9) là các triển khai sớm của mẫu đa agent. Chúng giải quyết các vấn đề cụ thể -- chia sẻ cache, khám phá song song, verification có cấu trúc -- nhưng cũng phơi bày thách thức cốt lõi: coordination overhead.

Mọi tin nhắn giữa các agent đều tốn token. Mọi fork chia sẻ cache nhưng thêm một nhánh hội thoại mà parent cuối cùng phải hòa giải. State machine của hệ thống Task (queued, running, completed, failed, cancelled) là bộ máy điều phối làm tăng độ phức tạp mà không tăng năng lực. Khi agent ngày càng giỏi hơn, áp lực sẽ chuyển từ "điều phối nhiều agent thế nào?" sang "làm sao một agent đủ giỏi để không cần điều phối?"

Bằng chứng hiện tại cho thấy hai hướng sẽ cùng tồn tại. Tác vụ đơn giản dùng một agent. Tác vụ phức tạp dùng hệ thống đa agent có điều phối. Thách thức kỹ thuật là làm coordination overhead đủ thấp để điểm giao cắt nghiêng về đa agent cho công việc thật sự song song, chứ không chỉ cho công việc phức tạp.

### Persistent Memory (Memory bền vững)

Hệ thống memory của Claude Code là phiên bản 1 của memory bền vững cho agent. Thiết kế dựa trên file, four-type taxonomy, recall bằng LLM, hệ thống staleness, và chế độ KAIROS cho phiên chạy dài đều là giải pháp thế hệ đầu cho một bài toán sẽ còn tiến hóa mạnh.

Hệ thống memory tương lai có thể thêm truy xuất có cấu trúc (hệ thống hiện tại lấy cả file; hệ thống tương lai có thể lấy sự kiện cụ thể), cross-project transfer learning (ưu tiên người dùng áp dụng ở mọi nơi, quy ước project thì không), và collaborative memory (team memory ở Chương 11 là bước đầu, nhưng đồng bộ, giải quyết xung đột, và kiểm soát truy cập vẫn tối thiểu).

Câu hỏi mở là cách tiếp cận dựa trên file có scale được không. Ở mức 200 memory mỗi project, nó hoạt động. Ở mức 2.000 memory mỗi project, manifest của side-query Sonnet quá lớn, consolidate quá đắt, và index vượt trần. Cược kiến trúc files-over-databases sẽ gặp bài kiểm tra khó nhất khi mức sử dụng tăng.

### Autonomous Operation (Vận hành tự chủ)

Chế độ KAIROS, agent trích xuất memory chạy nền, auto-dream consolidation, speculative tool execution -- tất cả đều là bước tiến về vận hành tự chủ. Agent làm việc hữu ích mà không cần được yêu cầu: nó nhớ những gì bạn quên dặn nó nhớ, tự consolidate tri thức khi bạn ngủ, bắt đầu chạy tool tiếp theo trước khi phản hồi hiện tại hoàn tất.

Quỹ đạo đã rõ. Agent tương lai sẽ bớt phản ứng và chủ động hơn. Chúng sẽ nhận ra mẫu mà người dùng chưa mô tả, gợi ý sửa mà người dùng chưa yêu cầu, và tự duy trì tri thức mà không cần lệnh `/remember` tường minh. Hệ thống memory của Claude Code, với lưới an toàn trích xuất nền và các heuristic "lưu gì" được prompt-engineer, là bản mẫu cho tương lai đó.

Ràng buộc là niềm tin. Vận hành tự chủ đòi hỏi người dùng tin rằng agent sẽ làm đúng khi không có giám sát. Memory dựa trên file, hệ thống hook có thể quan sát, cảnh báo staleness, hộp thoại quyền truy cập -- tất cả tồn tại vì niềm tin phải được gây dựng, không thể mặc định. Con đường đến agent tự chủ hơn đi qua agent minh bạch hơn.

---

## Closing (Kết)

Mười bảy chương. Sáu trừu tượng cốt lõi. Một generator loop ở trung tâm, tool mở rộng ra ngoài, memory vươn ngược về quá khứ, hook canh giữ vành đai, một engine rendering chuyển tất cả thành ký tự trên màn hình, và MCP nối nó với thế giới ngoài codebase.

Mẫu sâu nhất trong Claude Code không phải một kỹ thuật riêng lẻ. Nó là quyết định lặp đi lặp lại: đẩy độ phức tạp ra rìa biên. Hệ thống rendering đẩy độ phức tạp vào pool và diff -- bên trong pipeline, mọi thứ chỉ là so sánh số nguyên. Hệ thống input đẩy độ phức tạp vào tokenizer và keybinding resolver -- bên trong handler, mọi thứ là action có kiểu. Hệ thống memory đẩy độ phức tạp vào write protocol và recall selector -- bên trong hội thoại, mọi thứ là context. Agent loop đẩy độ phức tạp vào terminal state và tool system -- bên trong loop, chỉ còn: stream, collect, execute, append, repeat.

Mỗi biên hấp thụ hỗn loạn và xuất ra trật tự. Raw byte trở thành `ParsedKey`. File Markdown trở thành memory được gọi lại. MCP JSON-RPC trở thành `Tool` object. Hook exit code trở thành quyết định quyền truy cập. Một phía của mỗi biên, thế giới lộn xộn -- năm protocol bàn phím, OAuth server mong manh, memory stale, hook repository không đáng tin. Phía còn lại, thế giới có kiểu, có ranh giới, và được xử lý đầy đủ mọi nhánh.

Nếu bạn đang xây một hệ thống agentic, đây là bài học chuyển giao được. Không phải kỹ thuật cụ thể -- bạn có thể không cần pool-based rendering hay chế độ KAIROS hay tám loại MCP transport. Mà là nguyên lý: định nghĩa các boundary, hấp thụ độ phức tạp ở đó, và giữ phần giữa chúng sạch sẽ. Boundary là nơi kỹ thuật khó. Nội thất là nơi kỹ thuật dễ chịu. Hãy thiết kế để phần nội thất dễ chịu, và đầu tư ngân sách độ phức tạp của bạn ở các cạnh biên.

Mã nguồn là mở. Con cua đã giữ tấm bản đồ trong càng. Hãy đi đọc nó.