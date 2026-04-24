export interface PartConfig {
  number: number;
  title: string;
  epigraph: string;
  chapters: number[];
}

export interface ChapterConfig {
  number: number;
  slug: string;
  title: string;
  description: string;
}

export const partsEn: PartConfig[] = [
  {
    number: 1,
    title: 'Foundations',
    epigraph: 'Before the agent can think, the process must exist.',
    chapters: [1, 2, 3, 4],
  },
  {
    number: 2,
    title: 'The Core Loop',
    epigraph: 'The heartbeat of the agent: stream, act, observe, repeat.',
    chapters: [5, 6, 7],
  },
  {
    number: 3,
    title: 'Multi-Agent Orchestration',
    epigraph: 'One agent is powerful. Many agents working together are transformative.',
    chapters: [8, 9, 10],
  },
  {
    number: 4,
    title: 'Persistence and Intelligence',
    epigraph: 'An agent without memory makes the same mistakes forever.',
    chapters: [11, 12],
  },
  {
    number: 5,
    title: 'The Interface',
    epigraph: 'Everything the user sees passes through this layer.',
    chapters: [13, 14],
  },
  {
    number: 6,
    title: 'Connectivity',
    epigraph: 'The agent reaches beyond localhost.',
    chapters: [15, 16],
  },
  {
    number: 7,
    title: 'Performance Engineering',
    epigraph: 'Making it all fast enough that humans don\'t notice the machinery.',
    chapters: [17, 18],
  },
];

export const parts: PartConfig[] = [
  {
    number: 1,
    title: 'Nền tảng',
    epigraph: 'Trước khi tác nhân có thể suy nghĩ, quá trình này phải tồn tại.',
    chapters: [1, 2, 3, 4],
  },
  {
    number: 2,
    title: 'Vòng lặp Cốt lõi',
    epigraph: 'Nhịp đập của tác nhân: phát trực tuyến, hành động, quan sát, lặp lại.',
    chapters: [5, 6, 7],
  },
  {
    number: 3,
    title: 'Điều phối đa tác nhân',
    epigraph: 'Một tác nhân thì mạnh mẽ. Nhiều tác nhân cùng làm việc thì tạo ra sự thay đổi lớn.',
    chapters: [8, 9, 10],
  },
  {
    number: 4,
    title: 'Sự nhất quán và Trí thông minh',
    epigraph: 'Một tác nhân không có bộ nhớ sẽ mãi mắc cùng một lỗi.',
    chapters: [11, 12],
  },
  {
    number: 5,
    title: 'Giao diện',
    epigraph: 'Mọi thứ người dùng nhìn thấy đều đi qua lớp này.',
    chapters: [13, 14],
  },
  {
    number: 6,
    title: 'Khả năng kết nối',
    epigraph: 'Tác nhân vươn ra khỏi localhost.',
    chapters: [15, 16],
  },
  {
    number: 7,
    title: 'Kỹ thuật Hiệu suất',
    epigraph: 'Làm cho mọi thứ nhanh tới mức con người không nhận ra hệ thống máy móc ở dưới.',
    chapters: [17, 18],
  },
];

export const chaptersEn: ChapterConfig[] = [
  { number: 1, slug: 'ch01-architecture', title: 'The Architecture of an AI Agent', description: 'The 6 key abstractions, data flow, permission system, build system' },
  { number: 2, slug: 'ch02-bootstrap', title: 'Starting Fast — The Bootstrap Pipeline', description: '5-phase init, module-level I/O parallelism, trust boundary' },
  { number: 3, slug: 'ch03-state', title: 'State — The Two-Tier Architecture', description: 'Bootstrap singleton, AppState store, sticky latches, cost tracking' },
  { number: 4, slug: 'ch04-api-layer', title: 'Talking to Claude — The API Layer', description: 'Multi-provider client, prompt cache, streaming, error recovery' },
  { number: 5, slug: 'ch05-agent-loop', title: 'The Agent Loop', description: 'query.ts deep dive, 4-layer compression, error recovery, token budgets' },
  { number: 6, slug: 'ch06-tools', title: 'Tools — From Definition to Execution', description: 'Tool interface, 14-step pipeline, permission system' },
  { number: 7, slug: 'ch07-concurrency', title: 'Concurrent Tool Execution', description: 'Partition algorithm, streaming executor, speculative execution' },
  { number: 8, slug: 'ch08-sub-agents', title: 'Spawning Sub-Agents', description: 'AgentTool, 15-step runAgent lifecycle, built-in agent types' },
  { number: 9, slug: 'ch09-fork-agents', title: 'Fork Agents and the Prompt Cache', description: 'Byte-identical prefix trick, cache sharing, cost optimization' },
  { number: 10, slug: 'ch10-coordination', title: 'Tasks, Coordination, and Swarms', description: 'Task state machine, coordinator mode, swarm messaging' },
  { number: 11, slug: 'ch11-memory', title: 'Memory — Learning Across Conversations', description: 'File-based memory, 4-type taxonomy, LLM recall, staleness' },
  { number: 12, slug: 'ch12-extensibility', title: 'Extensibility — Skills and Hooks', description: 'Two-phase skill loading, lifecycle hooks, snapshot security' },
  { number: 13, slug: 'ch13-terminal-ui', title: 'The Terminal UI', description: 'Custom Ink fork, rendering pipeline, double-buffer, pools' },
  { number: 14, slug: 'ch14-input-interaction', title: 'Input and Interaction', description: 'Key parsing, keybindings, chord support, vim mode' },
  { number: 15, slug: 'ch15-mcp', title: 'MCP — The Universal Tool Protocol', description: '8 transports, OAuth for MCP, tool wrapping' },
  { number: 16, slug: 'ch16-remote', title: 'Remote Control and Cloud Execution', description: 'Bridge v1/v2, CCR, upstream proxy' },
  { number: 17, slug: 'ch17-performance', title: 'Performance — Every Millisecond and Token Counts', description: 'Startup, context window, prompt cache, rendering, search' },
  { number: 18, slug: 'ch18-epilogue', title: 'Epilogue — What We Learned', description: 'The 5 architectural bets, what transfers, where agents are heading' },
];

export const chapters: ChapterConfig[] = [
  { number: 1, slug: 'ch01-architecture', title: 'Kiến trúc của AI Agent', description: '6 phần tử trừu tượng cốt lõi, luồng dữ liệu, hệ thống phân quyền, hệ thống build' },
  { number: 2, slug: 'ch02-bootstrap', title: 'Khởi đầu Nhanh — The Bootstrap Pipeline', description: 'Khởi tạo 5 giai đoạn, I/O song song ở mức module, ranh giới độ tin cậy' },
  { number: 3, slug: 'ch03-state', title: 'Trạng thái — The Two-Tier Architecture', description: 'Bootstrap singleton, AppState store, sticky latches, theo dõi chi phí' },
  { number: 4, slug: 'ch04-api-layer', title: 'Giao tiếp cùng Claude — The API Layer', description: 'Proxy đa nhà cung cấp, prompt cache, phát trực tuyến, phục hồi lỗi' },
  { number: 5, slug: 'ch05-agent-loop', title: 'Agent Loop', description: 'Phân tích tự động query.ts, nén 4 lớp, phục hồi lỗi, định mức token' },
  { number: 6, slug: 'ch06-tools', title: 'Công cụ — Từ Định nghĩa đến Thực thi', description: 'Giao diện công cụ, đường ống 14 bước, hệ thống phân quyền' },
  { number: 7, slug: 'ch07-concurrency', title: 'Thực thi Công cụ Đồng thời', description: 'Thuật toán chia mảng, streaming executor, speculative execution' },
  { number: 8, slug: 'ch08-sub-agents', title: 'Khởi tạo Sub-Agents', description: 'AgentTool, vòng đời 15 bước runAgent, các loại tác nhân tích hợp' },
  { number: 9, slug: 'ch09-fork-agents', title: 'Fork Agents và Prompt Cache', description: 'Kỹ thuật byte-identical prefix, chia sẻ bộ nhớ cache, tối ưu chi phí' },
  { number: 10, slug: 'ch10-coordination', title: 'Tác vụ, Điều phối và Swarms', description: 'Cỗ máy trạng thái tác vụ, coordinator mode, nhắn tin swarm' },
  { number: 11, slug: 'ch11-memory', title: 'Bộ nhớ — Học hỏi qua Các Bình luận', description: 'Bộ nhớ trên tệp, phân loại 4 chuẩn, LLM recall, cảnh báo trễ tệp' },
  { number: 12, slug: 'ch12-extensibility', title: 'Khả năng Mở rộng — Kỹ năng và Hooks', description: 'Tải công cụ hai giai đoạn, lifecycle hooks, snapshot security' },
  { number: 13, slug: 'ch13-terminal-ui', title: 'Terminal UI', description: 'Fork tùy chỉnh từ biến Ink, tính toán render, bộ đệm kép, các pools phân tán' },
  { number: 14, slug: 'ch14-input-interaction', title: 'Đầu vào và Tương tác', description: 'Phân loại thao tác phím, keybindings, chuẩn ngõ chép chord, chế độ vim' },
  { number: 15, slug: 'ch15-mcp', title: 'MCP — Giao thức Truyền vận Phổ quát', description: 'Truyền vận 8 mô hình, OAuth dành cho MCP, quá trình bọc các lệnh công cụ' },
  { number: 16, slug: 'ch16-remote', title: 'Điều khiển Từ xa và Vân hành Cụm mây (Cloud)', description: 'Bridge thuật v1/v2, CCR, proxy upstream hệ thống gốc' },
  { number: 17, slug: 'ch17-performance', title: 'Hiệu suất — Mỗi Mili-giây và Token', description: 'Nhịp khởi động, khoang ngữ cảnh nội bộ, prompt cache, kỹ thuật hiển thị render' },
  { number: 18, slug: 'ch18-epilogue', title: 'Đoạn Kết — Những Bài học Đáng Giá', description: '5 chuẩn dự án mang tính kiến trúc lớn nhất, thứ truyền vào, chuẩn hướng sắp tới' },
];

export function getParts(lang: string = 'vi'): PartConfig[] {
  return lang === 'en' ? partsEn : parts;
}

export function getChapters(lang: string = 'vi'): ChapterConfig[] {
  return lang === 'en' ? chaptersEn : chapters;
}

export function getPartForChapter(chapterNumber: number, lang: string = 'vi'): PartConfig | undefined {
  return getParts(lang).find(p => p.chapters.includes(chapterNumber));
}

export function getChapterNumber(slug: string): number {
  const match = slug.match(/^ch(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export function getAdjacentChapters(chapterNumber: number, lang: string = 'vi') {
  const chs = getChapters(lang);
  const idx = chs.findIndex(c => c.number === chapterNumber);
  return {
    prev: idx > 0 ? chs[idx - 1] : null,
    next: idx < chs.length - 1 ? chs[idx + 1] : null,
  };
}

export function isFirstChapterOfPart(chapterNumber: number, lang: string = 'vi'): boolean {
  return getParts(lang).some(p => p.chapters[0] === chapterNumber);
}

