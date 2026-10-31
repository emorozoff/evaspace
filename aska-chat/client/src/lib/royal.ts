// 👑 «Царская особа»: царские слова и обращения в интерфейсе. Включается вместе со стилем (applyDesign → onApplyDesign).
// Меняем только надписи интерфейса (кнопки, вкладки, заголовки, подсказки) — точным совпадением строки.
// Переписку, стены, имена и всё, что пишут люди, не трогаем (.txt, записи, поля ввода). Выключили стиль — слова возвращаются.
import { onApplyDesign } from './aska.ts';

// Надпись целиком → царская надпись
export const ROYAL_WORDS: Record<string, string> = {
  // вкладки и разделы
  'Чаты': 'Грамоты', 'Стена': 'Площадь', 'Круги': 'Палаты', 'Номера': 'Гербы', 'Мой ИИ': 'Писарь', 'Ещё': 'Двор', 'Контакты': 'Свита',
  'Стена АСЬКИ': 'Площадь АСЬКИ', '🌐 Стена АСЬКИ': '🌐 Площадь АСЬКИ', '🏠 Моя': '🏰 Мои покои', '🏆 Лучшее': '🏆 Слава',
  'Личное': 'Покои', '🏠 Личное': '🏰 Покои',
  // группы контактов
  '✨ ИИ-друзья': '✨ Придворные ИИ', 'ИИ-друзья': 'Придворные ИИ', '💛 Ближний круг': '💛 Ближние бояре', 'Ближний круг': 'Ближние бояре',
  '👋 Знакомства': '👋 Гости двора', 'Знакомства': 'Гости двора', '⭕ Мои круги': '⭕ Мои палаты', 'Мои круги': 'Мои палаты',
  // действия
  'Отправить': 'Повелеваю', 'Ответить': 'Ответствовать', 'Отмена': 'Отставить', 'Сохранить': 'Утвердить', 'Удалить': 'Предать забвению',
  'Скопировать': 'Списать', 'Войти': 'Войти во дворец', '➕ Позвать друга': '➕ Призвать ко двору', 'Позвать друга': 'Призвать ко двору',
  'Присоединиться': 'Явиться', 'Сменить': 'Повелеть сменить', 'Отправить ещё раз': 'Послать гонца снова',
  // состояния
  'в сети': 'при дворе', 'не в сети': 'в отъезде', 'В сети': 'При дворе', 'Не в сети': 'В отъезде', 'Подключение…': 'Седлаем коней…', 'печатает…': 'пишет грамоту…', 'нет связи': 'гонец не доскакал',
  // окна
  'Мой профиль': 'Моя родословная', 'Управление АСЬКОЙ': 'Царская канцелярия', '👑 Управление АСЬКОЙ': '👑 Царская канцелярия',
  'Вид — стиль АСЬКИ': 'Убранство АСЬКИ', 'Сообщение': 'Грамота', 'Правила АСЬКИ': 'Уложение АСЬКИ',
  '📞 Входящий звонок': '📞 Гонец с вестью: звонят', 'Завершить': 'Отпустить', 'Без звука': 'Молчать', 'Отклонить': 'Отказать',
};

// Подсказки в полях ввода
const ROYAL_PLACEHOLDERS: Record<string, string> = {
  'Напиши что-нибудь…': 'Изволите молвить, Ваше Величество…',
  'Напиши что-нибудь… Enter — отправить': 'Изволите молвить, Ваше Величество… Enter — повелеть',
};

// Надписи с переменной частью
const ROYAL_PATTERNS: [RegExp, string][] = [
  [/^в сети · (.+)$/, 'при дворе · $1'],
  [/^не в сети · (.+)$/, 'в отъезде · $1'],
  [/^(\d+) (участник|участника|участников), в сети (\d+)$/, '$1 при дворе, явились $3'],
];

// Где ничего не меняем: переписка, записи на стенах, комментарии, книги, поля ввода
const SKIP = '.txt, .aska-quote, .post-body, .ptext, .aska-post-text, .aska-comment, .cmt, .np, .aska-book, .aska-history, textarea, input, select, [contenteditable], script, style, .aska-me .nick, .citem .nick, .call-name, .call-person span';

let on = false;
const original = new Map<Text, string>(); // узел → прежняя надпись (чтобы вернуть)
let observer: MutationObserver | null = null;

export function royalWord(text: string): string | null {
  const k = text.trim();
  if (!k) return null;
  const w = ROYAL_WORDS[k];
  if (w) return text.replace(k, w);
  for (const [re, to] of ROYAL_PATTERNS) if (re.test(k)) return text.replace(k, k.replace(re, to));
  return null;
}

function fixText(node: Text) {
  const v = node.nodeValue || '';
  const parent = node.parentElement;
  if (!parent || parent.closest(SKIP)) return;
  const r = royalWord(v);
  if (r === null || r === v) return;
  if (!original.has(node)) original.set(node, v);
  node.nodeValue = r;
}

function fixPlaceholder(el: Element) {
  const ph = el.getAttribute('placeholder');
  if (!ph) return;
  const r = ROYAL_PLACEHOLDERS[ph];
  if (r) { el.setAttribute('data-ph', ph); el.setAttribute('placeholder', r); }
}

function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) { fixText(root as Text); return; }
  if (!(root instanceof Element)) return;
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) fixText(n as Text);
  if (root.hasAttribute('placeholder')) fixPlaceholder(root);
  root.querySelectorAll('[placeholder]').forEach(fixPlaceholder);
}

function enable() {
  if (on) return;
  on = true;
  walk(document.body);
  observer = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') {
        const t = m.target as Text;
        // React поменял текст сам — прежняя надпись больше не наша
        if (original.has(t) && royalWord(original.get(t)!) !== t.nodeValue) original.delete(t);
        fixText(t);
      } else if (m.type === 'attributes' && m.target instanceof Element) {
        const el = m.target;
        if (el.getAttribute('placeholder') !== ROYAL_PLACEHOLDERS[el.getAttribute('data-ph') || '']) fixPlaceholder(el);
      } else m.addedNodes.forEach(walk);
    }
    // ушедшие со страницы узлы не держим
    if (original.size > 2000) for (const n of original.keys()) if (!n.isConnected) original.delete(n);
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder'] });
}

function disable() {
  if (!on) return;
  on = false;
  observer?.disconnect();
  observer = null;
  for (const [n, v] of original) if (n.isConnected && royalWord(v) === n.nodeValue) n.nodeValue = v;
  original.clear();
  document.querySelectorAll('[data-ph]').forEach((el) => { el.setAttribute('placeholder', el.getAttribute('data-ph') || ''); el.removeAttribute('data-ph'); });
}

onApplyDesign((d) => { if (d === 'royal') enable(); else disable(); });
