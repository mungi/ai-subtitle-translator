```markdown
# ai-subtitle-translator Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches you the development conventions and workflows used in the `ai-subtitle-translator` JavaScript codebase. You'll learn about file naming, import/export styles, commit patterns, and how to write and organize tests. This guide is ideal for contributors looking to maintain consistency and quality in the project.

## Coding Conventions

### File Naming
- Use **camelCase** for file names.
  - Example: `subtitleParser.js`, `translateAudio.js`

### Import Style
- Use **relative imports** for modules within the project.
  - Example:
    ```javascript
    import { parseSubtitle } from './subtitleParser';
    ```

### Export Style
- Use **named exports** for functions and variables.
  - Example:
    ```javascript
    // In subtitleParser.js
    export function parseSubtitle(file) { ... }
    ```

    ```javascript
    // In another file
    import { parseSubtitle } from './subtitleParser';
    ```

### Commit Patterns
- Commit messages are **freeform** (no strict prefix), with an average length of 39 characters.
  - Example:  
    ```
    Add initial subtitle parsing logic
    Fix translation bug for long sentences
    ```

## Workflows

### Adding a New Feature
**Trigger:** When implementing a new functionality  
**Command:** `/add-feature`

1. Create a new JavaScript file using camelCase (e.g., `myNewFeature.js`).
2. Write your feature using named exports.
3. Import any dependencies using relative paths.
4. Add or update corresponding test files (`*.test.js`).
5. Commit changes with a clear, concise message.

### Fixing a Bug
**Trigger:** When resolving a reported issue  
**Command:** `/fix-bug`

1. Locate the relevant file(s) using camelCase naming.
2. Make the necessary code changes.
3. Update or add tests to cover the fix.
4. Commit with a descriptive message about the bug fix.

### Writing and Running Tests
**Trigger:** When ensuring code correctness  
**Command:** `/run-tests`

1. Create or update test files named with the pattern `*.test.js`.
2. Write tests for your functions and modules.
3. Use the project's test runner (framework unknown; check project docs or package.json).
4. Run tests and ensure all pass before committing.

## Testing Patterns

- Test files use the `*.test.js` naming convention.
- The testing framework is **unknown**; check for instructions in the project documentation or `package.json`.
- Place tests alongside or in a dedicated test directory, following the same camelCase naming.

**Example:**
```javascript
// translateAudio.test.js
import { translateAudio } from './translateAudio';

test('translates audio to target language', () => {
  // test implementation
});
```

## Commands
| Command      | Purpose                                  |
|--------------|------------------------------------------|
| /add-feature | Start the workflow for adding a feature  |
| /fix-bug     | Begin the bug fixing workflow            |
| /run-tests   | Run all tests in the codebase            |
```
