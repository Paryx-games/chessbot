const REQUIRED = ['changes', 'workflow-check', 'zizmor'];
const CHECKS = { frontend: ['frontend'], frontendBuild: ['frontend-build'], rust: ['fmt', 'rust'], build: ['build'] };

function failures(results) {
  const problems = REQUIRED.filter(id => results[id]?.result !== 'success')
    .map(id => `Required job ${id} did not succeed`);
  for (const [group, jobs] of Object.entries(CHECKS)) {
    const selected = results.changes?.outputs?.[group];
    if (!['true', 'false'].includes(selected)) {
      problems.push(`No valid selection for ${group}`);
      continue;
    }
    const expected = selected === 'true' ? 'success' : 'skipped';
    jobs.filter(id => results[id]?.result !== expected)
      .forEach(id => problems.push(`${id} must be ${expected}; received ${results[id]?.result ?? 'no result'}`));
  }
  return problems;
}

if (require.main === module) {
  const problems = failures(JSON.parse(process.env.CI_NEEDS));
  for (const problem of problems) console.error(problem);
  if (problems.length) process.exitCode = 1;
  else console.log('Chessbot CI requirements satisfied.');
}

module.exports = { failures };
