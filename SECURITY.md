# Security and Privacy Policy

## Scope

APA · SMC Live Desk is a static GitHub Pages application. Its source code is public in this repository. It is not an authenticated account system, encrypted journal, broker terminal, or server-side application.

## Data handling

- The app stores preferences and its signal journal in the current browser's local storage. This storage is **not encrypted by this application** and can be read by someone with access to the unlocked browser profile or device.
- Historical candle data is cached in the browser's IndexedDB.
- Clearing browser site data can delete local settings, cached candles, and journal entries. Export and protect any journal backup before clearing data.
- Do not enter or save brokerage passwords, exchange API keys, seed phrases, identity documents, private trading notes, or other secrets in this app.
- Do not commit private information, `.env` files, tokens, API keys, personal records, or journal exports to this public repository.
- Market-data requests are sent to the configured market-data provider. The app's browser security policy currently permits the Biquote HTTPS API only.
- Third-party chart code is loaded from pinned-version public CDNs. The app needs an internet connection for that library.

## GitHub account and repository owner checklist

The repository owner should complete these steps in GitHub account settings:

1. Enable two-factor authentication (2FA), preferably with a passkey or authenticator app, and save recovery codes offline.
2. Use a unique password and never share GitHub personal access tokens.
3. Review **Settings → Applications** and revoke unfamiliar or unnecessary OAuth applications and GitHub App access.
4. Review repository collaborators and remove anyone who no longer needs access.
5. Review recent commits and repository contents for accidental secrets. If a secret was committed, revoke or rotate it immediately. Deleting it from the latest file is not enough because Git history may retain it.
6. Enable available secret scanning, push protection, and Dependabot security updates in repository security settings where supported by the account and repository visibility.
7. Review GitHub Pages deployment settings and ensure publishing uses only the intended branch and folder.
8. Keep a separate backup of important code and journal exports, and never publish private exports in this repository.

## Reporting a vulnerability

Do not publish exploit details, private information, or secrets in a public issue. Contact the repository owner privately through a trusted channel and include the affected file or URL, steps to reproduce, and likely impact. Do not include passwords or live tokens in the report.

## Known limitations

- Browser local storage and IndexedDB are not encrypted by this app.
- There is no sign-in, server-side access control, encrypted synchronization, or private cloud journal.
- Content Security Policy and output escaping reduce some browser-side risks, but they do not make a static website invulnerable.
- Market analysis is heuristic and does not place or execute orders.
