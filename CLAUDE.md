# CLAUDE.md - AI Assistant Guide for Neighbors-Kitchen

> **Last Updated:** 2025-11-13
> **Repository Status:** New project (initial setup phase)

## Project Overview

**Neighbors-Kitchen** is a community-focused project currently in its initial setup phase. This document serves as a comprehensive guide for AI assistants working on this codebase.

### Repository Information
- **Repository:** joe-bera/Neighbors-Kitchen
- **Main Branch:** TBD (will be set when established)
- **Current Status:** Initial commit only
- **License:** Not yet specified

## Codebase Structure

### Current State
The repository is in its initial state with minimal files:
```
Neighbors-Kitchen/
├── .git/
├── README.md
└── CLAUDE.md (this file)
```

### Expected Structure (To Be Established)
As this project develops, update this section with the actual directory structure. Typical patterns might include:
```
Neighbors-Kitchen/
├── src/                 # Source code
├── tests/              # Test files
├── docs/               # Documentation
├── config/             # Configuration files
├── scripts/            # Build and utility scripts
├── public/             # Public assets (if web project)
├── .github/            # GitHub workflows and templates
├── package.json        # Dependencies (if Node.js)
├── requirements.txt    # Dependencies (if Python)
└── README.md          # Project documentation
```

## Development Workflow

### Git Branching Strategy

#### Branch Naming Conventions
- **Feature branches:** `feature/<descriptive-name>`
- **Bug fixes:** `fix/<issue-description>`
- **Claude AI branches:** `claude/claude-md-<session-id>`
- **Documentation:** `docs/<topic>`
- **Refactoring:** `refactor/<component>`

#### Branch Guidelines
1. Always create a new branch for work, never commit directly to main
2. Use descriptive branch names that indicate the purpose
3. Keep branches focused on a single feature or fix
4. Delete branches after merging

### Commit Message Conventions

Follow conventional commit format:
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, no logic change)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks
- `perf:` Performance improvements

**Examples:**
```
feat(auth): add user authentication system

Implement JWT-based authentication with login and registration endpoints.
Includes password hashing and token validation.

Closes #123
```

```
fix(api): resolve null pointer in user query

Add null check before accessing user data to prevent crashes.
```

### Git Operations Best Practices

#### Pushing Changes
```bash
# Always push with upstream tracking
git push -u origin <branch-name>

# Branch names for Claude sessions must follow pattern:
# claude/claude-md-<session-id>
```

#### Fetching and Pulling
```bash
# Fetch specific branch
git fetch origin <branch-name>

# Pull with rebase to maintain clean history
git pull --rebase origin <branch-name>
```

#### Before Committing
1. Review all changes: `git status` and `git diff`
2. Stage relevant files only: `git add <files>`
3. Ensure no secrets or credentials are included
4. Write clear, descriptive commit messages
5. Run tests if they exist

## Code Quality Standards

### General Principles
1. **Write Clean Code:** Self-documenting, readable, and maintainable
2. **DRY Principle:** Don't Repeat Yourself
3. **SOLID Principles:** Follow object-oriented design principles
4. **Test Coverage:** Aim for high test coverage
5. **Documentation:** Comment complex logic, not obvious code

### Security Best Practices
- ⚠️ **Never commit secrets, API keys, or credentials**
- Store sensitive data in environment variables
- Use `.gitignore` to exclude sensitive files (.env, credentials.json, etc.)
- Validate and sanitize all user inputs
- Protect against common vulnerabilities:
  - SQL Injection
  - XSS (Cross-Site Scripting)
  - CSRF (Cross-Site Request Forgery)
  - Command Injection
  - Path Traversal

### Code Review Checklist
- [ ] Code follows project conventions
- [ ] No security vulnerabilities introduced
- [ ] Tests pass and new tests added for new features
- [ ] Documentation updated
- [ ] No debugging code or console.logs left in
- [ ] Error handling is appropriate
- [ ] Performance considerations addressed

## Technology Stack

**Note:** To be determined as the project develops. Update this section when technologies are chosen.

Expected areas to document:
- **Frontend:** Framework/library (React, Vue, Angular, etc.)
- **Backend:** Language and framework (Node.js/Express, Python/Django, etc.)
- **Database:** Type and ORM (PostgreSQL, MongoDB, etc.)
- **Testing:** Testing frameworks and tools
- **Build Tools:** Bundlers, task runners, CI/CD
- **Other Tools:** Linters, formatters, package managers

## Environment Setup

### Prerequisites
*To be documented when established*

### Installation Steps
*To be documented when established*

### Environment Variables
*Document required environment variables here*

Example format:
```
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname

# API Keys
API_KEY=your_api_key_here

# Environment
NODE_ENV=development
```

## Testing Strategy

### Test Organization
*To be established*

### Running Tests
```bash
# Add commands when test suite is set up
# Example: npm test, pytest, etc.
```

### Testing Guidelines
- Write tests for all new features
- Maintain existing tests when refactoring
- Aim for meaningful test coverage, not just high percentages
- Test edge cases and error conditions
- Use descriptive test names

## API Documentation

*To be created when API endpoints are established*

### Endpoint Naming Conventions
*To be defined*

### Request/Response Format
*To be defined*

## Database Schema

*To be documented when database is set up*

### Migrations
*Document migration strategy and commands*

## Common Tasks for AI Assistants

### Adding a New Feature
1. Review existing codebase to understand patterns
2. Create feature branch: `git checkout -b feature/<name>`
3. Implement feature following project conventions
4. Add tests for the new functionality
5. Update documentation
6. Commit with descriptive message
7. Push to remote branch
8. Create pull request

### Fixing a Bug
1. Reproduce the bug
2. Create fix branch: `git checkout -b fix/<description>`
3. Implement fix
4. Add regression test
5. Verify fix doesn't break existing functionality
6. Commit and push
7. Create pull request

### Refactoring Code
1. Ensure tests exist and pass before refactoring
2. Create refactor branch
3. Make incremental changes
4. Run tests after each change
5. Keep commits focused and atomic
6. Document reasoning for refactoring

### Updating Dependencies
1. Review changelog for breaking changes
2. Update one dependency at a time if possible
3. Run full test suite
4. Update code for breaking changes
5. Document any required changes

## Project-Specific Conventions

### Naming Conventions
*To be established based on chosen technology stack*

- **Variables:** camelCase or snake_case
- **Functions:** descriptive verb phrases
- **Classes:** PascalCase
- **Constants:** UPPER_SNAKE_CASE
- **Files:** kebab-case or snake_case

### File Organization
*To be defined as project structure develops*

### Import/Export Patterns
*To be defined based on language/framework*

## Troubleshooting Common Issues

*This section will grow as common issues are encountered*

### Git Issues
- **Push fails with 403:** Ensure branch name follows `claude/<pattern>` format
- **Merge conflicts:** Carefully review conflicts, test after resolution
- **Detached HEAD:** `git checkout <branch-name>` to reattach

### Development Issues
*To be added as they arise*

## Resources and References

### External Documentation
*Add links to relevant documentation as project develops*

### Internal Documentation
- [README.md](./README.md) - Project overview and setup
- [CLAUDE.md](./CLAUDE.md) - This file (AI assistant guide)

## AI Assistant Guidelines

### When Working on This Project

1. **Understand Before Changing:**
   - Read existing code and documentation
   - Use exploration tools to understand structure
   - Ask clarifying questions when requirements are unclear

2. **Follow Established Patterns:**
   - Match existing code style and conventions
   - Use the same libraries and approaches as existing code
   - Don't introduce new patterns without discussion

3. **Be Thorough:**
   - Test changes thoroughly
   - Consider edge cases
   - Update documentation
   - Check for security implications

4. **Use Task Management:**
   - Use TodoWrite tool for complex multi-step tasks
   - Break down large tasks into smaller steps
   - Track progress and mark completed items

5. **Communicate Clearly:**
   - Explain your reasoning
   - Highlight important decisions
   - Point out potential issues or trade-offs
   - Use file:line_number format when referencing code

6. **Git Workflow:**
   - Always work on the specified branch
   - Write clear commit messages
   - Push changes when work is complete
   - Use retry logic for network failures

### What to Avoid

- ❌ Don't commit secrets or credentials
- ❌ Don't skip tests or break existing tests
- ❌ Don't make assumptions about requirements
- ❌ Don't push to main/master without permission
- ❌ Don't create files unnecessarily (prefer editing)
- ❌ Don't use bash for file operations (use proper tools)
- ❌ Don't add emojis unless explicitly requested
- ❌ Don't skip pre-commit hooks

## Updating This Document

This document should be kept up-to-date as the project evolves:

### When to Update
- New technologies or frameworks are added
- Project structure changes significantly
- New conventions are established
- Common issues and solutions are discovered
- API endpoints or database schema changes
- Build/deployment process changes

### How to Update
1. Make changes on a feature branch
2. Review for accuracy and completeness
3. Commit with descriptive message: `docs(claude): update AI assistant guide`
4. Keep the "Last Updated" date current

---

## Quick Reference

### Essential Commands
```bash
# Check repository status
git status

# Create and switch to new branch
git checkout -b <branch-name>

# Stage and commit changes
git add <files>
git commit -m "type(scope): description"

# Push changes
git push -u origin <branch-name>

# View recent commits
git log --oneline -10
```

### Important Files
- `README.md` - Project documentation
- `CLAUDE.md` - This AI assistant guide
- `.gitignore` - Files to exclude from version control
- *Configuration files to be added*

### Key Principles
✅ Test your changes
✅ Write clear commits
✅ Follow conventions
✅ Document as you go
✅ Security first
✅ Ask when uncertain

---

**Note:** This is a living document. As Neighbors-Kitchen develops, this guide should be updated to reflect the actual codebase, conventions, and workflows established by the team.
