const { test } = require('node:test');
const assert = require('node:assert/strict');
const { plan, select } = require('./ci-plan.cjs');
const { failures } = require('./ci-gate.cjs');
const { identify, describe, report } = require('./ci-report.cjs');
const everything = { frontend: true, frontendBuild: true, rust: true, build: true };
const nothing = Object.fromEntries(Object.keys(everything).map(key => [key, false]));

test('Chessbot inputs select the appropriate checks', () => {
  assert.deepEqual(plan(['README.md', '.github/FUNDING.yml']), nothing);
  assert.deepEqual(plan(['frontend/style.css']), { ...everything, rust: false });
  assert.deepEqual(plan(['frontend\\app.js']), { ...everything, rust: false });
  assert.deepEqual(plan(['src-tauri/src/engine.rs']), { ...everything, frontend: false });
  for (const file of ['src-tauri/tauri.conf.json', 'assets/branding/icon.png', '.github/workflows/ci.yml', 'scripts/package-release.ps1', 'THIRD_PARTY_NOTICES.md', 'LICENSE']) {
    assert.deepEqual(plan([file]), everything, file);
  }
  assert.deepEqual(plan([], true), everything);
});

test('selection includes renamed files and forces full coverage for incomplete diffs', async () => {
  const outputs = {};
  const summary = { addHeading() { return this; }, addRaw() { return this; }, async write() {} };
  const context = { eventName: 'pull_request', repo: { owner: 'test', repo: 'chessbot' }, payload: { pull_request: { number: 1, changed_files: 1 } } };
  const github = { rest: { pulls: { listFiles() {} } }, paginate: async () => [{ filename: 'docs/engine.md', previous_filename: 'src-tauri/src/engine.rs' }] };
  const core = { setOutput: (key, value) => { outputs[key] = value; }, summary };
  await select({ context, github, core });
  assert.equal(outputs.rust, 'true');
  context.payload.pull_request.changed_files = 2;
  await select({ context, github, core });
  assert.deepEqual(outputs, Object.fromEntries(Object.keys(everything).map(key => [key, 'true'])));
});

test('CI gate rejects failures, missing selection, and unexpected skipped checks', () => {
  const result = {
    changes: { result: 'success', outputs: Object.fromEntries(Object.keys(everything).map(key => [key, 'true'])) },
    ...Object.fromEntries(['workflow-check', 'zizmor', 'frontend', 'frontend-build', 'fmt', 'rust', 'build'].map(id => [id, { result: 'success' }])),
  };
  assert.deepEqual(failures(result), []);
  for (const status of ['failure', 'cancelled', 'skipped']) {
    result.rust.result = status; assert.ok(failures(result).length);
  }
  result.changes.outputs = {}; assert.ok(failures(result).length);
});

test('report text escapes job names and identifies only this app’s comments', () => {
  const run = { id: 12, run_attempt: 2, conclusion: 'failure' };
  const body = describe(run, [{ name: '<script>@person', conclusion: 'failure', steps: [{ name: '**engine**', conclusion: 'failure' }] }], 'test/chessbot');
  assert.ok(!body.includes('<script>') && !body.includes('@person'));
  assert.deepEqual(identify(body), { run: 12, attempt: 2 });
  assert.equal(identify('Unrelated comment'), null);
  assert.match(describe({ ...run, conclusion: 'success' }, [], 'test/chessbot'), /<summary>Chessbot CI passed/);
});

function fixture() {
  const run = { id: 10, run_attempt: 1, status: 'completed', conclusion: 'failure', event: 'pull_request', path: '.github/workflows/ci.yml', head_sha: 'board-change', head_branch: 'board', head_repository: { full_name: 'contributor/chessbot' }, pull_requests: [{ number: 2 }] };
  const pull = { number: 2, state: 'open', head: { sha: 'board-change', repo: { full_name: 'contributor/chessbot' } }, base: { repo: { full_name: 'test/chessbot' } } };
  const comments = [], writes = [];
  const github = { rest: {
    actions: { getWorkflowRun: async () => ({ data: run }), listWorkflowRuns() {}, listJobsForWorkflowRun() {} },
    pulls: { get: async () => ({ data: pull }) },
    issues: { listComments() {},
      createComment: async data => { writes.push(data); comments.push({ id: 100, body: data.body, user: { login: 'github-actions[bot]', type: 'Bot' } }); },
      updateComment: async data => { writes.push(data); comments[0].body = data.body; },
    },
  }, paginate: async fn => {
    if (fn === github.rest.actions.listWorkflowRuns) return [run];
    if (fn === github.rest.actions.listJobsForWorkflowRun) return [{ name: 'Stockfish tests', conclusion: run.conclusion }];
    if (fn === github.rest.issues.listComments) return comments;
    throw new Error('Unexpected request');
  } };
  const context = { repo: { owner: 'test', repo: 'chessbot' }, payload: { workflow_run: { id: 10, run_attempt: 1 } } };
  return { run, pull, comments, writes, args: { github, context, core: { info() {} } } };
}

test('failed chess checks create one report and recovery updates it', async () => {
  const state = fixture();
  await report(state.args); await report(state.args);
  assert.equal(state.writes.length, 1);
  state.run.conclusion = 'success'; await report(state.args);
  assert.equal(state.writes.length, 2);
  assert.match(state.comments[0].body, /CI passed/);
});

test('report ignores closed or changed PRs, other workflows, and superseded attempts', async () => {
  for (const change of [state => { state.pull.state = 'closed'; }, state => { state.pull.head.sha = 'different'; }, state => { state.run.run_attempt = 2; }, state => { state.run.path = '.github/workflows/release.yml'; }]) {
    const state = fixture(); change(state); await report(state.args); assert.equal(state.writes.length, 0);
  }
});
