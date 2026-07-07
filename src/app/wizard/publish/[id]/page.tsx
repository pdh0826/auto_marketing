import { PublishReadinessWizardClient } from "./publish-readiness-wizard-client";

interface PageProps {
  params: {
    id: string;
  };
}

export default function Page({ params }: PageProps) {
  return (
    <main className="page">
      <nav className="nav">
        <a href="/">대시보드</a>
        <a href="/auto">간편 자동화</a>
        <a href="/wizard/new">새 글 마법사</a>
        <a href={`/wizard/edit/${params.id}`}>수정 마법사</a>
        <a href={`/wizard/publish/${params.id}`}>발행 준비</a>
        <a href={`/content/${params.id}`}>상세 화면</a>
      </nav>
      <PublishReadinessWizardClient contentItemId={params.id} />
    </main>
  );
}
