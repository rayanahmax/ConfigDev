# ConfigDev

**[https://configdev.com/](https://configdev.com/)**

**Modern, client-side developer utilities for DevOps engineers, cloud architects, and SREs.**

ConfigDev is a suite of zero-latency, privacy-first tools that solve everyday infrastructure problems without compromising data security. All processing runs 100% inside your browser — no uploads, no server round-trips, no logs.

---

## The Local-First, Privacy-First Philosophy

Pasting sensitive data — stack traces, Kubernetes manifests, API keys, server logs — into random online utilities is a real security risk. Most tools process your input on a backend server, meaning your production secrets transit infrastructure you don't control.

ConfigDev eliminates this entirely:

- **Zero Ingress** — Data never leaves your machine. All parsing, encoding, and scrubbing runs inside your browser's V8 sandbox.
- **No Backend** — No databases, no history, no analytics on your input.
- **Offline Capable** — Once the page loads, disconnect from the internet. Every tool keeps working.
- **Verifiable** — Open DevTools → Network tab while using any tool. Zero outbound requests.

---

## Tools

### Security & DevSecOps

| Tool | URL | Description |
|---|---|---|
| PII Masker & Log Scrubber | [/pii-masker-log-scrubber](https://configdev.com/pii-masker-log-scrubber) | Strip emails, IPs, JWTs, credit cards, and secrets from raw logs locally before sharing with LLMs or issue trackers |
| K8s Manifest Sanitizer | [/k8s-manifest-sanitizer](https://configdev.com/k8s-manifest-sanitizer) | Base64 encode/decode Kubernetes Secret data blocks, convert stringData to data, and scrub manifests for safe Git commits |

### Infrastructure & Config

| Tool | URL | Description |
|---|---|---|
| Crontab to Systemd Converter | [/cron-to-systemd-converter](https://configdev.com/cron-to-systemd-converter) | Translate legacy crontab expressions into production-ready systemd `.service` and `.timer` unit files |
| Env to JSON Converter | [/env-to-json](https://configdev.com/env-to-json) | Parse standard `.env` key-value files into clean, formatted JSON objects ready for any pipeline |
| JSON to Env Converter | [/json-to-env](https://configdev.com/json-to-env) | Flatten nested JSON objects into standard `.env` key-value lines with configurable delimiter formatting |

### Networking & Data

| Tool | URL | Description |
|---|---|---|
| CIDR Subnet Calculator | [/cidr-subnet-calculator](https://configdev.com/cidr-subnet-calculator) | Compute subnet boundaries, usable host ranges, broadcast addresses, and network masks for any IPv4 block |
| CSV to JSON Schema Builder | [/csv-to-json-schema](https://configdev.com/csv-to-json-schema) | Inspect CSV column structures and auto-generate a valid JSON Schema Draft-07 specification file |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Astro](https://astro.build/) v7 — static output, zero-JS by default |
| UI Components | React 19 (islands, `client:load`) |
| Styling | Tailwind CSS v4 |
| Deployment | Cloudflare Pages |
| Sitemap | `@astrojs/sitemap` |

---

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Type-check and lint
npm run lint

# Production build
npm run build
```

The project uses flat file routing (`build.format: 'file'`), so pages emit as `/page-name.html` rather than `/page-name/index.html`. This eliminates the trailing-slash duplicate-URL issue in Google Search Console.

---

## Project Structure

```
src/
├── components/
│   ├── shared/
│   │   ├── Navbar.astro         # Site-wide navigation with grouped tool categories
│   │   ├── Footer.astro
│   │   └── RelatedTools.astro   # Cross-linking widget used on all tool pages
│   └── tools/
│       ├── CIDRCalculator.tsx
│       ├── CronToSystemd.tsx
│       ├── CsvToSchema.tsx
│       ├── EnvToJson.tsx
│       ├── JsonToEnv.tsx
│       ├── K8sManifestSanitizer.tsx
│       └── PiiScrubber.tsx
├── layouts/
│   └── Layout.astro             # Base HTML shell, meta, canonical, JSON-LD
├── pages/
│   ├── index.astro              # Homepage with category grid and search/filter
│   ├── k8s-manifest-sanitizer.astro
│   ├── pii-masker-log-scrubber.astro
│   ├── cidr-subnet-calculator.astro
│   ├── cron-to-systemd-converter.astro
│   ├── csv-to-json-schema.astro
│   ├── env-to-json.astro
│   ├── json-to-env.astro
│   └── ...
└── styles/
    └── global.css
public/
├── robots.txt                   # Crawl directives — error/legal pages blocked
├── llms.txt                     # LLM-readable site manifest
└── _redirects                   # Cloudflare Pages redirect rules
astro.config.mjs                 # Site config, sitemap priorities, build format
```

---

## Deployment

Configured for Cloudflare Pages. Set environment variables in your Pages dashboard before deploying:

| Variable | Purpose |
|---|---|
| `PUBLIC_GA_ID` | Google Analytics measurement ID (optional) |
| `PUBLIC_YANDEX_VERIFICATION` | Yandex Webmaster verification (optional) |

Deploy command: `npm run build` → output directory: `dist/`

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

MIT — see [LICENSE](LICENSE).
