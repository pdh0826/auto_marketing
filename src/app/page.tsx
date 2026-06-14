const links = [
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
        <span className="badge">Bootstrap 1a</span>
        <h1>Blog Growth Agent</h1>
        <p className="muted">
          Google Blogger 기반 콘텐츠 기획, 작성, 품질검사, 초안 저장, 예약 발행 플랫폼의 초기 뼈대입니다.
        </p>
      </section>

      <section className="card-grid" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>1. LLM Provider</h2>
          <p className="muted">OpenAI API와 로컬 LLM을 작업별로 선택할 수 있는 구조를 우선 구현합니다.</p>
        </div>
        <div className="card">
          <h2>2. Blogger 연결</h2>
          <p className="muted">테스트 블로그 OAuth 연결 후 초안 저장과 예약 발행을 단계적으로 붙입니다.</p>
        </div>
        <div className="card">
          <h2>3. 품질 게이트</h2>
          <p className="muted">금지표현, 투자 위험 표현, 과도한 CTA를 검사한 뒤 발행 가능하게 만듭니다.</p>
        </div>
      </section>
    </main>
  );
}
