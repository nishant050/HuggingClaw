import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const G = s => `\x1b[32m${s}\x1b[0m`;
const R = s => `\x1b[31m${s}\x1b[0m`;
const Y = s => `\x1b[33m${s}\x1b[0m`;
const B = s => `\x1b[1m${s}\x1b[0m`;

Object.assign(process.env, {
  ANTHROPIC_API_KEYS:'ant-k1,ant-k2,ant-k3', OPENAI_API_KEYS:'oai-k1,oai-k2,oai-k3',
  GEMINI_API_KEYS:'gem-k1,gem-k2,gem-k3', DEEPSEEK_API_KEYS:'dsk-k1,dsk-k2,dsk-k3',
  OPENROUTER_API_KEYS:'ort-k1,ort-k2,ort-k3', KILOCODE_API_KEYS:'kil-k1,kil-k2,kil-k3',
  OPENCODE_API_KEYS:'ocd-k1,ocd-k2,ocd-k3', ZAI_API_KEYS:'zai-k1,zai-k2,zai-k3',
  MOONSHOT_API_KEYS:'msn-k1,msn-k2,msn-k3', MINIMAX_API_KEYS:'mmx-k1,mmx-k2,mmx-k3',
  XIAOMI_API_KEYS:'xmi-k1,xmi-k2,xmi-k3', VOLCANO_ENGINE_API_KEYS:'vlc-k1,vlc-k2,vlc-k3',
  BYTEPLUS_API_KEYS:'btp-k1,btp-k2,btp-k3', MISTRAL_API_KEYS:'mst-k1,mst-k2,mst-k3',
  XAI_API_KEYS:'xai-k1,xai-k2,xai-k3', NVIDIA_API_KEYS:'nv-k1,nv-k2,nv-k3',
  GROQ_API_KEYS:'grq-k1,grq-k2,grq-k3', COHERE_API_KEYS:'coh-k1,coh-k2,coh-k3',
  TOGETHER_API_KEYS:'tgt-k1,tgt-k2,tgt-k3', CEREBRAS_API_KEYS:'crb-k1,crb-k2,crb-k3',
  HUGGINGFACE_HUB_TOKENS:'hf-k1,hf-k2,hf-k3',
});

// Mock fetch BEFORE loading rotator (rotator captures this as "originalFetch")
const fetchLog = [];
globalThis.fetch = async function mockFetch(input, init = {}) {
  const url = typeof input === 'string' ? input : input?.url ?? '?';
  const h = init?.headers ?? {};
  const auth = typeof h.get === 'function' ? h.get('authorization') : (h.authorization ?? null);
  fetchLog.push({ url, auth });
  return new Response('{}', { status: 200 });
};

// Mock http/https BEFORE loading rotator
const http = require('http');
const https = require('https');
const httpLog = [];
for (const mod of [http, https]) {
  mod.request = function mockReq(...args) {
    const opts = args[0];
    const hostname = typeof opts === 'string' ? new URL(opts).hostname : opts?.hostname ?? '?';
    const auth = opts?.headers?.authorization ?? null;
    httpLog.push({ hostname, auth });
    return { on() { return this; }, end() {}, write() {} };
  };
}

// Load rotator
console.log(B('\n── Loading rotator ─────────────────────────────────────\n'));
const origLog = console.log; const ll = [];
console.log = (...a) => ll.push(a.join(' '));
require('./multi-provider-key-rotator.cjs');
console.log = origLog;
ll.forEach(l => console.log('  ' + l));

const TESTS = [
  ['api.anthropic.com','ant-','Anthropic'],
  ['api.openai.com','oai-','OpenAI'],
  ['generativelanguage.googleapis.com','gem-','Gemini'],
  ['api.deepseek.com','dsk-','DeepSeek'],
  ['openrouter.ai','ort-','OpenRouter'],
  ['kilocode.ai','kil-','KiloCode'],
  ['opencode.ai','ocd-','OpenCode'],
  ['open.bigmodel.cn','zai-','Z.ai / GLM'],
  ['api.moonshot.cn','msn-','Moonshot'],
  ['api.minimax.chat','mmx-','MiniMax'],
  ['api.xiaomi.com','xmi-','Xiaomi'],
  ['ark.cn-beijing.volces.com','vlc-','Volcengine'],
  ['maas-api.ml-platform-cn-beijing.byteplus.com','btp-','BytePlus'],
  ['api.mistral.ai','mst-','Mistral'],
  ['api.x.ai','xai-','xAI / Grok'],
  ['integrate.api.nvidia.com','nv-','NVIDIA (integrate)'],
  ['api.nvidia.com','nv-','NVIDIA (api)'],
  ['api.groq.com','grq-','Groq'],
  ['api.cohere.com','coh-','Cohere'],
  ['api.cohere.ai','coh-','Cohere (alt)'],
  ['api.together.xyz','tgt-','Together'],
  ['api.cerebras.ai','crb-','Cerebras'],
  ['api-inference.huggingface.co','hf-','HuggingFace'],
];

console.log(B('\n── fetch() — 3 requests each (rotation check) ─────────\n'));
let passed = 0, failed = 0;

for (const [hostname, prefix, label] of TESTS) {
  fetchLog.length = 0;
  for (let i = 0; i < 3; i++) await globalThis.fetch(`https://${hostname}/v1/messages`, {});
  const keys = fetchLog.map(f => f.auth?.replace('Bearer ', '') ?? null);
  const ok = keys.every(k => k?.startsWith(prefix)) && keys[0] !== keys[1] && keys[1] !== keys[2];
  if (ok) { passed++; console.log(` ${G('✓')} ${label.padEnd(24)} ${keys.join(' → ')}`); }
  else    { failed++; console.log(` ${R('✗')} ${label.padEnd(24)} got: ${JSON.stringify(keys)}`); }
}

// Unknown host — no header
fetchLog.length = 0;
await globalThis.fetch('https://example.com/test', {});
const unk = fetchLog[0]?.auth ?? null;
if (!unk) { passed++; console.log(`\n ${G('✓')} ${'Unknown host'.padEnd(24)} correctly skipped`); }
else       { failed++; console.log(`\n ${R('✗')} ${'Unknown host'.padEnd(24)} wrongly injected: ${unk}`); }

console.log(B('\n── http.request() — direct options object ──────────────\n'));
const HTTP_TESTS = [
  ['api.anthropic.com','ant-','Anthropic'],
  ['api.openai.com','oai-','OpenAI'],
  ['api.mistral.ai','mst-','Mistral'],
  ['integrate.api.nvidia.com','nv-','NVIDIA'],
  ['api.groq.com','grq-','Groq'],
  ['api.x.ai','xai-','xAI'],
];
for (const [hostname, prefix, label] of HTTP_TESTS) {
  httpLog.length = 0;
  http.request({ hostname, path: '/v1', headers: {} });
  http.request({ hostname, path: '/v1', headers: {} });
  const keys = httpLog.map(e => e.auth?.replace('Bearer ', '') ?? null);
  const ok = keys.every(k => k?.startsWith(prefix)) && keys[0] !== keys[1];
  if (ok) { passed++; console.log(` ${G('✓')} ${label.padEnd(24)} ${keys.join(' → ')}`); }
  else    { failed++; console.log(` ${R('✗')} ${label.padEnd(24)} got: ${JSON.stringify(keys)}`); }
}

console.log(B('\n────────────────────────────────────────────────────────'));
const total = passed + failed;
console.log(` ${G(passed+'/'+total+' passed')}  ${failed ? R(failed+' failed') : ''}`);
if (failed === 0) console.log(` ${G('✓ Rotator sahi kaam kar raha hai — deploy karo!')}\n`);
else              console.log(` ${R('✗ Issues hain — upar dekho.')}\n`);
