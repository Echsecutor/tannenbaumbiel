# Development Best Practices

## Critical Workflow Checks

### ⚠️ **ALWAYS Verify Build After Code Changes**

**MANDATORY**: After making any code changes, always run the build process to ensure compilation success:

```bash
# Frontend Build Check
cd frontend && npm run build

# Backend Build Check (if applicable)
cd backend && python -m py_compile app/**/*.py
```

### Common Build Issues to Watch For

1. **TypeScript Type Errors**

   - Missing parameter types in function signatures
   - Unused variables/parameters triggering strict TypeScript rules
   - Implicit 'any' types in complex data structures

2. **Import/Export Issues**

   - Missing imports after code refactoring
   - Circular dependencies
   - Case-sensitive file path issues

3. **UI-Specific Issues**
   - Missing `.setScrollFactor(0)` on UI elements (causes invisible UI)
   - Missing `.setDepth()` layering for overlapping elements
   - Incorrect positioning calculations

### Recent Build Fix Examples

- **UIScene.ts**: Fixed TypeScript error with map function parameter types
- **main.ts**: Removed unused `hideError()` function to prevent TS6133 warnings
- **UI Elements**: Added `setScrollFactor(0)` to prevent camera scrolling issues

## Code Quality Standards

### TypeScript Best Practices

- Always provide explicit types for function parameters
- Remove unused variables immediately
- Use proper TypeScript interfaces for complex data structures
- Avoid `any` type - use specific interfaces instead

### UI Development Guidelines

- All UI elements MUST have `setScrollFactor(0)` to prevent camera interference
- Use appropriate depth layering (`setDepth()`) for z-ordering
- Add debug logging for positioning issues
- Test UI visibility in both offline and multiplayer modes

## Integration Workflow

1. **Code Changes** → 2. **Build Verification** → 3. **Local Testing** → 4. **Commit**

Never skip step 2 - build failures in Docker can be harder to debug than local build issues.
