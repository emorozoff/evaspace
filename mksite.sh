#!/bin/sh
# Собирает папку site/ так же, как это делает GitHub Actions: приложение,
# манифест, service worker, иконки и шрифты рядом. Для локальной проверки.
set -e
python3 build.py
rm -rf site && mkdir -p site/fonts
cp dist/index.html site/
cp manifest.json sw.js icon.svg *.png site/
cp fonts/*.woff2 site/fonts/
cp dist/index.html site/404.html
touch site/.nojekyll
echo "site/ готова: $(du -sh site | cut -f1)"
