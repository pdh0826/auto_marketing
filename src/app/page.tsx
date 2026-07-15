const links = [
  ["간편 자동화", "/auto"],
  ["Daily Brief 스케줄", "/automation/daily-brief"],
  ["Tistory 스케줄", "/automation/tistory"],
  ["새 글 마법사", "/wizard/new"],
  ["오늘 관심종목", "/wizard/daily-brief"],
  ["영상 소스", "/wizard/video"],
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
          <a className="button" href="/wizard/daily-brief">오늘 관심종목 글 만들기</a>
          <a className="button secondary" href="/wizard/video">영상 소스 준비</a>
          <a className="button secondary" href="/automation/daily-brief">매일 8시 자동화</a>
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
          <h2>2. 오늘 관심종목</h2>
          <p className="muted">급등포착 시그널보드와 종목 차트 자료를 데일리 브리프 글로 준비합니다.</p>
        </div>
        <div className="card">
          <h2>3. 영상 소스 준비</h2>
          <p className="muted">직접 입력, 기존 글, Daily Brief, 사이트 recipe, URL preview를 같은 영상 파이프라인으로 확인합니다.</p>
        </div>
      </section>
    </main>
  );
}
