const links = [
  ["간편 자동화", "/auto"],
  ["새 글 마법사", "/wizard/new"],
  ["블로그", "/blogs"],
  ["서비스 프로필", "/brands"],
  ["글 생성", "/content/new"],
  ["LLM 설정", "/settings/llm"],
  ["Blogger 설정", "/settings/blogger"]
];

export default function DashboardPage() {
  return (
    <main className="page">
      <nav className="nav">
        {links.map(([label, href]) => (
          <a key={href} href={href}>{label}</a>
        ))}
      </nav>

      <section className="card">
        <span className="badge">Simple workflow</span>
        <h1>Blog Growth Agent</h1>
        <p className="muted">
          새 글 준비는 간편 자동화 화면에서 시작하고, OAuth/LLM/Blog/Brand 설정은 별도 화면에서 관리합니다.
        </p>
        <div className="button-row">
          <a className="button" href="/wizard/new">새 글 마법사 시작</a>
          <a className="button secondary" href="/auto">간편 자동화</a>
          <a className="button secondary" href="/settings/blogger">Blogger 설정</a>
        </div>
      </section>

      <section className="card-grid" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>1. 새 글 마법사</h2>
          <p className="muted">글 형태, 주제, 자료, 구성을 다음 버튼으로 확인하며 준비합니다.</p>
        </div>
        <div className="card">
          <h2>2. 설정 분리</h2>
          <p className="muted">Blogger, LLM, Blog, Brand 설정은 별도 화면에서 한 번 관리합니다.</p>
        </div>
        <div className="card">
          <h2>3. 수정/발행 준비</h2>
          <p className="muted">수정 마법사와 발행 준비 마법사에서 필요한 승인 단계만 진행합니다.</p>
        </div>
      </section>
    </main>
  );
}
