import { ContentRequestClient } from "./content-request-client";

export default function Page() {
  return (
    <main className="page">
      <nav className="nav">
        <a href="/">대시보드</a>
        <a href="/blogs">블로그</a>
        <a href="/brands">서비스 프로필</a>
        <a href="/content/new">글 생성</a>
        <a href="/settings/llm">LLM 설정</a>
      </nav>
      <ContentRequestClient />
    </main>
  );
}
