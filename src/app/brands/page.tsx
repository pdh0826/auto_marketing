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
        <h1>서비스/브랜드 프로필</h1>
        <p className="muted">급등포착 같은 자체 서비스를 문제 해결형 콘텐츠 안에 자연스럽게 연결하기 위한 프로필 관리 화면입니다.</p>
      </section>
    </main>
  );
}
