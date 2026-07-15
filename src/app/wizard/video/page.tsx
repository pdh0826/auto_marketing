import { VideoSourceWizardClient } from "./video-source-wizard-client";

export default function Page() {
  return (
    <main className="page">
      <nav className="nav">
        <a href="/">대시보드</a>
        <a href="/auto">간편 자동화</a>
        <a href="/wizard/new">새 글 마법사</a>
        <a href="/wizard/daily-brief">Daily Brief</a>
        <a href="/wizard/video">영상 소스</a>
        <a href="/content/new">상세 관리</a>
      </nav>
      <VideoSourceWizardClient />
    </main>
  );
}
