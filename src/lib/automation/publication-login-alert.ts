import { mkdir, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface PublicationLoginAlertInput {
  channel: "blogger" | "tistory";
  marketDate: string;
  slotId: string;
  scheduledTime: string;
  label: string;
  blocker: string;
}

export interface PublicationRecoveryAlertInput {
  channel: "blogger" | "tistory";
  marketDate: string;
  slotId: string;
  scheduledTime: string;
  label: string;
  reason: string;
  attempts: number;
}

const BLOGGER_LOGIN_BLOCKERS = [
  "access_token_expired_reauth_required",
  "access_token_refresh_blocked",
  "blogger_token_refresh_blocked",
  "manual_oauth_reconnect_required",
  "oauth_required",
  "refresh_token_missing",
  "token_refresh_invalid_grant_reconnect_required",
  "token_refresh_unauthorized_client"
];

export function findBloggerLoginBlocker(input: {
  stage?: string | null;
  message?: string | null;
  blockingReasons?: string[];
}) {
  const values = [input.stage, input.message, ...(input.blockingReasons ?? [])].filter((value): value is string => Boolean(value));
  return values.find((value) => BLOGGER_LOGIN_BLOCKERS.some((code) => value.includes(code))) ?? null;
}

export async function enqueuePublicationLoginAlert(input: PublicationLoginAlertInput) {
  const queueDirectory = process.env.PDASH_TELEGRAM_QUEUE_DIR?.trim() || path.join(os.homedir(), "msg");
  const baseName = `blog-growth-agent-login-${input.marketDate}-${input.slotId}`;
  const tempPath = path.join(queueDirectory, `${baseName}.tmp`);
  const finalPath = path.join(queueDirectory, `${baseName}.json`);
  const blogger = input.channel === "blogger";
  const payload = {
    template: "status",
    severity: "error",
    title: `[Blog Growth Agent] ${input.scheduledTime} ${blogger ? "Blogger" : "Tistory"} 로그인 필요`,
    service: "Blog Growth Agent",
    environment: "local",
    summary: `${input.label} 예약 발행이 ${blogger ? "Google OAuth" : "Tistory 로그인"} 문제로 완료되지 않았습니다.`,
    fields: {
      "대상 날짜": input.marketDate,
      채널: input.channel,
      "예약 시각": input.scheduledTime,
      원인: input.blocker,
      결과: "FAIL",
      "다음 작업": blogger
        ? "Blogger 설정에서 Google 계정을 다시 연결하세요."
        : "Tistory 자동화 화면에서 전용 로그인 창을 열고 로그인하세요."
    },
    buttons: blogger
      ? [
          { text: "Blogger 연결", url: "http://127.0.0.1:3004/settings/blogger" },
          { text: "자동화 상태", url: "http://127.0.0.1:3004/automation/daily-brief" }
        ]
      : [
          { text: "Tistory 로그인", url: "http://127.0.0.1:3004/automation/tistory" },
          { text: "자동화 상태", url: "http://127.0.0.1:3004/automation/daily-brief" }
        ]
  };

  await mkdir(queueDirectory, { recursive: true });
  await writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await rename(tempPath, finalPath);
  return { queued: true, fileName: `${baseName}.json` };
}

export async function enqueuePublicationRecoveryAlert(input: PublicationRecoveryAlertInput) {
  const queueDirectory = process.env.PDASH_TELEGRAM_QUEUE_DIR?.trim() || path.join(os.homedir(), "msg");
  const baseName = `blog-growth-agent-recovery-${input.marketDate}-${input.slotId}`;
  const tempPath = path.join(queueDirectory, `${baseName}.tmp`);
  const finalPath = path.join(queueDirectory, `${baseName}.json`);
  const payload = {
    template: "status",
    severity: "error",
    title: `[Blog Growth Agent] ${input.scheduledTime} 자동 복구 실패`,
    service: "Blog Growth Agent",
    environment: "local",
    summary: `${input.label} 예약 발행이 자동 점검과 재실행 후에도 완료되지 않았습니다.`,
    fields: {
      "대상 날짜": input.marketDate,
      채널: input.channel,
      "예약 시각": input.scheduledTime,
      "총 시도": `${input.attempts}회`,
      원인: input.reason,
      결과: "FAIL",
      "다음 작업": "자동화 화면에서 차단 원인과 최근 로그를 확인하세요. 성공한 슬롯은 재발행되지 않습니다."
    },
    buttons: [
      { text: "자동화 상태", url: "http://127.0.0.1:3004/automation/daily-brief" },
      { text: input.channel === "blogger" ? "Blogger 설정" : "Tistory 상태", url: input.channel === "blogger" ? "http://127.0.0.1:3004/settings/blogger" : "http://127.0.0.1:3004/automation/tistory" }
    ]
  };

  await mkdir(queueDirectory, { recursive: true });
  await writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await rename(tempPath, finalPath);
  return { queued: true, fileName: `${baseName}.json` };
}
