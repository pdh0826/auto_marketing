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
        <h1>블로그 프로필</h1>
        <p className="muted">Blogger 블로그 연결과 블로그별 주제, 문체, 발행정책을 관리할 화면입니다.</p>
      </section>
    </main>
  );
}
