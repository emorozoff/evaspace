#!/usr/bin/env python3
"""Сборка штаба Eva Club V2 в один файл.

Исходники лежат по блокам в src/:
  head.html        — <title> и шрифты (должны стоять в первых 8 КБ файла)
  styles/*.css     — стили по порядку имени: токены → база → оболочка → компоненты → страницы
  body.html        — корневая разметка
  app/*.js         — код по порядку имени: ядро → данные → вход → интерфейс → страницы → запуск

На выходе — eva-club-v2.html: тело страницы без <!doctype> и <head>.
Этот же файл публикуется артефактом Claude (обёртку добавляет площадка),
а index.html подставляет обёртку сам для GitHub Pages и локального сервера.

Запуск:  python3 build.py          — собрать
         python3 build.py --check  — собрать и проверить синтаксис JS через node
"""
from collections import defaultdict
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parent
SRC = ROOT / 'src'
OUT = ROOT / 'eva-club-v2.html'


def read(p: Path) -> str:
    return p.read_text(encoding='utf-8')


def build() -> str:
    head = read(SRC / 'head.html').strip()
    css = '\n'.join(f'/* ── {p.name} ── */\n{read(p).strip()}\n'
                    for p in sorted((SRC / 'styles').glob('*.css')))
    js = '\n'.join(f'/* ── {p.name} ── */\n{read(p).strip()}\n'
                   for p in sorted((SRC / 'app').glob('*.js')))
    body = read(SRC / 'body.html').strip()
    return (f"{head}\n<style>\n{css}</style>\n{body}\n"
            f"<script>\n(() => {{\n'use strict';\n{js}}})();\n</script>\n")


def check_names() -> None:
    """Модули живут в одной области видимости: одинаковое имя верхнего уровня
    в двух файлах молча перекрывает одно другим (function) — ловим заранее."""
    seen = defaultdict(list)
    pat = re.compile(r'^(?:async\s+)?function\s+(\w+)|^(?:const|let|var|class)\s+(\w+)')
    for p in sorted((SRC / 'app').glob('*.js')):
        for line in read(p).splitlines():
            m = pat.match(line)
            if m:
                seen[m.group(1) or m.group(2)].append(p.name)
    dup = {k: v for k, v in seen.items() if len(v) > 1}
    if dup:
        for k, v in dup.items():
            print(f'имя {k} объявлено дважды: {", ".join(v)}')
        sys.exit(1)
    print('имена модулей не пересекаются')


def check(html: str) -> None:
    check_names()
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


if __name__ == '__main__':
    html = build()
    OUT.write_text(html, encoding='utf-8')
    print(f'{OUT.name}: {len(html.encode("utf-8")) // 1024} КБ')
    if '--check' in sys.argv:
        check(html)
