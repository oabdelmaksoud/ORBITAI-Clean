```markdown
# ORBITAI-Clean Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches you the core development patterns and conventions used in the ORBITAI-Clean TypeScript codebase. You'll learn how to structure files, write imports/exports, follow commit conventions, and understand the project's approach to testing. This guide will help you contribute code that is consistent, maintainable, and easy to review.

## Coding Conventions

### File Naming
- Use **camelCase** for all file names.
  - Example: `userProfile.ts`, `dataFetcher.test.ts`

### Import Style
- Use **relative imports** for referencing modules within the project.
  - Example:
    ```typescript
    import { fetchData } from './dataFetcher';
    ```

### Export Style
- Use **named exports** for all modules.
  - Example:
    ```typescript
    // In userProfile.ts
    export function getUserProfile(id: string) { ... }

    // In another file
    import { getUserProfile } from './userProfile';
    ```

### Commit Messages
- Follow the **Conventional Commits** specification.
- Use the `chore` prefix for maintenance and non-feature changes.
  - Example:  
    ```
    chore: update dependencies to latest versions
    ```

## Workflows

### Code Contribution
**Trigger:** When you want to add or update code in the repository  
**Command:** `/contribute`

1. Create a new branch for your changes.
2. Write code following the coding conventions above.
3. Add or update tests as needed (see Testing Patterns).
4. Commit your changes using a conventional commit message (e.g., `chore: refactor dataFetcher for clarity`).
5. Push your branch and open a pull request for review.

### Running Tests
**Trigger:** When you want to verify your code with tests  
**Command:** `/test`

1. Identify test files (pattern: `*.test.*`).
2. Use the project's test runner (framework not specified; check project documentation or `package.json`).
3. Run all tests and ensure they pass before submitting code.

## Testing Patterns

- Test files use the pattern: `*.test.*` (e.g., `dataFetcher.test.ts`).
- The specific testing framework is not detected; check for further documentation or scripts in the project.
- Place test files alongside the modules they test, using the same camelCase naming convention.

  Example:
  ```
  src/
    dataFetcher.ts
    dataFetcher.test.ts
  ```

## Commands
| Command      | Purpose                                      |
|--------------|----------------------------------------------|
| /contribute  | Steps for contributing code                  |
| /test        | Steps for running and verifying tests        |
```
