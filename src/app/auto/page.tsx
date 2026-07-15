import { SimpleAutomationClient } from "./simple-automation-client";

export default function Page() {
  return (
    <main className="page">
      <nav className="nav">
        <a href="/">대시보드</a>
        <a href="/auto">간편 자동화</a>
        <a href="/automation/daily-brief">Daily Brief 스케줄</a>
        <a href="/wizard/new">새 글 마법사</a>
        <a href="/wizard/daily-brief">오늘 관심종목</a>
        <a href="/wizard/video">영상 소스</a>
        <a href="/content/new">상세 글 생성</a>
        <a href="/settings/blogger">Blogger 설정</a>
        <a href="/settings/llm">LLM 설정</a>
      </nav>
      <SimpleAutomationClient />
    </main>
  );
}
