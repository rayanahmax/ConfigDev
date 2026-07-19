# ConfigDev

**[https://configdev.com/](https://configdev.com/)**

**Modern, client-side developer utilities for DevOps and backend engineers.**

ConfigDev is a suite of zero-latency, privacy-first tools designed to help developers solve everyday problems without compromising data security or infrastructure integrity. 

## 🛡️ The Local-First, Privacy-First Philosophy

In modern engineering, pasting sensitive data (like stack traces, configuration files, and API logs) into random online utilities or generative AI interfaces is a massive security risk. 

ConfigDev solves this by adhering strictly to a **Local-First, Privacy-First** philosophy:
- **Zero Ingress**: Data never leaves your machine. All parsing, formatting, and scrubbing happens natively inside your browser's local sandbox (V8 runtime).
- **No Backend Databases**: We don't store your history, logs, or configurations.
- **100% Network Isolation**: Once the app loads, you can disable your internet connection, and the tools will continue to function perfectly.

## 🚀 Hero Tools

- [**PII Masker & Log Scrubber**](https://configdev.com/pii-masker-log-scrubber): A powerful regex-driven engine that strips sensitive PII (emails, IPs, JWTs, Secrets, Credit Cards) out of raw logs locally so you can safely share them with LLMs.
- [**CIDR Subnet Calculator**](https://configdev.com/cidr-subnet-calculator): A fast, visual subnet mask calculator for DevOps and networking engineers to plan IP ranges locally without internet connection.
- [**Cron to Systemd Converter**](https://configdev.com/cron-to-systemd-converter): Easily translate legacy crontab expressions into modern Systemd timer units and service files.
- [**CSV to JSON Schema**](https://configdev.com/csv-to-json-schema): Instantly convert flat CSV data into nested JSON schemas directly in your browser.
- [**ENV to JSON**](https://configdev.com/env-to-json): Convert flat `.env` variable lists into structured JSON objects.
- [**JSON to ENV**](https://configdev.com/json-to-env): Transform nested or flat JSON objects back into flattened `.env` variable syntax.

## 💻 Development

This project is built with [Astro](https://astro.build/) for exceptional performance and zero-JS static rendering by default.

### Setup

```bash
npm install
npm run dev
```

### Deployment

ConfigDev is configured for seamless deployment to Cloudflare Pages. Make sure to define your environment variables (like `PUBLIC_GA_ID`) in your platform settings before deploying!

## 📜 License

This project is open-source and licensed under the [MIT License](LICENSE).
