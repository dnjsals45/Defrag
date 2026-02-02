import { GitHubTransformer } from './github.transformer';
import { SourceType } from '../../database/entities/context-item.entity';

describe('GitHubTransformer', () => {
  describe('transformIssue', () => {
    const mockIssue = {
      id: 1,
      number: 42,
      title: 'Bug: Something is broken',
      body: 'This is the issue description',
      state: 'open',
      html_url: 'https://github.com/owner/repo/issues/42',
      user: { login: 'testuser', id: 1 },
      labels: [
        { id: 1, name: 'bug' },
        { id: 2, name: 'critical' },
      ],
      comments: 15,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      closed_at: null,
    };

    it('should transform issue correctly', () => {
      const result = GitHubTransformer.transformIssue(mockIssue, 'owner/repo');

      expect(result.externalId).toBe('github:issue:owner/repo:42');
      expect(result.sourceType).toBe(SourceType.GITHUB_ISSUE);
      expect(result.title).toBe('[owner/repo] #42: Bug: Something is broken');
      expect(result.sourceUrl).toBe('https://github.com/owner/repo/issues/42');
      expect(result.content).toContain('This is the issue description');
      expect(result.content).toContain('State: open');
      expect(result.content).toContain('Labels: bug, critical');
      expect(result.content).toContain('Comments: 15');
    });

    it('should include metadata', () => {
      const result = GitHubTransformer.transformIssue(mockIssue, 'owner/repo');

      expect(result.metadata.repo).toBe('owner/repo');
      expect(result.metadata.number).toBe(42);
      expect(result.metadata.state).toBe('open');
      expect(result.metadata.labels).toEqual(['bug', 'critical']);
      expect(result.metadata.author).toBe('testuser');
      expect(result.metadata.comments).toBe(15);
    });

    it('should calculate high importance for issues with many comments and important labels', () => {
      const result = GitHubTransformer.transformIssue(mockIssue, 'owner/repo');
      expect(result.importanceScore).toBeGreaterThan(0.7);
    });

    it('should handle issue without body', () => {
      const issueWithoutBody = { ...mockIssue, body: null };
      const result = GitHubTransformer.transformIssue(
        issueWithoutBody,
        'owner/repo',
      );
      expect(result.content).toBeDefined();
    });

    it('should handle issue without labels', () => {
      const issueWithoutLabels = { ...mockIssue, labels: [] };
      const result = GitHubTransformer.transformIssue(
        issueWithoutLabels,
        'owner/repo',
      );
      expect(result.content).toContain('Labels: none');
    });
  });

  describe('transformPullRequest', () => {
    const mockPR = {
      id: 1,
      number: 123,
      title: 'Add new feature',
      body: 'This PR adds a new feature',
      state: 'open',
      html_url: 'https://github.com/owner/repo/pull/123',
      user: { login: 'prauthor', id: 2 },
      labels: [{ id: 1, name: 'enhancement' }],
      head: { ref: 'feature-branch' },
      base: { ref: 'main' },
      additions: 150,
      deletions: 50,
      changed_files: 15,
      commits: 5,
      comments: 3,
      merged_at: '2024-01-15T00:00:00Z',
      created_at: '2024-01-10T00:00:00Z',
      updated_at: '2024-01-15T00:00:00Z',
      closed_at: '2024-01-15T00:00:00Z',
    };

    it('should transform PR correctly', () => {
      const result = GitHubTransformer.transformPullRequest(
        mockPR,
        'owner/repo',
      );

      expect(result.externalId).toBe('github:pr:owner/repo:123');
      expect(result.sourceType).toBe(SourceType.GITHUB_PR);
      expect(result.title).toBe('[owner/repo] PR #123: Add new feature');
      expect(result.content).toContain('This PR adds a new feature');
      expect(result.content).toContain('Branch: feature-branch → main');
      expect(result.content).toContain('Changes: +150 -50 in 15 files');
    });

    it('should include PR metadata', () => {
      const result = GitHubTransformer.transformPullRequest(
        mockPR,
        'owner/repo',
      );

      expect(result.metadata.merged).toBe(true);
      expect(result.metadata.headBranch).toBe('feature-branch');
      expect(result.metadata.baseBranch).toBe('main');
      expect(result.metadata.additions).toBe(150);
      expect(result.metadata.deletions).toBe(50);
      expect(result.metadata.changedFiles).toBe(15);
    });

    it('should calculate high importance for merged PRs with many files', () => {
      const result = GitHubTransformer.transformPullRequest(
        mockPR,
        'owner/repo',
      );
      expect(result.importanceScore).toBeGreaterThan(0.8);
    });

    it('should indicate merged status in content', () => {
      const result = GitHubTransformer.transformPullRequest(
        mockPR,
        'owner/repo',
      );
      expect(result.content).toContain('(merged)');
    });
  });

  describe('transformCommit', () => {
    const mockCommit = {
      sha: 'abc123def456789012345678901234567890abcd',
      html_url: 'https://github.com/owner/repo/commit/abc123',
      commit: {
        message: 'fix: resolve critical bug\n\nThis fixes the login issue.',
        author: {
          name: 'Test Author',
          email: 'test@example.com',
          date: '2024-01-20T10:00:00Z',
        },
      },
      author: { login: 'testauthor', id: 3 },
    };

    it('should transform commit correctly', () => {
      const result = GitHubTransformer.transformCommit(mockCommit, 'owner/repo');

      expect(result.externalId).toBe(
        'github:commit:owner/repo:abc123def456789012345678901234567890abcd',
      );
      expect(result.sourceType).toBe(SourceType.GITHUB_COMMIT);
      expect(result.title).toBe('[owner/repo] fix: resolve critical bug');
      expect(result.content).toBe('This fixes the login issue.');
    });

    it('should include commit metadata', () => {
      const result = GitHubTransformer.transformCommit(mockCommit, 'owner/repo');

      expect(result.metadata.sha).toBe(
        'abc123def456789012345678901234567890abcd',
      );
      expect(result.metadata.shortSha).toBe('abc123d');
      expect(result.metadata.author).toBe('testauthor');
      expect(result.metadata.authorEmail).toBe('test@example.com');
    });

    it('should calculate higher importance for fix commits', () => {
      const result = GitHubTransformer.transformCommit(mockCommit, 'owner/repo');
      expect(result.importanceScore).toBeGreaterThan(0.5);
    });

    it('should calculate lower importance for merge commits', () => {
      const mergeCommit = {
        ...mockCommit,
        commit: {
          ...mockCommit.commit,
          message: 'Merge pull request #123 from feature-branch',
        },
      };
      const result = GitHubTransformer.transformCommit(
        mergeCommit,
        'owner/repo',
      );
      expect(result.importanceScore).toBeLessThan(0.4);
    });

    it('should use commit author name when login is not available', () => {
      const commitWithoutLogin = {
        ...mockCommit,
        author: null,
      };
      const result = GitHubTransformer.transformCommit(
        commitWithoutLogin,
        'owner/repo',
      );
      expect(result.metadata.author).toBe('Test Author');
    });
  });
});
