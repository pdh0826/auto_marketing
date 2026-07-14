import { TistoryAutomationClient } from "./tistory-automation-client";

export default function Page() {
  return (
    <main className="page">
      <nav className="nav">
        <a href="/">대시보드</a>
        <a href="/automation/daily-brief">Blogger 스케줄</a>
        <a href="/automation/tistory">Tistory 스케줄</a>
      </nav>
      <TistoryAutomationClient />
    </main>
  );
}
