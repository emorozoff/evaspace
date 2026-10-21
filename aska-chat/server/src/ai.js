// «Мозг» ботов — Claude. Ключ, модель и дневной лимит администратор задаёт в настройках АСЬКИ
// (хранятся на сервере, наружу не отдаются). Нет ключа или кончился лимит — боты отвечают по шпаргалке.
import Anthropic from '@anthropic-ai/sdk';
import { getSetting, setSetting } from './db.js';

export const MODELS = [
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5', note: 'умнее всех · $4 / $20 за 1 млн токенов' },
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', note: 'быстрее и дешевле · $2 / $10' },
  { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', note: 'самый дешёвый · $0.10 / $0.50' },
];
const DEFAULT_MODEL = 'claude-opus-5-5';
const DEFAULT_LIMIT = 400;

const today = () => new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10); // день по Москве

// Из текста ответа достаём JSON, даже если модель обернула его словами
function parseJson(text) {
  try { return JSON.parse(text); } catch { /* ищем фигурные скобки */ }
  const a = text.indexOf('{');
  const b = text.lastIndexOf('}');
  if (a >= 0 && b > a) {
    try { return JSON.parse(text.slice(a, b + 1)); } catch { /* не JSON */ }
  }
  return null;
}

export function createAi({ db, impl, fetchImpl, log = console.log }) {
  const conf = () => JSON.parse(getSetting(db, 'ai') || '{}');
  let lastError = '';
  let active = 0;
  const queue = [];

  const usage = () => {
    const u = JSON.parse(getSetting(db, 'ai_usage') || '{}');
    return u.day === today() ? u : { day: today(), calls: 0, input: 0, output: 0 };
  };
  const bump = (input, output) => {
    const u = usage();
    setSetting(db, 'ai_usage', JSON.stringify({ day: u.day, calls: u.calls + 1, input: u.input + (input || 0), output: u.output + (output || 0) }));
  };

  const model = () => conf().model || DEFAULT_MODEL;
  const limit = () => conf().dailyLimit || DEFAULT_LIMIT;
  const configured = () => Boolean(impl) || Boolean(conf().apiKey);
  const available = () => configured() && !conf().paused && usage().calls < limit();

  let client = null;
  let clientKey = '';
  function getClient() {
    const key = conf().apiKey;
    if (!client || clientKey !== key) {
      client = new Anthropic({ apiKey: key, maxRetries: 1, timeout: 60_000, ...(fetchImpl ? { fetch: fetchImpl } : {}) });
      clientKey = key;
    }
    return client;
  }

  function explain(e) {
    if (e instanceof Anthropic.AuthenticationError) return 'Ключ не подходит (401)';
    if (e instanceof Anthropic.PermissionDeniedError) return 'Доступ запрещён (403): у ключа нет прав или запрос идёт из неподдерживаемой страны';
    if (e instanceof Anthropic.NotFoundError) return 'Модель не найдена (404)';
    if (e instanceof Anthropic.RateLimitError) return 'Слишком много запросов или кончились деньги на счёте (429)';
    if (e instanceof Anthropic.BadRequestError) return `Claude не принял запрос (400): ${e.message}`.slice(0, 300);
    if (e instanceof Anthropic.APIConnectionError) return 'Нет связи с Claude (сервер не достучался до api.anthropic.com)';
    if (e instanceof Anthropic.APIError) return `Ошибка Claude ${e.status || ''}: ${e.message}`.slice(0, 300);
    return String(e?.message || e).slice(0, 300);
  }

  async function callClaude({ system, prompt, schema, maxTokens }) {
    const m = model();
    const params = {
      model: m,
      max_tokens: maxTokens || 4000,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: prompt }],
      // Болтовня — низкое усилие: быстрее и дешевле. Ответ — строго по схеме JSON.
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
    };
    // Если модель откажется отвечать, Claude сам попробует запасную (у Haiku такой возможности нет)
    if (m !== 'claude-haiku-5-5') {
      params.betas = ['server-side-fallback-2026-07-01'];
      params.fallbacks = 'default';
    }
    let res;
    try {
      res = await getClient().beta.messages.create(params);
    } catch (e) {
      if (!(e instanceof Anthropic.BadRequestError)) throw e;
      // Запасной путь: без схемы и без запасной модели — JSON просим словами
      log('ai: повтор без схемы —', e.message);
      const { betas, fallbacks, ...plain } = params;
      res = await getClient().messages.create({ ...plain, output_config: { effort: 'low' }, system: `${system}\n\nОтвечай ТОЛЬКО JSON по схеме: ${JSON.stringify(schema)}` });
    }
    bump(res.usage?.input_tokens, res.usage?.output_tokens);
    if (res.stop_reason === 'refusal') return null;
    const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    return parseJson(text);
  }

  // Не больше двух запросов одновременно: сервер маленький
  function slot() {
    if (active < 2) { active += 1; return Promise.resolve(); }
    return new Promise((resolve) => queue.push(resolve));
  }
  function release() {
    const next = queue.shift();
    if (next) next(); else active -= 1;
  }

  async function complete(req) {
    if (!available()) return null;
    await slot();
    try {
      const out = impl ? await impl(req) : await callClaude(req);
      if (impl) bump(0, 0);
      lastError = '';
      return out && typeof out === 'object' ? out : null;
    } catch (e) {
      lastError = explain(e);
      log('ai error:', lastError);
      return null;
    } finally {
      release();
    }
  }

  async function check() {
    if (!configured()) return { ok: false, error: 'Ключ не задан' };
    const schema = { type: 'object', properties: { reply: { type: 'string' } }, required: ['reply'], additionalProperties: false };
    try {
      const out = impl
        ? await impl({ system: 'check', prompt: 'check', schema })
        : await callClaude({ system: 'Ты проверяешь связь. Ответь одним коротким приветствием по-русски.', prompt: 'Привет! Проверка связи.', schema, maxTokens: 2000 });
      if (!out) return { ok: false, error: 'Пустой ответ' };
      lastError = '';
      return { ok: true, reply: String(out.reply || 'ок') };
    } catch (e) {
      lastError = explain(e);
      return { ok: false, error: lastError };
    }
  }

  function setConfig(patch) {
    const c = { ...conf(), ...patch };
    if (patch.apiKey === '') delete c.apiKey;
    if (!MODELS.some((m) => m.id === c.model)) delete c.model;
    setSetting(db, 'ai', JSON.stringify(c));
    client = null;
  }

  function status() {
    const c = conf();
    return {
      configured: configured(), hasKey: Boolean(c.apiKey), keyHint: c.apiKey ? `…${c.apiKey.slice(-4)}` : '',
      model: model(), models: MODELS, dailyLimit: limit(), usedToday: usage().calls, paused: Boolean(c.paused), lastError,
    };
  }

  return { complete, check, available, configured, setConfig, status };
}
