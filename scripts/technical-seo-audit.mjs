#!/usr/bin/env node

import { request as httpsRequest } from 'node:https'
import { URL } from 'node:url'

const DEFAULT_MAX_PAGES = 50
const DEFAULT_TIMEOUT_MS = 15000
const AI_TOKENS = [
  'GPTBot',
  'ChatGPT-User',
  'ClaudeBot',
  'PerplexityBot',
  'Bytespider',
  'Google-Extended',
]

function parseArgs(argv) {
  const args = { maxPages: DEFAULT_MAX_PAGES, timeoutMs: DEFAULT_TIMEOUT_MS }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--') && !args.url) {
      args.url = token
      continue
    }
    if (token === '--url') args.url = argv[++i]
    else if (token === '--max-pages') args.maxPages = Number(argv[++i])
    else if (token === '--timeout-ms') args.timeoutMs = Number(argv[++i])
    else if (token === '--help' || token === '-h') args.help = true
  }
  return args
}

function printHelp() {
  console.log(`Technical SEO Audit\n\nUsage:\n  node scripts/technical-seo-audit.mjs --url https://example.com [--max-pages 50] [--timeout-ms 15000]\n`) // eslint-disable-line no-console
}

function normalizeUrl(input) {
  if (!input) return null
  const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`
  return new URL(withProtocol)
}

function severityRank(severity) {
  return { high: 0, medium: 1, low: 2, info: 3 }[severity] ?? 4
}

function pushFinding(state, category, severity, title, details, fix) {
  state.findings.push({ category, severity, title, details, fix })
}

function safeHeader(headers, name) {
  return headers.get(name) || headers.get(name.toLowerCase()) || ''
}

async function fetchWithMeta(url, timeoutMs) {
  const started = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'tech-seo-audit/1.0' },
    })
    const body = await res.text()
    const durationMs = Date.now() - started
    return {
      ok: res.ok,
      status: res.status,
      url: res.url,
      headers: res.headers,
      body,
      durationMs,
      bytes: Buffer.byteLength(body),
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function checkTls(originUrl, timeoutMs) {
  if (originUrl.protocol !== 'https:') {
    return { enabled: false, reason: 'URL is not HTTPS' }
  }
  return new Promise((resolve) => {
    const req = httpsRequest(
      {
        protocol: originUrl.protocol,
        hostname: originUrl.hostname,
        port: originUrl.port || 443,
        path: '/',
        method: 'GET',
        servername: originUrl.hostname,
        rejectUnauthorized: true,
      },
      (res) => {
        const socket = res.socket
        const cert = socket.getPeerCertificate?.() || {}
        const protocol = socket.getProtocol?.()
        resolve({
          enabled: true,
          protocol: protocol || 'unknown',
          validTo: cert.valid_to || null,
          validFrom: cert.valid_from || null,
          issuer: cert.issuer?.O || cert.issuer?.CN || null,
          subject: cert.subject?.CN || null,
        })
        res.resume()
      }
    )
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('TLS timeout'))
    })
    req.on('error', (err) => {
      resolve({ enabled: true, error: err.message })
    })
    req.end()
  })
}

function extractLinks(html, base) {
  const links = new Set()
  const hrefRegex = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>/gi
  let match
  while ((match = hrefRegex.exec(html))) {
    try {
      const abs = new URL(match[1], base)
      links.add(abs.href)
    } catch {
      // ignore invalid urls
    }
  }
  return [...links]
}

function extractCanonical(html, base) {
  const m = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i)
  if (!m) return null
  try {
    return new URL(m[1], base).href
  } catch {
    return m[1]
  }
}

function hasNoindex(html, headers) {
  const robotsMeta = /<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex[^"']*["'][^>]*>/i.test(html)
  const xRobots = safeHeader(headers, 'x-robots-tag')
  return robotsMeta || /noindex/i.test(xRobots)
}

function hasViewport(html) {
  return /<meta\b[^>]*name=["']viewport["'][^>]*>/i.test(html)
}

function hasStructuredDataScripts(html) {
  const scripts = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  const parsed = []
  const invalid = []
  for (const s of scripts) {
    const raw = s[1].trim()
    if (!raw) continue
    try {
      parsed.push(JSON.parse(raw))
    } catch {
      invalid.push(raw.slice(0, 120))
    }
  }
  return { count: scripts.length, parsed, invalid }
}

function countScripts(html) {
  const scripts = html.match(/<script\b/gi) || []
  return scripts.length
}

function visibleTextLength(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().length
}

async function crawlInternal(startUrl, maxPages, timeoutMs) {
  const start = new URL(startUrl)
  const host = start.host
  const queue = [{ href: start.href, depth: 0 }]
  const seen = new Set()
  const pages = []

  while (queue.length && pages.length < maxPages) {
    const current = queue.shift()
    if (!current || seen.has(current.href)) continue
    seen.add(current.href)

    let page
    try {
      page = await fetchWithMeta(current.href, timeoutMs)
    } catch (error) {
      pages.push({ href: current.href, depth: current.depth, error: error.message })
      continue
    }

    pages.push({
      href: current.href,
      finalUrl: page.url,
      status: page.status,
      depth: current.depth,
      durationMs: page.durationMs,
      bytes: page.bytes,
      noindex: hasNoindex(page.body, page.headers),
    })

    if (!/text\/html/i.test(safeHeader(page.headers, 'content-type'))) continue

    for (const link of extractLinks(page.body, page.url)) {
      const u = new URL(link)
      if (u.host !== host) continue
      const normalized = `${u.origin}${u.pathname}${u.search}`
      if (!seen.has(normalized) && queue.length + pages.length < maxPages * 3) {
        queue.push({ href: normalized, depth: current.depth + 1 })
      }
    }
  }
  return pages
}

function parseRobots(raw) {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.split('#')[0].trim())
    .filter(Boolean)

  const groups = []
  let current = null
  for (const line of lines) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim().toLowerCase()
    const value = line.slice(idx + 1).trim()
    if (key === 'user-agent') {
      current = { userAgent: value, rules: [] }
      groups.push(current)
    } else if (current) {
      current.rules.push({ key, value })
    }
  }
  return groups
}

async function run() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help || !args.url) {
    printHelp()
    process.exit(args.help ? 0 : 1)
  }

  const baseUrl = normalizeUrl(args.url)
  const state = {
    auditedAt: new Date().toISOString(),
    target: baseUrl.href,
    findings: [],
    metrics: {},
  }

  const homepage = await fetchWithMeta(baseUrl.href, args.timeoutMs)
  state.metrics.homepage = {
    status: homepage.status,
    finalUrl: homepage.url,
    durationMs: homepage.durationMs,
    bytes: homepage.bytes,
    scriptCount: countScripts(homepage.body),
    visibleTextLength: visibleTextLength(homepage.body),
  }

  // Crawlability + Indexability
  const robotsUrl = new URL('/robots.txt', homepage.url)
  let robots
  try {
    robots = await fetchWithMeta(robotsUrl.href, args.timeoutMs)
  } catch {
    robots = null
  }

  if (!robots || robots.status >= 400) {
    pushFinding(state, 'crawlability', 'high', 'robots.txt missing or unreachable', 'Search engines may crawl unpredictably without explicit directives.', 'Add a valid /robots.txt with default User-agent rules and sitemap location.')
  } else {
    const groups = parseRobots(robots.body)
    state.metrics.robots = {
      status: robots.status,
      sizeBytes: robots.bytes,
      userAgentGroups: groups.length,
    }
    const hasSitemapDirective = /(^|\n)\s*Sitemap\s*:/i.test(robots.body)
    if (!hasSitemapDirective) {
      pushFinding(state, 'crawlability', 'medium', 'robots.txt has no sitemap directive', 'Bots can still find sitemaps, but explicit directives improve discovery.', 'Add one or more `Sitemap: https://your-domain/sitemap.xml` directives.')
    }

    for (const token of AI_TOKENS) {
      const hit = groups.find((g) => g.userAgent.toLowerCase() === token.toLowerCase())
      if (!hit) {
        pushFinding(state, 'crawlability', 'low', `No explicit AI crawler policy for ${token}`, 'AI crawler access policy is implicit; this can conflict with training/citation risk strategy.', `Add a robots group for ${token} and explicitly allow/disallow paths by policy.`)
      }
    }
  }

  const sitemapUrl = new URL('/sitemap.xml', homepage.url)
  let sitemap
  try {
    sitemap = await fetchWithMeta(sitemapUrl.href, args.timeoutMs)
  } catch {
    sitemap = null
  }

  if (!sitemap || sitemap.status >= 400) {
    pushFinding(state, 'crawlability', 'high', 'XML sitemap missing or unreachable', 'Without sitemap.xml, page discovery relies mostly on internal links.', 'Expose /sitemap.xml and keep it synchronized with indexable URLs.')
  } else {
    const isXml = /xml/i.test(safeHeader(sitemap.headers, 'content-type')) || sitemap.body.trim().startsWith('<?xml')
    if (!isXml) {
      pushFinding(state, 'crawlability', 'high', 'sitemap.xml is not valid XML content', 'Invalid sitemap payload can be ignored by search engines.', 'Return well-formed XML with urlset/sitemapindex tags.')
    }
  }

  const pages = await crawlInternal(homepage.url, args.maxPages, args.timeoutMs)
  state.metrics.crawl = {
    pagesCrawled: pages.length,
    avgDepth: pages.length ? Number((pages.reduce((a, b) => a + (b.depth || 0), 0) / pages.length).toFixed(2)) : 0,
    maxDepth: pages.reduce((max, p) => Math.max(max, p.depth || 0), 0),
    avgTtfbMs: pages.length ? Math.round(pages.reduce((a, b) => a + (b.durationMs || 0), 0) / pages.length) : 0,
    noindexCount: pages.filter((p) => p.noindex).length,
    errorCount: pages.filter((p) => p.error || (p.status && p.status >= 400)).length,
  }

  if (state.metrics.crawl.maxDepth > 3) {
    pushFinding(state, 'crawlability', 'medium', 'Deep internal pages detected', `Maximum observed crawl depth is ${state.metrics.crawl.maxDepth}.`, 'Reduce click depth for strategic pages to <= 3 from homepage.')
  }
  if (state.metrics.crawl.errorCount > 0) {
    pushFinding(state, 'crawlability', 'high', 'Broken internal URLs found during crawl', `${state.metrics.crawl.errorCount} URLs returned errors or failed to fetch.`, 'Fix broken links, bad redirects, and invalid routes.')
  }

  if (hasNoindex(homepage.body, homepage.headers)) {
    pushFinding(state, 'indexability', 'high', 'Homepage has noindex directive', 'The homepage appears blocked from indexing via meta robots or x-robots-tag.', 'Remove noindex on canonical production pages.')
  }
  if (/rel=["']canonical["']/i.test(homepage.body)) {
    const canonical = extractCanonical(homepage.body, homepage.url)
    state.metrics.canonical = canonical
    if (canonical && canonical !== homepage.url) {
      pushFinding(state, 'url_structure', 'medium', 'Homepage canonical differs from fetched URL', `Canonical: ${canonical} | Fetched: ${homepage.url}`, 'Ensure canonical points to preferred protocol/host/path variant.')
    }
  } else {
    pushFinding(state, 'url_structure', 'medium', 'Canonical link missing on homepage', 'Missing canonical increases duplicate URL risks.', 'Add `<link rel="canonical" href="https://preferred-domain/..." />`.')
  }

  // Security
  const tls = await checkTls(new URL(homepage.url), args.timeoutMs)
  state.metrics.tls = tls
  if (!tls.enabled) {
    pushFinding(state, 'security', 'high', 'Site not using HTTPS', 'TLS is required for SEO trust and browser security features.', 'Redirect all HTTP traffic to HTTPS and enforce HSTS.')
  } else if (tls.error) {
    pushFinding(state, 'security', 'high', 'TLS handshake or certificate check failed', tls.error, 'Fix certificate chain and TLS endpoint configuration.')
  }

  const requiredHeaders = [
    'content-security-policy',
    'strict-transport-security',
    'x-content-type-options',
    'x-frame-options',
    'referrer-policy',
  ]
  const missingHeaders = requiredHeaders.filter((h) => !safeHeader(homepage.headers, h))
  if (missingHeaders.length) {
    pushFinding(state, 'security', 'high', 'Missing key security headers', `Missing: ${missingHeaders.join(', ')}`, 'Configure these headers in the app/server/CDN response policy.')
  }

  // Mobile + CWV proxy diagnostics
  if (!hasViewport(homepage.body)) {
    pushFinding(state, 'mobile', 'high', 'Viewport meta tag missing', 'Without viewport, mobile rendering and usability degrade significantly.', 'Add `<meta name="viewport" content="width=device-width, initial-scale=1" />`.')
  }
  if (state.metrics.homepage.bytes > 700000) {
    pushFinding(state, 'core_web_vitals', 'medium', 'Large initial HTML payload', `Homepage HTML is ${state.metrics.homepage.bytes} bytes.`, 'Reduce inlined content and script payload to improve LCP and TTFB.')
  }
  if (state.metrics.homepage.scriptCount > 35) {
    pushFinding(state, 'core_web_vitals', 'medium', 'High script count on initial load', `${state.metrics.homepage.scriptCount} script tags detected.`, 'Defer non-critical scripts and reduce client-side JavaScript execution.')
  }

  // Structured data
  const sd = hasStructuredDataScripts(homepage.body)
  state.metrics.structuredData = {
    scriptCount: sd.count,
    parsedCount: sd.parsed.length,
    invalidCount: sd.invalid.length,
  }
  if (sd.count === 0) {
    pushFinding(state, 'structured_data', 'medium', 'No JSON-LD structured data detected', 'Missing schema reduces eligibility for rich results and entity understanding.', 'Add Organization and WebSite schema at minimum; include Product/FAQ where appropriate.')
  }
  if (sd.invalid.length > 0) {
    pushFinding(state, 'structured_data', 'high', 'Invalid JSON-LD blocks detected', `${sd.invalid.length} JSON-LD script blocks failed to parse.`, 'Fix JSON syntax and required schema fields.')
  }

  // JavaScript rendering diagnostics
  const textLen = state.metrics.homepage.visibleTextLength
  if (textLen < 350) {
    pushFinding(state, 'javascript_rendering', 'medium', 'Low server-rendered text content', `Visible text length looks low (${textLen} chars), may indicate heavy client-side dependency.`, 'Ensure key content is present in initial HTML and not JS-only.')
  }

  const sortedFindings = state.findings.sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
  const bySeverity = sortedFindings.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1
    return acc
  }, {})

  const report = {
    auditedAt: state.auditedAt,
    target: state.target,
    summary: {
      totalFindings: sortedFindings.length,
      bySeverity,
    },
    metrics: state.metrics,
    aiCrawlerTokens: AI_TOKENS,
    findings: sortedFindings,
    aiCrawlerExamples: {
      allowAll: [
        'User-agent: GPTBot',
        'Allow: /',
        'User-agent: ChatGPT-User',
        'Allow: /',
      ].join('\n'),
      blockTrainingCrawlers: [
        'User-agent: GPTBot',
        'Disallow: /',
        'User-agent: ClaudeBot',
        'Disallow: /',
        'User-agent: PerplexityBot',
        'Disallow: /',
        'User-agent: Bytespider',
        'Disallow: /',
        'User-agent: Google-Extended',
        'Disallow: /',
      ].join('\n'),
      selectivePolicy: [
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin/',
        'User-agent: GPTBot',
        'Disallow: /private/',
        'Allow: /public/',
        'User-agent: ChatGPT-User',
        'Allow: /public/',
      ].join('\n'),
    },
  }

  console.log(JSON.stringify(report, null, 2)) // eslint-disable-line no-console
}

run().catch((error) => {
  console.error(`Audit failed: ${error.message}`) // eslint-disable-line no-console
  process.exit(1)
})
