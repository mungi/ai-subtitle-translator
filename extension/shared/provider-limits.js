// Classify limits using explicit evidence; HTTP 429 alone does not prove quota exhaustion.
export function classifyProviderLimit(error) {
  const message = String(error?.message || error || "").toLowerCase();
  const type = String(error?.providerErrorType || "").toLowerCase();
  const code = String(error?.providerErrorCode || "").toLowerCase();
  const details = error?.providerErrorDetails || [];
  const quotaIds = details.flatMap((detail) => detail.violations || [])
    .map((violation) => `${violation.quotaId || ""} ${violation.quotaMetric || ""}`).join(" ").toLowerCase();
  if (Number(error?.status) === 456 || type === "insufficient_quota" || code === "insufficient_quota"
    || /per.?day|daily|requestsperday/.test(quotaIds)
    || /daily (?:quota|limit)|(?:quota|limit)[^\n.]*per day|requests per day[^\n.]*exceeded|credit balance[^\n.]*too low|insufficient (?:credits|balance)|billing (?:hard )?limit|일일[^\n.]*한도/.test(message)) {
    return "quota_exceeded";
  }
  // Set by the LLM request controller once overload responses have been confirmed.
  if (error?.serverBusy) return "server_busy";
  if (Number(error?.status) !== 429) return null;
  if (/per.?minute|per.?second/.test(quotaIds)
    || /rate.?limit|too many requests|per minute|per second|\brpm\b|\btpm\b/.test(message)
    || type === "rate_limit_error" || code === "rate_limit_exceeded") return "rate_limit_exceeded";
  return "request_restricted";
}

export function providerRetryDelay(error) {
  const delays = [error?.retryAfterMs];
  for (const detail of error?.providerErrorDetails || []) {
    const match = /^(\d+(?:\.\d+)?)s$/.exec(String(detail.retryDelay || ""));
    if (match) delays.push(Number(match[1]) * 1000);
  }
  const valid = delays.filter((delay) => Number.isFinite(delay) && delay >= 0);
  return valid.length ? Math.max(...valid) : undefined;
}
