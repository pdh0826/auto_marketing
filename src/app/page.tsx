const links = [
  ["간편 자동화", "/auto"],
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
          <a className="button" href="/auto">간편 자동화 시작</a>
          <a className="button secondary" href="/settings/blogger">Blogger 설정</a>
        </div>
      </section>

      <section className="card-grid" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>1. 간편 자동화</h2>
          <p className="muted">키워드와 제목만 넣고 새 SEO 글 1개를 준비합니다.</p>
        </div>
        <div className="card">
          <h2>2. 설정 분리</h2>
          <p className="muted">Blogger, LLM, Blog, Brand 설정은 별도 화면에서 한 번 관리합니다.</p>
        </div>
        <div className="card">
          <h2>3. 발행 준비</h2>
          <p className="muted">생성된 글 상세에서 approval, preflight, draft save를 순서대로 진행합니다.</p>
        </div>
      </section>
    </main>
  );
}
