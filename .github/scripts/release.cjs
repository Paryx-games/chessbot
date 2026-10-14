function validateTag(tag, version) {
  if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/.test(tag)) {
    throw new Error('Expected an existing vX.Y.Z or vX.Y.Z-prerelease tag');
  }
  if (tag !== `v${version}`) throw new Error('Release tag does not match application version');
  const prerelease = version.includes('-') && !/-rc\.\d+$/.test(version);
  return { prerelease, makeLatest: !prerelease };
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

async function confirmTag({ github, context }) {
  const { data: ref } = await github.rest.git.getRef({ ...context.repo, ref: `tags/${process.env.RELEASE_TAG}` });
  let object = ref.object;
  for (let count = 0; object.type === 'tag' && count < 10; count++) {
    const { data: tag } = await github.rest.git.getTag({ ...context.repo, tag_sha: object.sha });
    object = tag.object;
  }
  if (object.type !== 'commit' || object.sha !== process.env.RELEASE_SHA) throw new Error('Release tag moved or no longer points to the validated commit');
}

module.exports = { validateTag, changelogNotes, confirmTag };
