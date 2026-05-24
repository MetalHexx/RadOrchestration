import fs from 'node:fs';
import path from 'node:path';

export async function generateReleaseNotes({
  repoRoot, version, sections, writeFile = fs.promises.writeFile,
}) {
  const tag = `v${version}`;
  const parts = [];
  if (sections.whatsNew?.trim()) parts.push(`## What's New\n\n${sections.whatsNew}\n`);
  if (sections.whatsFixed?.trim()) parts.push(`## What's Fixed\n\n${sections.whatsFixed}\n`);
  if (sections.changes?.trim()) parts.push(`## Changes\n\n${sections.changes}\n`);
  parts.push([
    `## Package`,
    '',
    `| Artifact | Source |`,
    `| --- | --- |`,
    `| claude-plugin@${tag} | https://github.com/MetalHexx/rad-orc-plugins/tree/${tag}/claude-plugin |`,
    `| copilot-cli-plugin@${tag} | https://github.com/MetalHexx/rad-orc-plugins/tree/${tag}/copilot-cli-plugin |`,
    `| copilot-vscode-plugin@${tag} | https://github.com/MetalHexx/rad-orc-plugins/tree/${tag}/copilot-vscode-plugin |`,
    `| rad-orc@${version} | https://www.npmjs.com/package/rad-orc/v/${version} |`,
    '',
  ].join('\n'));
  await writeFile(path.join(repoRoot, `RELEASE-NOTES-${tag}.md`), parts.join('\n'), 'utf8');
}
