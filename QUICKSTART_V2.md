# Reflection V2 Quick Start

## What is Reflection V2?

**Reflection V2** is an advanced code generation agent that produces production-ready code with:
- 🎯 **10-dimensional quality analysis** (correctness, security, maintainability, etc.)
- 🧪 **Automatic test generation** (happy path, edge cases, errors)
- 📚 **Built-in documentation** (JSDoc, usage examples)
- 🔍 **Code smell detection** (anti-patterns, refactoring tips)
- 🌐 **Language-specific optimization** (TypeScript, Python, Go, Rust, etc.)

**Quality: 90%+ code, ready for production!**

## Quick Examples

### Example 1: Email Validator

```bash
npm run dev ask "Write a production-ready email validator"
```

**Output includes:**
```typescript
/**
 * Validates email addresses according to RFC 5322
 */
function validateEmail(email: string): boolean {
  // Type-safe implementation
  // Input validation
  // Edge case handling
  // Security considerations
}

// ===== TESTS =====
describe('validateEmail', () => {
  test('valid emails', () => { /* ... */ })
  test('invalid formats', () => { /* ... */ })
  test('edge cases', () => { /* ... */ })
})

// ===== USAGE EXAMPLES =====
validateEmail('user@example.com') // true
```

**Metrics shown:**
```
Pattern: REFLECTION | 4,200 tokens | 10,500ms
Iterations: 2
Quality: 93.5% [V2]  ← V2 indicator
```

### Example 2: API Endpoint

```bash
npm run dev ask "Write a TypeScript Express endpoint for user authentication"
```

**Gets you:**
- Complete Express route handler
- Input validation with Zod
- JWT token generation
- Error handling
- Security best practices
- Comprehensive tests
- API documentation

### Example 3: Python Data Processing

```bash
npm run dev ask "Write a Python function to analyze CSV data"
```

**Gets you:**
- Type hints
- Pandas integration
- Error handling
- Edge cases
- pytest test suite
- Usage examples

## When V2 is Used

**Automatically triggered for:**
- ✅ Code generation ("Write a function...")
- ✅ Refactoring ("Refactor this code...")
- ✅ Debugging with fixes ("Fix this bug...")

**Not used for:**
- ❌ Simple questions ("What is TypeScript?")
- ❌ Explanations ("Explain async/await")
- ❌ File operations (uses Tool Use pattern)

## Configuration

### Default (via Router)

```bash
# Just ask - router handles it
npm run dev ask "Write a CSV parser"
```

V2 automatically used with:
- Quality threshold: 90%
- Test generation: ON
- Documentation: ON
- Strict mode: ON

### Custom Configuration

```typescript
import { ReflectionAgentV2 } from './agents/reflection-agent-v2.js'

// Very strict
const agent = new ReflectionAgentV2(llmManager, {
  qualityThreshold: 0.95,  // 95% quality required
  strictMode: true,        // Prioritize security
  generateTests: true,     // Include tests
  generateDocs: true,      // Include docs
  targetLanguage: 'typescript'  // Force language
})

const result = await agent.execute({
  task: 'Write a secure password hashing function'
})
```

### Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `qualityThreshold` | 0.90 | Minimum quality (0-1) |
| `maxIterations` | 3 | Max refinement loops |
| `strictMode` | true | Prioritize security |
| `generateTests` | true | Include test suite |
| `generateDocs` | true | Include documentation |
| `targetLanguage` | auto | Force language |
| `temperature` | 0.7 | LLM creativity |

## Quality Dimensions

V2 evaluates code across **10 dimensions**:

1. **Correctness** (20%) - Logic works correctly
2. **Completeness** (15%) - All requirements met
3. **Security** (15%) - No vulnerabilities
4. **Error Handling** (10%) - Robust error cases
5. **Maintainability** (10%) - Easy to modify
6. **Readability** (10%) - Clear and clean
7. **Testability** (10%) - Easy to test
8. **Efficiency** (5%) - Good performance
9. **Best Practices** (3%) - Follows standards
10. **Documentation** (2%) - Well documented

**Result: 90%+ production-ready code**

## Output Structure

```
[MAIN CODE]
- Type-safe implementation
- Error handling
- Input validation
- Security considerations

[TESTS]
- Happy path scenarios
- Edge cases
- Error conditions
- Boundary values

[DOCUMENTATION]
- Function documentation
- Usage instructions
- Code examples
```

## Language Support

**Optimized for:**

| Language | Features |
|----------|----------|
| TypeScript | Strict typing, generics, no `any` |
| JavaScript | ES6+, async/await |
| Python | PEP 8, type hints, comprehensions |
| Go | Idioms, error handling, goroutines |
| Rust | Ownership, Result<T,E>, traits |
| Java | SOLID, streams, Optional |
| C++ | Modern C++17+, RAII, smart pointers |

## Code Smell Detection

V2 identifies and fixes:

- **Long Methods** → Extract methods
- **God Objects** → Split responsibilities
- **Duplicate Code** → DRY principle
- **Magic Numbers** → Named constants
- **Deep Nesting** → Early returns
- **Data Clumps** → Create objects

Each with specific refactoring advice!

## Performance

### Speed
- **Latency**: 8-15 seconds
- **Why**: Comprehensive analysis + tests + docs
- **Worth it**: For production code quality

### Cost
- **Tokens**: 4,000-6,000 per task
- **2-3x more than V1**
- **Justified by**: Complete output (code + tests + docs)

### Quality
- **V1 Range**: 75-85%
- **V2 Range**: 88-96%
- **Improvement**: +10-15% average

## Best Practices

### 1. Be Specific

**Good:**
```bash
"Write a TypeScript function to validate email addresses with RFC 5322 compliance"
```

**Better:**
```bash
"Write a production-ready TypeScript email validator that:
- Validates against RFC 5322
- Handles edge cases (unicode, special chars)
- Returns detailed error messages
- Includes comprehensive tests"
```

### 2. Specify Language

```bash
"Write a Python function..."  # Auto-detects Python
"Write in Go..."              # Auto-detects Go
```

Or override:
```typescript
targetLanguage: 'rust'  // Force Rust
```

### 3. Use for Production Code

V2 is optimized for:
- ✅ API endpoints
- ✅ Business logic
- ✅ Data processing
- ✅ Security functions
- ✅ Library code

Not ideal for:
- ❌ Quick scripts
- ❌ Prototypes
- ❌ Learning examples

(Use V1 or direct pattern for those)

### 4. Review Generated Tests

While comprehensive, review tests for:
- Business-specific edge cases
- Integration scenarios
- Performance requirements

### 5. Customize Quality Threshold

```typescript
// Critical security code
qualityThreshold: 0.95

// Standard production
qualityThreshold: 0.90

// Good enough
qualityThreshold: 0.85
```

## Troubleshooting

### Quality Below Threshold

**Issue**: Quality stuck at 87%, threshold is 90%

**Solutions:**
1. Lower threshold: `qualityThreshold: 0.85`
2. Be more specific in task description
3. Increase iterations: `maxIterations: 5`

### No Tests Generated

**Issue**: Tests missing from output

**Check:**
```typescript
generateTests: true  // Should be true
```

### Wrong Language

**Issue**: Generated Python instead of TypeScript

**Fix:**
```bash
# Be explicit
"Write a TypeScript function..."

# Or force it
targetLanguage: 'typescript'
```

### Too Slow

**Issue**: 15+ seconds per request

**Normal for V2** due to:
- Comprehensive analysis
- Test generation
- Documentation

**Alternatives:**
- Use V1 for simpler tasks
- Use direct pattern for questions

## Comparison: V1 vs V2

| Feature | V1 | V2 |
|---------|----|----|
| Evaluation dimensions | 5 | 10 |
| Quality threshold | 85% | 90% |
| Test generation | ❌ | ✅ |
| Documentation | ❌ | ✅ |
| Code smell detection | ❌ | ✅ |
| Language-specific | ❌ | ✅ |
| Security analysis | Basic | Advanced |
| Token usage | ~2K | ~5K |
| Latency | 3-8s | 8-15s |
| Quality range | 75-85% | 88-96% |

**When to use each:**
- **V1**: Prototypes, examples, learning
- **V2**: Production code, libraries, critical systems

## CLI Indicators

Look for the **[V2]** badge:

```
Pattern: REFLECTION | 4,520 tokens | 12,340ms
Iterations: 2
Quality: 93.2% [V2]  ← This confirms V2 was used
```

**Color coding:**
- 🟢 Green (90%+): Excellent
- 🔵 Cyan (80-90%): Good
- 🟡 Yellow (70-80%): Acceptable
- 🔴 Red (<70%): Needs work

## Next Steps

1. **Try it out:**
   ```bash
   npm run dev ask "Write a production-ready CSV parser with tests"
   ```

2. **Read full docs:**
   - [docs/REFLECTION_V2.md](./docs/REFLECTION_V2.md) - Complete guide
   - [REFLECTION_V2_SUMMARY.md](./REFLECTION_V2_SUMMARY.md) - Summary

3. **Explore examples:**
   - API endpoints
   - Data processing
   - Algorithm implementation
   - Security functions

4. **Customize config:**
   - Adjust quality thresholds
   - Enable/disable tests
   - Target specific languages

---

**Reflection V2: Production-ready code generation in one command! 🚀**
