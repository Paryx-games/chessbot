const COMMENT_MARK = '<!-- chessbot-check-results -->';
const OK = new Set(['success', 'skipped', 'neutral']);

function safeText(value) {
  return String(value).replace(/[\r\n]/g, ' ').slice(0, 240)
    .replace(/[&<>"'`*_[\]\\()@]/g, char => `&#${char.codePointAt(0)};`);
}

function identify(body = '') {
  if (!body.startsWith(COMMENT_MARK)) return null;
  const match = body.match(/<!-- build (\d+) attempt (\d+) -->/);
  if (!match) return null;
  const run = Number(match[1]), attempt = Number(match[2]);
  return Number.isSafeInteger(run) && Number.isSafeInteger(attempt) ? { run, attempt } : null;
}

function describe(run, jobs, repository, server = 'https://github.com') {
  if (!/^https:\/\/[\w.-]+(?::\d+)?$/.test(server)) throw new Error('Invalid GitHub server URL');
  const link = `${server}/${repository}/actions/runs/${run.id}`;
  const failed = jobs.filter(job => job.conclusion && !OK.has(job.conclusion));
  const lines = [COMMENT_MARK, `<!-- build ${run.id} attempt ${run.run_attempt} -->`];
  if (run.conclusion === 'success') {
    lines.push('<details>', '<summary>Board Editor CI passed</summary>', '', 'All required checks passed.', '', '</details>');
  } else {
    lines.push('### Board Editor CI needs attention', '');
    const visible = failed.filter(job => job.name !== 'CI passed');
    for (const job of visible.length ? visible : failed) {
      const steps = (job.steps ?? []).filter(step => step.conclusion && !OK.has(step.conclusion));
      lines.push(`- **${safeText(job.name)}**: ${safeText(job.conclusion)}${steps.length ? ' — ' + steps.map(step => safeText(step.name)).join(', ') : ''}`);
    }
    if (!failed.length) lines.push(`Workflow result: ${safeText(run.conclusion ?? 'unknown')}. See the run for diagnostics.`);
  }
  lines.push('', `[View CI results](${link})`);
  return lines.join('\n');
}

async function report({ github, context, core }) {
  const repo = context.repo;
  const { data: run } = await github.rest.actions.getWorkflowRun({ ...repo, run_id: context.payload.workflow_run.id });
  if (run.status !== 'completed' || run.event !== 'pull_request' || run.path !== '.github/workflows/ci.yml' || !run.head_repository) return;
  if (run.run_attempt !== context.payload.workflow_run.run_attempt) return;
  const candidates = run.pull_requests?.length ? run.pull_requests
    : await github.paginate(github.rest.repos.listPullRequestsAssociatedWithCommit, { ...repo, commit_sha: run.head_sha, per_page: 100 });
  const matches = pull => pull.state === 'open' && pull.head.sha === run.head_sha
    && pull.head.repo?.full_name === run.head_repository.full_name
    && pull.base.repo.full_name === `${repo.owner}/${repo.repo}`;
  let pull;
  for (const candidate of candidates) {
    const response = await github.rest.pulls.get({ ...repo, pull_number: candidate.number });
    if (matches(response.data)) { pull = response.data; break; }
  }
  if (!pull) return;
  const newerRuns = await github.paginate(github.rest.actions.listWorkflowRuns, {
    ...repo, workflow_id: 'ci.yml', event: 'pull_request', head_sha: run.head_sha, per_page: 100,
  });
  if (newerRuns.some(other => other.id > run.id && other.head_repository?.full_name === run.head_repository.full_name && other.head_branch === run.head_branch)) return;
  const comments = await github.paginate(github.rest.issues.listComments, { ...repo, issue_number: pull.number, per_page: 100 });
  const owned = comments.filter(comment => comment.user?.type === 'Bot' && comment.user.login === 'github-actions[bot]' && identify(comment.body));
  if (owned.some(comment => {
    const previous = identify(comment.body);
    return previous.run > run.id || (previous.run === run.id && previous.attempt > run.run_attempt);
  })) return;
  const comment = owned.sort((a, b) => b.id - a.id)[0];
  // A successful first run needs no comment; recovery updates the existing report.
  if (!comment && run.conclusion === 'success') return;
  const jobs = await github.paginate(github.rest.actions.listJobsForWorkflowRun, { ...repo, run_id: run.id, filter: 'latest', per_page: 100 });
  const body = describe(run, jobs, `${repo.owner}/${repo.repo}`, context.serverUrl);
  const { data: currentPull } = await github.rest.pulls.get({ ...repo, pull_number: pull.number });
  const { data: currentRun } = await github.rest.actions.getWorkflowRun({ ...repo, run_id: run.id });
  if (!matches(currentPull) || currentRun.run_attempt !== run.run_attempt) return;
  if (!comment) await github.rest.issues.createComment({ ...repo, issue_number: pull.number, body });
  else if (comment.body !== body) await github.rest.issues.updateComment({ ...repo, comment_id: comment.id, body });
  core.info('Board Editor check report updated.');
}

module.exports = { safeText, identify, describe, report };
