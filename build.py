#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Сборка Eva Space из исходников в один файл.

    python3 build.py                  → dist/index.html
    python3 build.py --check файл.html → сверить сборку с готовым файлом

Приложение отдаётся хостингу и браузеру одним файлом: так его проще залить
через файловый менеджер и невозможно получить полурабочую смесь версий.
Разработка при этом идёт по кускам в src/ — правки видно в маленьком диффе.
"""

import io, os, sys, hashlib

ROOT   = os.path.dirname(os.path.abspath(__file__))
SRC    = os.path.join(ROOT, 'src')
DIST   = os.path.join(ROOT, 'dist')
OUT    = os.path.join(DIST, 'index.html')

TEMPLATE = os.path.join(SRC, 'index.template.html')
STYLES   = os.path.join(SRC, 'styles.css')
APP_DIR  = os.path.join(SRC, 'app')

MARK_CSS = '<!--{{styles}}-->'
MARK_JS  = '<!--{{app}}-->'


def read(path):
    with io.open(path, encoding='utf-8', newline='') as f:
        return f.read()


def modules():
    """Файлы приложения в порядке загрузки — он задан именами: 01-, 02-, ..."""
    names = sorted(n for n in os.listdir(APP_DIR) if n.endswith('.js'))
    if not names:
        sys.exit('в src/app нет ни одного .js')
    return [os.path.join(APP_DIR, n) for n in names]


def build():
    html = read(TEMPLATE)
    for mark in (MARK_CSS, MARK_JS):
        if html.count(mark) != 1:
            sys.exit('в шаблоне нет метки %s (или их несколько)' % mark)

    js = ''.join(read(p) for p in modules())
    html = html.replace(MARK_CSS, read(STYLES))     # куски вставляются дословно,
    html = html.replace(MARK_JS, js)                # без единого лишнего символа
    return html


def main():
    html = build()
    check = '--check' in sys.argv

    if check:
        rest = [a for a in sys.argv[1:] if not a.startswith('-')]
        ref = rest[0] if rest else os.path.join(ROOT, 'index.html')
        if not os.path.exists(ref):
            sys.exit('нечем сверять: нет файла %s' % ref)
        same = hashlib.md5(html.encode('utf-8')).hexdigest() == \
               hashlib.md5(read(ref).encode('utf-8')).hexdigest()
        print('сборка совпадает с %s' % ref if same else 'РАСХОЖДЕНИЕ с %s' % ref)
        sys.exit(0 if same else 1)

    if not os.path.isdir(DIST):
        os.makedirs(DIST)
    with io.open(OUT, 'w', encoding='utf-8', newline='') as f:
        f.write(html)

    size = os.path.getsize(OUT)
    print('собрано: %s (%.0f КБ, модулей: %d)' % (OUT, size / 1024.0, len(modules())))


if __name__ == '__main__':
    main()
