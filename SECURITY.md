# Security

This document outlines the security measures and best practices for the ShelfBridge project.

## Security Scanning

### Automated Security Checks

We use several automated security scanning tools to detect potential security issues:

1. **GitHub Actions Security Workflow** (`.github/workflows/security-scan.yml`)
   - Runs on every push and pull request
   - Scheduled weekly scans
   - Uses Gitleaks to detect secrets in code
   - Runs npm audit for dependency vulnerabilities
   - Checks for hardcoded secrets and sensitive files

2. **Pre-commit Hooks** (`.husky/pre-commit`)
   - Runs before each commit
   - Scans staged files for secrets
   - Prevents accidental commit of sensitive data

3. **Gitleaks Configuration** (`.gitleaks.toml`)
   - Customized rules for ShelfBridge
   - Allowlist for false positives
   - Project-specific secret patterns

### What We Scan For

- API keys and tokens
- Passwords and secrets
- AWS access keys
- Private keys and certificates
- Configuration files with sensitive data
- Dependency vulnerabilities

## Best Practices

### Configuration Management

1. **Never commit sensitive data**
   - Use `config.yaml.example` for templates
   - Keep actual `config.yaml` in `.gitignore`
   - Use environment variables for secrets

2. **Environment Variables**
   ```bash
   # Instead of hardcoding in config.yaml
   export ABS_TOKEN="your_token_here"
   export HARDCOVER_TOKEN="your_token_here"
   ```

3. **Configuration Template**
   ```yaml
   # config.yaml.example
   users:
     - id: "user1"
       abs_url: "https://your-abs-instance.com"
       abs_token: "${ABS_TOKEN}"  # Use environment variable
       hardcover_token: "${HARDCOVER_TOKEN}"
   ```

### Code Security

1. **Input Validation**
   - Validate all user inputs
   - Sanitize configuration data
   - Use parameterized queries

2. **Error Handling**
   - Don't expose sensitive information in error messages
   - Log errors without revealing secrets
   - Use appropriate error codes

3. **Dependencies**
   - Regularly update dependencies
   - Run `npm audit` regularly
   - Review security advisories

## Reporting Security Issues

If you discover a security vulnerability:

1. **DO NOT** create a public issue
2. **DO** email security@shelfbridge.com (if available)
3. **DO** create a private security advisory on GitHub
4. **DO** provide detailed reproduction steps

## Security Checklist

Before committing code:

- [ ] No hardcoded secrets
- [ ] No API keys in code
- [ ] Configuration files properly ignored
- [ ] Dependencies up to date
- [ ] No sensitive data in logs
- [ ] Input validation in place
- [ ] Error handling secure

## Monitoring

- Security scans run automatically
- Results available in GitHub Actions
- SARIF reports uploaded for analysis
- Weekly scheduled scans
- Pre-commit hooks prevent issues

## Tools Used

- **Gitleaks**: Secret detection
- **npm audit**: Dependency vulnerability scanning
- **GitHub Actions**: Automated scanning
- **Husky**: Pre-commit hooks
- **SARIF**: Standardized security reports 