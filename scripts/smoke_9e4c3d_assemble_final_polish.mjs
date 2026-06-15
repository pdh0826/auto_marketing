#!/usr/bin/env node

const args = process.argv.slice(2);
const baseUrl = getArgValue("--base-url") ?? "http://127.0.0.1:3000";
const contentItemId = getArgValue("--content-item-id");
const runId = getArgValue("--run-id");
const shouldRunFinalPolish = args.includes("--final-polish");
const force = args.includes("--force");

if (!contentItemId || !runId) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        error: "missing_required_args",
        usage:
          "node scripts/smoke_9e4c3d_assemble_final_polish.mjs --base-url http://127.0.0.1:3000 --content-item-id <id> --run-id <runId> [--final-polish] [--force]"
      },
      null,
      2
    )
  );
  process.exit(1);
}

try {
  const runBefore = await getRun();
  const assemble = await postJson(`/api/content-items/${contentItemId}/draft-generation-runs/${runId}/assemble`, force ? { force: true } : {});
  const result = {
    ok: Boolean(assemble.ok),
    contentItemId,
    runId,
    runBefore: summarizeRun(runBefore.body?.data?.run),
    assemble: {
      ok: assemble.ok,
      status: assemble.status,
      error: assemble.body?.error ?? null,
      message: assemble.body?.message ?? null,
      executed: assemble.body?.data?.executed ?? null,
      reusedExistingAssembled: assemble.body?.data?.reusedExistingAssembled ?? null,
      assembledLength: getStringLength(assemble.body?.data?.assembledCandidateMarkdown),
      validationSummary: summarizeValidation(assemble.body?.data?.validationSummary)
    },
    finalPolish: null,
    contentItemAutoApply: false,
    bloggerApiImplemented: false
  };

  if (assemble.ok && shouldRunFinalPolish) {
    const finalPolish = await postJson(`/api/content-items/${contentItemId}/draft-generation-runs/${runId}/final-polish`, force ? { force: true } : {});
    result.ok = result.ok && finalPolish.ok;
    result.finalPolish = {
      ok: finalPolish.ok,
      status: finalPolish.status,
      error: finalPolish.body?.error ?? null,
      message: finalPolish.body?.message ?? null,
      executed: finalPolish.body?.data?.executed ?? null,
      reusedExistingFinal: finalPolish.body?.data?.reusedExistingFinal ?? null,
      finalLength: getStringLength(finalPolish.body?.data?.finalCandidateMarkdown),
      validationSummary: summarizeValidation(finalPolish.body?.data?.validationSummary)
    };
  }

  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
} catch (error) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        error: "smoke_9e4c3d_failed",
        message: error instanceof Error ? error.message : "unknown_error"
      },
      null,
      2
    )
  );
  process.exitCode = 1;
}

async function getRun() {
  return fetchJson(`/api/content-items/${contentItemId}/draft-generation-runs/${runId}`, { method: "GET" });
}

async function postJson(path, body) {
  return fetchJson(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function fetchJson(path, init) {
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}${path}`, init);
  const text = await response.text();
  let body = null;
  if (text.trim()) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: "non_json_response" };
    }
  }
  return {
    ok: response.ok,
    status: response.status,
    body
  };
}

function summarizeRun(run) {
  if (!run) {
    return null;
  }
  return {
    id: run.id,
    status: run.status,
    currentStepKey: run.currentStepKey,
    hasAssembledCandidateMarkdown: Boolean(run.hasAssembledCandidateMarkdown || run.assembledCandidateMarkdown),
    hasFinalCandidateMarkdown: Boolean(run.hasFinalCandidateMarkdown || run.finalCandidateMarkdown),
    stepCount: run.stepCount,
    successfulStepKeys: Array.isArray(run.steps) ? run.steps.filter((step) => step.status === "success").map((step) => step.stepKey) : []
  };
}

function summarizeValidation(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  return {
    phase: value.phase,
    ok: value.ok,
    errorCount: value.errorCount,
    warningCount: value.warningCount,
    markdownLength: value.markdownLength,
    guardSummary: value.guardSummary
  };
}

function getStringLength(value) {
  return typeof value === "string" ? value.length : null;
}

function getArgValue(name) {
  const index = args.indexOf(name);
  if (index < 0) {
    return null;
  }
  return args[index + 1] ?? null;
}
