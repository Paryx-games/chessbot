const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { checkVersion } = require('../../scripts/check-version.cjs');

function validateTag(tag, version) {
  if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/.test(tag)) {
    throw new Error('Expected an existing vX.Y.Z or vX.Y.Z-prerelease tag');
  }
  if (tag !== `v${version}`) throw new Error('Release tag does not match application version');
  return { prerelease: version.includes('-'), makeLatest: !version.includes('-') };
}

function changelogNotes(changelog, tag) {
  const version = tag.slice(1);
  const lines = changelog.replace(/^\uFEFF/, '').split(/\r?\n/);
  const start = lines.findIndex(line => {
    const heading = line.match(/^## (\S+)(?:\s+-\s+.*)?$/);
    return heading && [version, tag].includes(heading[1]);
  });
  if (start < 0) throw new Error(`Missing changelog section for ${tag}`);
  let end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  if (end < 0) end = lines.length;
  const notes = lines.slice(start + 1, end).join('\n').trim();
  if (!notes || !notes.replace(/^#+.*$/gm, '').trim()) throw new Error('Release changelog is empty');
  return notes;
}

async function prepare({ github, context, core }) {
  const tag = process.env.RELEASE_TAG;
  const metadata = validateTag(tag, checkVersion());
  const sha = execFileSync('git', ['rev-parse', `refs/tags/${tag}^{commit}`], { encoding: 'utf8' }).trim();
  const { owner, repo } = context.repo;
  try {
    await github.rest.repos.getReleaseByTag({ owner, repo, tag });
    throw new Error('This tag already has a published release');
  } catch (error) { if (error.status !== 404) throw error; }
  fs.writeFileSync('release-notes.md', changelogNotes(fs.readFileSync('CHANGELOG.md', 'utf8'), tag) + '\n');
  for (const [key, value] of Object.entries({ sha, prerelease: metadata.prerelease, make_latest: metadata.makeLatest })) {
    core.setOutput(key, String(value));
  }
  // Accept only successful, trusted CI for this exact immutable commit.
  for (let attempt = 0; attempt < 60; attempt++) {
    const { data } = await github.rest.actions.listWorkflowRuns({ owner, repo, workflow_id: 'ci.yml', head_sha: sha, per_page: 100 });
    const latest = data.workflow_runs.filter(run => run.head_sha === sha && ['push', 'workflow_dispatch'].includes(run.event))
      .sort((a, b) => b.id - a.id)[0];
    if (latest?.status === 'completed') {
      if (latest.conclusion !== 'success') throw new Error(`Latest trusted CI did not pass: ${latest.html_url}`);
      core.info(`Exact-commit CI passed: ${latest.html_url}`);
      return;
    }
    if (attempt < 59) await new Promise(resolve => setTimeout(resolve, 15000));
  }
  throw new Error('No successful trusted CI found for this commit. Run CI on this tag, then retry Release.');
}

async function confirmTag({ github, context }) {
  const { data: ref } = await github.rest.git.getRef({ ...context.repo, ref: `tags/${process.env.RELEASE_TAG}` });
  let object = ref.object;
  for (let count = 0; object.type === 'tag' && count < 10; count++) {
    const { data: tag } = await github.rest.git.getTag({ ...context.repo, tag_sha: object.sha });
    object = tag.object;
  }
  if (object.type !== 'commit' || object.sha !== process.env.RELEASE_SHA) throw new Error('Release tag moved or no longer points to the validated commit');
}

module.exports = { validateTag, changelogNotes, prepare, confirmTag };
