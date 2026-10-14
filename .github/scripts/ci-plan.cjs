const GROUPS = ['frontend', 'frontendBuild', 'rust', 'build'];

function plan(paths, force = false) {
  const enabled = new Set(force ? GROUPS : []);
  for (const filename of paths) {
    const name = filename.replaceAll('\\', '/');
    if (name.startsWith('frontend/')) {
      ['frontend', 'frontendBuild', 'build'].forEach(group => enabled.add(group));
    } else if (name.endsWith('.rs') || /(^|\/)Cargo\.(toml|lock)$/.test(name)) {
      ['frontendBuild', 'rust', 'build'].forEach(group => enabled.add(group));
    } else if (['LICENSE', 'THIRD_PARTY_NOTICES.md'].includes(name)) {
      GROUPS.forEach(group => enabled.add(group));
    } else if (name.endsWith('.md') || /^\.github\/(ISSUE_TEMPLATE\/|FUNDING\.yml$|dependabot\.yml$)/.test(name)) {
      // Documentation and repository forms do not change the application.
    } else {
      GROUPS.forEach(group => enabled.add(group));
    }
  }
  return Object.fromEntries(GROUPS.map(group => [group, enabled.has(group)]));
}

async function select({ github, context, core }) {
  let paths = [];
  let fullRun = true;
  if (context.eventName === 'pull_request') {
    const pr = context.payload.pull_request;
    const records = await github.paginate(github.rest.pulls.listFiles, {
      ...context.repo, pull_number: pr.number, per_page: 100,
    });
    fullRun = records.length !== pr.changed_files || records.length >= 3000;
    paths = records.flatMap(record => [record.filename, record.previous_filename].filter(Boolean));
  }
  const selection = plan(paths, fullRun);
  for (const group of GROUPS) core.setOutput(group, String(selection[group]));
  await core.summary.addHeading('Chessbot checks')
    .addRaw(GROUPS.map(group => '- ' + group + ': ' + (selection[group] ? 'required' : 'not needed')).join('\n'))
    .write();
}

module.exports = { plan, select };
