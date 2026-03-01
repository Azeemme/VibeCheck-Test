-- ============================================================
-- VibeCheck Demo Data: asm_abc123
-- Run this in Supabase SQL Editor to populate the demo assessment
-- with realistic findings from scanning damn-vulnerable-MCP-server
-- ============================================================

-- 1. Insert the assessment
INSERT INTO assessments (
  id, mode, status, repo_url, target_url, tunnel_session_id,
  agents, depth, idempotency_key,
  finding_counts, error_type, error_message,
  created_at, updated_at, completed_at
) VALUES (
  'asm_abc123',
  'lightweight',
  'complete',
  'https://github.com/vulnerable-apps/damn-vulnerable-MCP-server',
  NULL,
  NULL,
  NULL,
  'standard',
  'demo-asm-abc123',
  '{"critical": 3, "high": 4, "medium": 3, "low": 2, "info": 1, "total": 13}',
  NULL,
  NULL,
  NOW() - INTERVAL '2 hours',
  NOW() - INTERVAL '2 hours',
  NOW() - INTERVAL '2 hours' + INTERVAL '45 seconds'
);

-- 2. Insert findings (13 total: 3 critical, 4 high, 3 medium, 2 low, 1 info)

-- ── CRITICAL ──

INSERT INTO findings (id, assessment_id, severity, category, title, description, location, evidence, remediation, agent, created_at) VALUES
('fnd_abc123',
 'asm_abc123',
 'critical',
 'sql_injection',
 'SQL Injection via string formatting in database queries',
 'User-controlled input is directly interpolated into SQL queries using f-strings. An attacker can inject arbitrary SQL to read, modify, or delete any data in the database, or escalate to OS-level command execution via stacked queries.',
 '{"file": "src/db/queries.py", "line": 42, "snippet": "cursor.execute(f\"SELECT * FROM users WHERE id = {user_id}\")"}',
 NULL,
 'Use parameterized queries with placeholders instead of string formatting. Replace f-string interpolation with cursor.execute(\"SELECT * FROM users WHERE id = ?\", (user_id,)).',
 'pattern_scanner',
 NOW() - INTERVAL '2 hours' + INTERVAL '20 seconds'
);

INSERT INTO findings (id, assessment_id, severity, category, title, description, location, evidence, remediation, agent, created_at) VALUES
('fnd_abc124',
 'asm_abc123',
 'critical',
 'command_injection',
 'OS Command Injection via unsanitized user input',
 'User input is passed directly to os.system() without sanitization. An attacker can chain arbitrary OS commands using shell metacharacters (;, &&, |) to achieve remote code execution on the server.',
 '{"file": "src/tools/executor.py", "line": 28, "snippet": "os.system(\"ping \" + target_host)"}',
 NULL,
 'Use subprocess.run() with a list of arguments instead of shell=True. Never pass user input to os.system(). Validate and whitelist allowed input characters.',
 'pattern_scanner',
 NOW() - INTERVAL '2 hours' + INTERVAL '21 seconds'
);

INSERT INTO findings (id, assessment_id, severity, category, title, description, location, evidence, remediation, agent, created_at) VALUES
('fnd_abc125',
 'asm_abc123',
 'critical',
 'path_traversal',
 'Arbitrary file read via path traversal in file serving endpoint',
 'The file serving endpoint constructs file paths by directly concatenating user-supplied filenames without validating for directory traversal sequences. An attacker can read any file on the server (e.g., /etc/passwd, .env) using sequences like ../../.',
 '{"file": "src/server.py", "line": 67, "snippet": "filepath = os.path.join(BASE_DIR, request.args.get(\"file\"))"}',
 NULL,
 'Use os.path.realpath() and verify the resolved path starts with the expected base directory. Reject any paths containing \"..\" sequences.',
 'gemini_llm',
 NOW() - INTERVAL '2 hours' + INTERVAL '35 seconds'
);

-- ── HIGH ──

INSERT INTO findings (id, assessment_id, severity, category, title, description, location, evidence, remediation, agent, created_at) VALUES
('fnd_abc126',
 'asm_abc123',
 'high',
 'hardcoded_secret',
 'Hardcoded database credentials in source code',
 'Database connection string with plaintext username and password is embedded directly in the source code. If the repository is public, these credentials are exposed to anyone and can be used to access the production database.',
 '{"file": "src/config.py", "line": 12, "snippet": "DB_URL = \"postgresql://admin:s3cretP@ss!@db.example.com:5432/production\""}',
 NULL,
 'Move credentials to environment variables or a secrets manager (e.g., AWS Secrets Manager, Vault). Use python-dotenv to load from .env files that are excluded via .gitignore.',
 'secret_scanner',
 NOW() - INTERVAL '2 hours' + INTERVAL '22 seconds'
);

INSERT INTO findings (id, assessment_id, severity, category, title, description, location, evidence, remediation, agent, created_at) VALUES
('fnd_abc127',
 'asm_abc123',
 'high',
 'hardcoded_secret',
 'API key for third-party service committed to repository',
 'A hardcoded API key for an external service is present in the codebase. This key could be used by attackers to abuse the third-party service under your account, potentially incurring costs or accessing sensitive data.',
 '{"file": "src/mcp_tools.py", "line": 8, "snippet": "OPENAI_API_KEY = \"sk-proj-abc123def456ghi789...\""}',
 NULL,
 'Rotate the exposed API key immediately. Store API keys in environment variables and add the key pattern to a .gitignore pre-commit hook to prevent future leaks.',
 'secret_scanner',
 NOW() - INTERVAL '2 hours' + INTERVAL '23 seconds'
);

INSERT INTO findings (id, assessment_id, severity, category, title, description, location, evidence, remediation, agent, created_at) VALUES
('fnd_abc128',
 'asm_abc123',
 'high',
 'insecure_deserialization',
 'Unsafe pickle deserialization of untrusted data',
 'The application uses pickle.loads() to deserialize data from an untrusted source. Pickle deserialization can execute arbitrary code, allowing an attacker to achieve remote code execution by crafting a malicious serialized payload.',
 '{"file": "src/tools/data_handler.py", "line": 55, "snippet": "data = pickle.loads(request.data)"}',
 NULL,
 'Never use pickle to deserialize untrusted data. Use JSON or another safe serialization format. If pickle is required, implement HMAC signing to verify data integrity before deserialization.',
 'pattern_scanner',
 NOW() - INTERVAL '2 hours' + INTERVAL '24 seconds'
);

INSERT INTO findings (id, assessment_id, severity, category, title, description, location, evidence, remediation, agent, created_at) VALUES
('fnd_abc129',
 'asm_abc123',
 'high',
 'broken_auth',
 'Missing authentication on administrative MCP tool endpoints',
 'Several MCP tool endpoints that perform privileged operations (user management, configuration changes) have no authentication or authorization checks. Any connected MCP client can invoke these tools without restriction.',
 '{"file": "src/mcp_server.py", "line": 93, "snippet": "@server.tool()\\nasync def delete_user(user_id: str):"}',
 NULL,
 'Implement authentication middleware for all MCP tool handlers. Add role-based access control (RBAC) to restrict administrative tools to authorized clients only.',
 'gemini_llm',
 NOW() - INTERVAL '2 hours' + INTERVAL '36 seconds'
);

-- ── MEDIUM ──

INSERT INTO findings (id, assessment_id, severity, category, title, description, location, evidence, remediation, agent, created_at) VALUES
('fnd_abc130',
 'asm_abc123',
 'medium',
 'xss',
 'Cross-Site Scripting via unsanitized template rendering',
 'User-supplied data is rendered directly in HTML templates without escaping. An attacker can inject malicious JavaScript that executes in other users'' browsers, potentially stealing session tokens or performing actions on their behalf.',
 '{"file": "src/templates/profile.html", "line": 15, "snippet": "<h1>Welcome, {{ user.name | safe }}</h1>"}',
 NULL,
 'Remove the | safe filter and let the template engine auto-escape output. For contexts where raw HTML is needed, use a sanitization library like bleach.',
 'pattern_scanner',
 NOW() - INTERVAL '2 hours' + INTERVAL '25 seconds'
);

INSERT INTO findings (id, assessment_id, severity, category, title, description, location, evidence, remediation, agent, created_at) VALUES
('fnd_abc131',
 'asm_abc123',
 'medium',
 'insecure_dependency',
 'Known vulnerable dependency: PyYAML < 6.0 with arbitrary code execution',
 'The project depends on PyYAML version 5.3.1 which is vulnerable to CVE-2020-14343, allowing arbitrary code execution via yaml.load() with the default Loader. This is a well-known supply chain risk.',
 '{"file": "requirements.txt", "line": 7, "snippet": "PyYAML==5.3.1"}',
 NULL,
 'Upgrade PyYAML to version 6.0 or later. Always use yaml.safe_load() instead of yaml.load(). Pin dependencies and run regular vulnerability scans.',
 'dependency_scanner',
 NOW() - INTERVAL '2 hours' + INTERVAL '18 seconds'
);

INSERT INTO findings (id, assessment_id, severity, category, title, description, location, evidence, remediation, agent, created_at) VALUES
('fnd_abc132',
 'asm_abc123',
 'medium',
 'ssrf',
 'Server-Side Request Forgery via unvalidated URL parameter',
 'The application fetches content from a user-supplied URL without validating the target. An attacker can use this to scan internal networks, access cloud metadata endpoints (169.254.169.254), or reach other internal services.',
 '{"file": "src/tools/fetcher.py", "line": 31, "snippet": "response = requests.get(url_param)"}',
 NULL,
 'Validate and whitelist allowed URL schemes (http/https only) and hostnames. Block requests to private IP ranges (10.x, 172.16.x, 192.168.x) and cloud metadata endpoints.',
 'gemini_llm',
 NOW() - INTERVAL '2 hours' + INTERVAL '37 seconds'
);

-- ── LOW ──

INSERT INTO findings (id, assessment_id, severity, category, title, description, location, evidence, remediation, agent, created_at) VALUES
('fnd_abc133',
 'asm_abc123',
 'low',
 'insecure_config',
 'Debug mode enabled in production configuration',
 'The application is configured with DEBUG=True in what appears to be the production configuration. Debug mode exposes detailed error pages with stack traces, environment variables, and source code snippets to end users.',
 '{"file": "src/config.py", "line": 3, "snippet": "DEBUG = True"}',
 NULL,
 'Set DEBUG=False for production environments. Use environment variables to control debug mode: DEBUG = os.getenv(\"DEBUG\", \"false\").lower() == \"true\".',
 'config_scanner',
 NOW() - INTERVAL '2 hours' + INTERVAL '26 seconds'
);

INSERT INTO findings (id, assessment_id, severity, category, title, description, location, evidence, remediation, agent, created_at) VALUES
('fnd_abc134',
 'asm_abc123',
 'low',
 'missing_security_headers',
 'Missing security headers (CORS wildcard, no CSP)',
 'The application sets Access-Control-Allow-Origin: * and does not define a Content-Security-Policy header. The wildcard CORS policy allows any website to make authenticated requests, and the missing CSP increases XSS impact.',
 '{"file": "src/server.py", "line": 12, "snippet": "app.add_middleware(CORSMiddleware, allow_origins=[\"*\"])"}',
 NULL,
 'Restrict CORS origins to specific trusted domains. Add Content-Security-Policy, X-Frame-Options, and X-Content-Type-Options headers.',
 'config_scanner',
 NOW() - INTERVAL '2 hours' + INTERVAL '27 seconds'
);

-- ── INFO ──

INSERT INTO findings (id, assessment_id, severity, category, title, description, location, evidence, remediation, agent, created_at) VALUES
('fnd_abc135',
 'asm_abc123',
 'info',
 'verbose_logging',
 'Sensitive data potentially logged in application output',
 'The application logs request bodies and headers at DEBUG level, which may include sensitive information like API keys, session tokens, or user credentials in production log aggregators.',
 '{"file": "src/server.py", "line": 45, "snippet": "logger.debug(f\"Request: {request.headers} Body: {request.body}\")"}',
 NULL,
 'Redact sensitive fields (authorization headers, passwords, API keys) before logging. Use structured logging with explicit field selection rather than logging entire request objects.',
 'gemini_llm',
 NOW() - INTERVAL '2 hours' + INTERVAL '38 seconds'
);

-- ============================================================
-- Verification: run these queries after inserting to confirm
-- ============================================================
-- SELECT id, mode, status, finding_counts FROM assessments WHERE id = 'asm_abc123';
-- SELECT id, severity, category, title, agent FROM findings WHERE assessment_id = 'asm_abc123' ORDER BY created_at;
