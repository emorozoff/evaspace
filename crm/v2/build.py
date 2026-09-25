#!/usr/bin/env python3
"""Сборка Eva CRM 2.0: CRM команды и публичная анкета.

Исходники лежат по блокам в src/:
  head.html        — <title> и шрифты (должны стоять в первых 8 КБ файла)
  styles/*.css     — стили по порядку имени: токены → база → оболочка → компоненты → страницы
  body.html        — корневая разметка
  app/*.js         — код по порядку имени: ядро → данные → вход → интерфейс → страницы → запуск
  shared/*.js      — вопросы и упаковка ссылок: общие для CRM и анкеты
  anketa/          — публичная анкета: head, style, body, app

Оба файла — тело страницы без <!doctype> и <head>: их публикуют артефактами
Claude (обёртку добавляет площадка), index.html подставляет обёртку сам.

На выходе два файла: eva-crm-v2.html (CRM команды) и anketa.html (публичная
анкета). Адреса страниц друг друга подставляются из links.json.

Запуск:  python3 build.py          — собрать
         python3 build.py --check  — собрать и проверить синтаксис JS через node
"""
from pathlib import Path
import json
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parent
SRC = ROOT / 'src'
OUT = ROOT / 'eva-crm-v2.html'
OUT_A = ROOT / 'anketa.html'


def read(p: Path) -> str:
    return p.read_text(encoding='utf-8')


def build() -> str:
    head = read(SRC / 'head.html').strip()
    css = '\n'.join(f'/* ── {p.name} ── */\n{read(p).strip()}\n'
                    for p in sorted((SRC / 'styles').glob('*.css')))
    files = sorted((SRC / 'app').glob('*.js'))
    shared = sorted((SRC / 'shared').glob('*.js'))
    # общие вопросы и кодек — сразу после ядра и настроек
    files = files[:2] + shared + files[2:]
    js = '\n'.join(f'/* ── {p.name} ── */\n{read(p).strip()}\n' for p in files)
    body = read(SRC / 'body.html').strip()
    return (f"{head}\n<style>\n{css}</style>\n{body}\n"
            f"<script>\n(() => {{\n'use strict';\n{js}}})();\n</script>\n")


def check(html: str) -> None:
    node = shutil.which('node')
    if not node:
        print('node не найден — проверка синтаксиса пропущена')
        return
    start = html.rindex('<script>\n') + len('<script>\n')
    end = html.rindex('</script>')
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f:
        f.write(html[start:end])
        tmp = f.name
    res = subprocess.run([node, '--check', tmp], capture_output=True, text=True)
    if res.returncode:
        print(res.stderr)
        sys.exit(1)
    print('синтаксис JS в порядке')


def build_anketa() -> str:
    a = SRC / 'anketa'
    head = read(a / 'head.html').strip()
    css = read(a / 'style.css').strip()
    js = '\n'.join(f'/* ── {p.name} ── */\n{read(p).strip()}\n'
                   for p in [*sorted((SRC / 'shared').glob('*.js')), a / 'app.js'])
    body = read(a / 'body.html').strip()
    return (f"{head}\n<style>\n{css}\n</style>\n{body}\n"
            f"<script>\n(() => {{\n'use strict';\n{js}}})();\n</script>\n")


def with_links(html: str) -> str:
    """Адреса опубликованных страниц — из links.json (если он есть)."""
    import os
    f = ROOT / os.environ.get('EVA_LINKS', 'links.json')
    if not f.exists():
        return html
    links = json.loads(f.read_text(encoding='utf-8'))
    if links.get('crm'):
        html = html.replace('https://claude.ai/artifact/CRM_URL_PLACEHOLDER', links['crm'])
    if links.get('anketa'):
        html = html.replace('https://claude.ai/artifact/ANKETA_URL_PLACEHOLDER', links['anketa'])
    return html


if __name__ == '__main__':
    for out, html in ((OUT, with_links(build())), (OUT_A, with_links(build_anketa()))):
        out.write_text(html, encoding='utf-8')
        print(f'{out.name}: {len(html.encode("utf-8")) // 1024} КБ')
        if '--check' in sys.argv:
            check(html)
