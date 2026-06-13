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
      <section className="card">
        <span className="badge">MVP placeholder</span>
        <h1>글 생성</h1>
        <p className="muted">키워드, 주제, 메모, 기존 글, 서비스 설명을 입력해 글 기획서와 본문을 생성할 화면입니다.</p>
      </section>
    </main>
  );
}
