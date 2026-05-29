# Security Policy

## Reporting

Do not open a public issue for secrets exposure, auth bypass, remote code execution, or infrastructure compromise.

Contact the maintainer privately through GitHub security advisories or a private channel.

## Secret Handling

- Secrets must live in deployment environment variables or GitHub repository secrets
- Example files may contain placeholders only
- Pull requests that expose credentials should be treated as compromised and rotated immediately

