module.exports = {
  branches: [
    "master",
    { name: "next", channel: "next", prerelease: "rc" },
    { name: "beta", prerelease: true },
    { name: "alpha", prerelease: true },
  ],
  extends: ["semantic-release-config-gitmoji"],
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        config: 'conventional-changelog-gitmoji-config',
        releaseRules: [
          { type: 'ci', release: 'patch' },
          { type: 'build', release: 'patch' },
          { type: 'refactor', release: 'patch' },
          { type: 'docs', release: 'patch' },
          { type: 'fix', release: 'patch' },
          { type: 'chore', release: 'minor' },
          { type: 'feat', release: 'minor' }
        ],
        parserOpts: {
        "noteKeywords": ["BREAKING CHANGE", "BREAKING CHANGES"]
        }
      }
    ],
    [
      '@semantic-release/release-notes-generator',
      {
        config: 'conventional-changelog-gitmoji-config',
      },
    ],
    [
      '@semantic-release/changelog',
      {
        changelogFile: 'CHANGELOG.md',
        changelogTitle: '# Changelog',
      },
    ],
    '@semantic-release/github',
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'package.json'],
        message:
          // eslint-disable-next-line no-template-curly-in-string
          ':bookmark: chore(release): ${nextRelease.gitTag} [skip ci] \n\n${nextRelease.notes}'
      },
    ],
  ]
};
