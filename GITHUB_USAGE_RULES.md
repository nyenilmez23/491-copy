# GitHub Usage Rules

## Issues

- Open an issue for every task, including coding and non-coding work.
- Track research, reading, meeting notes, documentation, experiment design, data
  collection, and slides in issues too.
- Every issue must have a clear title, a short description, acceptance criteria
  or a checklist explaining what “done” means, and assignee(s) responsible for it.
- Labels for type or priority and a milestone are optional.
- Keep progress and discussion visible in GitHub so contributions can be tracked.

## Branches and pull requests

- Follow the workflow: Issue → Branch → Pull Request → Review → Merge.
- Develop on a branch for the issue. Avoid committing directly to `main`.
- Open a pull request to merge the branch into `main`.
- Every PR must reference its issue using `Closes #ID` when it completes the issue.
  `Fixes #ID` and `Resolves #ID` are also issue-closing keywords.
- Review the PR and any CI checks, if enabled, before merging.
- After merging completed work, verify that the issue closes.

## Commit messages

- Use Conventional Commits:

  ```text
  type(scope): short description
  ```

- Scope is optional. Common types are `feat`, `fix`, `docs`, `refactor`, `test`,
  and `chore`.
- Use `!` for breaking changes. Use an optional body for details and a footer for
  issue references.

Examples:

```text
feat(auth): add login rate limiting
fix(api): handle null payload
docs(readme): update setup instructions
```

## Contribution tracking

- Keep coding and non-coding contributions traceable through issues, PRs, commits,
  reviews, and comments.
- TAs and instructors will review GitHub history to evaluate progress and
  individual contributions.
