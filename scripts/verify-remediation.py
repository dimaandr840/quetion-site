#!/usr/bin/env python3
"""Run non-production checks and record bounded logs. No credentials are required."""
from pathlib import Path
import datetime
import subprocess
import tempfile

root = Path(__file__).resolve().parent.parent
sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
checks = [
    ('Backend verify', 'backend', ['mvn', '-B', '-ntp', 'verify']),
    ('Frontend clean install', 'frontend', ['npm', 'ci', '--no-audit', '--no-fund']),
    ('Frontend lint', 'frontend', ['npm', 'run', 'lint']),
    ('Frontend typecheck', 'frontend', ['npm', 'run', 'typecheck']),
    ('Frontend regression tests', 'frontend', ['npm', 'test']),
    ('Design tokens', 'frontend', ['npm', 'run', 'check:tokens']),
    ('Frontend build', 'frontend', ['npm', 'run', 'build']),
    ('Release shell syntax', '.', ['bash', '-n', 'scripts/deploy-release.sh']),
]
report = [f'# Remediation verification\n\nCommit: `{sha}`\n\nUTC: {datetime.datetime.now(datetime.timezone.utc).isoformat()}\n',
          'Automated checks only. This does not certify staging, PostgreSQL concurrency, mobile UX or production recovery.\n']
for name, directory, command in checks:
    with tempfile.TemporaryFile(mode='w+') as log:
        try:
            result = subprocess.run(command, cwd=root / directory, stdout=log, stderr=subprocess.STDOUT, timeout=360)
            status = str(result.returncode)
        except subprocess.TimeoutExpired:
            status = 'TIMEOUT'
        log.seek(0)
        output = log.read()
    report.append(f'## {name}\n\nExit: **{status}**\n\nCommand: `{" ".join(command)}`\n\n')
    # Error messages can be earlier than Maven's tail; include the first concrete errors too.
    errors = [line for line in output.splitlines() if '[ERROR]' in line or 'error TS' in line]
    excerpt = '\n'.join(errors[:15]) + '\n' + output[-2200:]
    report.append('````text\n' + excerpt + '\n````\n')
(root / 'docs' / 'remediation-verification.md').write_text('\n'.join(report))
