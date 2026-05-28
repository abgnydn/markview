# deps0

**dependency count: zero.**

Copy-paste replacements for the most popular npm packages. No install. No supply chain. No risk.

> On March 31, 2026, [axios was compromised](https://thehackernews.com/2026/03/axios-supply-chain-attack-pushes-cross.html) via a supply chain attack.
> An attacker injected a backdoored dependency into `package.json` that downloaded RATs
> targeting macOS, Windows, and Linux. The axios source code itself was never changed.
> This is what trust looks like in npm.

## What is this?

Every package in this repo is a **single file** that replaces a popular npm dependency using only native APIs. No `npm install`. No `node_modules`. No transitive dependencies.

Copy the file into your project. That's it.

## Packages

| Package | Replaces | Size | Status |
|---------|----------|------|--------|
| [http](packages/http) | axios | ~4 KB | Ready |
| [utils](packages/utils) | lodash | ~5 KB | Ready |
| [uid](packages/uid) | uuid, nanoid | ~1 KB | Ready |
| [colors](packages/colors) | chalk, kleur | ~2 KB | Ready |
| [env](packages/env) | dotenv | ~2 KB | Ready |
| [qs](packages/qs) | qs, query-string | ~2 KB | Ready |
| datetime | moment, dayjs | ~3 KB | Coming |
| fs-utils | rimraf, mkdirp | ~1 KB | Coming |

## Quick start

**Option 1: Copy a single file**

```bash
# Just grab what you need
curl -O https://raw.githubusercontent.com/deps0/deps0/main/packages/http/http.js
```

```js
import { HttpClient } from './http.js';

const api = new HttpClient({
  baseURL: 'https://api.example.com',
  timeout: 5000,
});

api.interceptors.request.use(cfg => {
  cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

const { data } = await api.get('/users');
```

**Option 2: Clone the repo**

```bash
git clone https://github.com/deps0/deps0.git
cp deps0/packages/http/http.js ./src/lib/
```

## Philosophy

### 1. Own every line

If you can read it, you can trust it. Every file lives in *your* codebase, not in a registry controlled by strangers.

### 2. Zero is a feature

Zero dependencies means zero attack surface, zero surprise breaking changes, zero waiting for a maintainer to patch a CVE at 2am.

### 3. Honest tradeoffs

I tell you exactly what each replacement covers and what it doesn't. Not every file is a 100% drop-in. I show the gaps so you can decide.

## Feature coverage

Every package page on [deps0.com](https://deps0.com) includes:

- **Feature matrix** — side-by-side comparison with the original
- **Honest gaps** — what's missing and why
- **Supply chain risk score** — dependency count, CVE history, maintainer count
- **Copy-paste code** — syntax-highlighted, ready to go

## Requirements

Most packages require **Node 18+** or a modern browser. This is intentional — I use native APIs (Fetch, FormData, crypto.randomUUID, structuredClone) that eliminate the need for dependencies.

If you're on Node 16 or below, use the original packages.

## FAQ

**Isn't this just reinventing the wheel?**

No — it's *removing* the wheel and walking on the ground that was always there. These aren't reimplementations of complex algorithms. They're thin wrappers around native APIs that now exist in every modern runtime.

**What about edge cases?**

Battle-tested libraries have years of edge case fixes. These replacements cover 80-95% of real-world usage. I document every gap. For the 5% of apps that need deep HTTP/2 proxy support or mutual TLS, use the original.

**Is this secure?**

Zero dependencies = zero supply chain attack surface. The code is short enough to read in full. You own it. You audit it. But "secure" also means correctness — I maintain test suites for every package.

**Can I contribute?**

Yes. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Contributing

I welcome new package replacements. Every contribution must:

1. Be a **single file** with **zero dependencies**
2. Include a **feature comparison table** against the original
3. Document **what's missing** (honest gaps)
4. Include **tests**
5. Use only **native APIs** available in Node 18+ / modern browsers

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

MIT — copy it, use it, modify it, ship it. No attribution required (but appreciated).

---

**deps0** — because `node_modules` was always the real vulnerability.
