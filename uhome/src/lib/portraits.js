/* Портреты Евы и Адама — модная иллюстрация: тёплая кожа, тёмные волосы
   с золотыми бликами, тонкая золотая линия по силуэту. Чистый SVG без
   картинок из сети: одинаково чётко в 26 и в 160 пикселях.
   __ID__ заменяется на уникальный id экземпляра — градиенты не путаются,
   если на экране несколько портретов. */

const EVA = `
<defs>
  <radialGradient id="bg__ID__" cx="50%" cy="30%" r="78%">
    <stop offset="0%" stop-color="#4a3824"/><stop offset="100%" stop-color="#110d09"/>
  </radialGradient>
  <linearGradient id="gd__ID__" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#f3e0b4"/><stop offset="100%" stop-color="#b8935a"/>
  </linearGradient>
  <linearGradient id="sk__ID__" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#f1d6be"/><stop offset="100%" stop-color="#dcb495"/>
  </linearGradient>
  <linearGradient id="hr__ID__" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#3a2618"/><stop offset="55%" stop-color="#22160e"/><stop offset="100%" stop-color="#140c07"/>
  </linearGradient>
  <linearGradient id="lp__ID__" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#c7766c"/><stop offset="100%" stop-color="#a95a52"/>
  </linearGradient>
  <radialGradient id="bl__ID__" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#e48f84" stop-opacity=".45"/><stop offset="100%" stop-color="#e48f84" stop-opacity="0"/>
  </radialGradient>
</defs>
<rect width="120" height="120" fill="url(#bg__ID__)"/>
<!-- волосы сзади: объёмные волны ниже плеч -->
<path d="M57 14c-19 0-30 14-31 32-1 11 2 20-2 30-3 8-9 13-8 22 1 8 8 12 14 11 3 8 12 10 18 5l-3-17 30 0-2 17c6 5 15 3 18-5 6 1 13-3 14-11 1-9-5-14-8-22-4-10-1-19-2-30-1-18-12-32-38-32Z" fill="url(#hr__ID__)"/>
<path d="M30 60c-2 10-8 16-9 26M90 58c2 10 8 18 9 28M34 80c-3 8-2 14 2 20M87 78c3 8 2 15-2 21" fill="none" stroke="url(#gd__ID__)" stroke-width=".7" opacity=".55"/>
<!-- шея и плечи -->
<path d="M52 76c0 6-1 10-3 12-8 3-18 6-24 16-2 4-3 10-3 16h76c0-6-1-12-3-16-6-10-16-13-24-16-2-2-3-6-3-12Z" fill="url(#sk__ID__)"/>
<path d="M52 83c3 3 5 4 8 4s5-1 8-4" fill="none" stroke="#b98d70" stroke-width=".6" opacity=".6"/>
<!-- платье: открытые плечи -->
<path d="M22 120c1-8 3-13 6-16 10 4 20 9 32 9s22-5 32-9c3 3 5 8 6 16Z" fill="#17120d"/>
<path d="M28 104c10 4 20 9 32 9s22-5 32-9" fill="none" stroke="url(#gd__ID__)" stroke-width=".9"/>
<!-- цепочка с каплей -->
<path d="M49 89c4 5 8 7 11 7s7-2 11-7" fill="none" stroke="url(#gd__ID__)" stroke-width=".55"/>
<path d="M60 96v1.6" stroke="url(#gd__ID__)" stroke-width=".55"/>
<path d="M60 97.6c1.4 1.6 1.4 3.2 0 4-1.4-.8-1.4-2.4 0-4Z" fill="url(#gd__ID__)"/>
<!-- лицо -->
<path d="M60 27c-12 0-18.5 9.5-18.5 22 0 7 1.5 13 4.5 18 3.5 6 8.5 11 14 11s10.5-5 14-11c3-5 4.5-11 4.5-18 0-12.5-6.5-22-18.5-22Z" fill="url(#sk__ID__)"/>
<ellipse cx="49" cy="63" rx="5.5" ry="3.6" fill="url(#bl__ID__)"/>
<ellipse cx="71" cy="63" rx="5.5" ry="3.6" fill="url(#bl__ID__)"/>
<!-- уши и серьги-капли -->
<path d="M41.8 53c-2.2-.6-3.2 1.4-2.6 4 .5 2.4 1.8 3.8 3.4 3.8" fill="#e2bfa2"/>
<path d="M40.7 61.2v3" stroke="url(#gd__ID__)" stroke-width=".6"/>
<path d="M40.7 64.4c1.9 2.2 1.9 4.4 0 5.6-1.9-1.2-1.9-3.4 0-5.6Z" fill="url(#gd__ID__)"/>
<!-- брови -->
<path d="M46.5 47.4c2.6-2.4 6.6-2.9 10-1.4" fill="none" stroke="#3a2618" stroke-width="1.15"/>
<path d="M63.5 46c3.4-1.5 7.4-1 10 1.4" fill="none" stroke="#3a2618" stroke-width="1.15"/>
<!-- глаза: миндаль, стрелки, блик -->
<path d="M47.6 53.6c2.8-2.6 7-2.6 9.4.2-2.6 1.8-6.6 1.8-9.4-.2Z" fill="#fbf4ec"/>
<path d="M63 53.8c2.4-2.8 6.6-2.8 9.4-.2-2.8 2-6.8 2-9.4.2Z" fill="#fbf4ec"/>
<circle cx="52.4" cy="53.6" r="2.15" fill="#4a2f1d"/><circle cx="67.6" cy="53.6" r="2.15" fill="#4a2f1d"/>
<circle cx="52.4" cy="53.6" r="1" fill="#120b06"/><circle cx="67.6" cy="53.6" r="1" fill="#120b06"/>
<circle cx="53.1" cy="52.9" r=".55" fill="#fff"/><circle cx="68.3" cy="52.9" r=".55" fill="#fff"/>
<path d="M47.3 53.8c2.9-3 7.2-3.1 9.9-.2M63 53.6c2.7-2.9 7-2.8 9.9.2" fill="none" stroke="#1d130c" stroke-width="1.3"/>
<path d="M47.6 53.4l-2.6-1.9 3.4.9ZM72.4 53.4l2.6-1.9-3.4.9Z" fill="#1d130c"/>
<path d="M48.6 55.2c2.2 1 5.4 1.1 7.6.2M63.8 55.4c2.2.9 5.4.8 7.6-.2" fill="none" stroke="#b98d70" stroke-width=".45" opacity=".6"/>
<!-- нос -->
<path d="M60.6 55.5c.3 3.2 1 5.6 2 7-.9 1-2.6 1.2-4 .6" fill="none" stroke="#b98d70" stroke-width=".8"/>
<!-- губы: полные, лёгкая улыбка -->
<path d="M54 68.4c1.8-1.5 3.8-2.2 5-1.3.6.3 1.4.3 2 0 1.2-.9 3.2-.2 5 1.3-1.9.4-3.7.8-6 .8s-4.1-.4-6-.8Z" fill="url(#lp__ID__)"/>
<path d="M54 68.4c2 .4 3.9.8 6 .8s4-.4 6-.8c-1.4 2.8-3.6 4.2-6 4.2s-4.6-1.4-6-4.2Z" fill="url(#lp__ID__)" opacity=".92"/>
<path d="M54 68.4c2 .5 4 .8 6 .8s4-.3 6-.8" fill="none" stroke="#7d3f39" stroke-width=".5"/>
<path d="M57.4 70.6c1.6.5 3.6.5 5.2 0" fill="none" stroke="#f3c2b6" stroke-width=".55" opacity=".7"/>
<!-- чёлка набок с пробором -->
<path d="M52 24c-9 2-14 10-14.5 20-.4 8 1 15 3.4 21 .4-7 .6-13 2.4-18 3-8 10-13 18-15 5 5 12 7 19 7-1-8-8-16-28.3-15Z" fill="url(#hr__ID__)"/>
<path d="M52 24c14-4 26 4 28 15 1 6 0 12-2 17 0-6-1-10-3-14" fill="url(#hr__ID__)"/>
<path d="M42 48c2-10 9-16 18-18M46 36c4-4 9-6 14-6M62 26c8 1 14 6 16 13" fill="none" stroke="url(#gd__ID__)" stroke-width=".6" opacity=".7"/>
<!-- силуэт золотой линией -->
<path d="M57 14c-19 0-30 14-31 32-1 11 2 20-2 30-3 8-9 13-8 22M57 14c26 0 37 14 38 32 1 11-2 20 2 30 3 8 9 14 8 22" fill="none" stroke="url(#gd__ID__)" stroke-width=".7" opacity=".6"/>
`;

const ADAM = `
<defs>
  <radialGradient id="bg__ID__" cx="50%" cy="30%" r="78%">
    <stop offset="0%" stop-color="#2c3440"/><stop offset="100%" stop-color="#0c0e11"/>
  </radialGradient>
  <linearGradient id="gd__ID__" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#f3e0b4"/><stop offset="100%" stop-color="#b8935a"/>
  </linearGradient>
  <linearGradient id="sk__ID__" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#e6c3a4"/><stop offset="100%" stop-color="#cfa27f"/>
  </linearGradient>
  <linearGradient id="hr__ID__" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#3b2a1d"/><stop offset="100%" stop-color="#150e09"/>
  </linearGradient>
  <linearGradient id="st__ID__" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#5a4232" stop-opacity=".0"/><stop offset="45%" stop-color="#5a4232" stop-opacity=".38"/><stop offset="100%" stop-color="#4a3528" stop-opacity=".55"/>
  </linearGradient>
</defs>
<rect width="120" height="120" fill="url(#bg__ID__)"/>
<!-- шея -->
<path d="M51 72v11c3 3 6 4 9 4s6-1 9-4V72Z" fill="#c89b79"/>
<g transform="translate(0 -4)">
<!-- рубашка с открытым воротом -->
<path d="M22 120c2-14 9-24 22-29l16 8 16-8c13 5 20 15 22 29Z" fill="#eae3d6"/>
<path d="M44 91l7-6 9 14 9-14 7 6-9 9-7-1-7 1Z" fill="#f6f1e8"/>
<path d="M51 85l9 14 9-14" fill="none" stroke="#b9ad99" stroke-width=".7"/>
<!-- пиджак -->
<path d="M22 120c2-14 9-24 22-29l10 17 3 12Z" fill="#1c2129"/>
<path d="M98 120c-2-14-9-24-22-29l-10 17-3 12Z" fill="#1c2129"/>
<path d="M44 91l10 17 3 12M76 91l-10 17-3 12" fill="none" stroke="url(#gd__ID__)" stroke-width=".85"/>
<rect x="20" y="119" width="80" height="6" fill="#1c2129"/>
<path d="M57 119h6v6h-6Z" fill="#eae3d6"/>
</g>
<!-- уши -->
<path d="M42 50c-3-1-4.4 1.6-3.6 5 .7 3 2.4 4.8 4.4 4.6" fill="#d7ad8b"/>
<path d="M78 50c3-1 4.4 1.6 3.6 5-.7 3-2.4 4.8-4.4 4.6" fill="#d7ad8b"/>
<!-- лицо: сильная челюсть -->
<path d="M60 25c-11.5 0-18 8.5-18 21 0 8 .8 14 3 19 2.6 6 5 9.5 8 11.5 2.4 1.6 4.6 2.3 7 2.3s4.6-.7 7-2.3c3-2 5.4-5.5 8-11.5 2.2-5 3-11 3-19 0-12.5-6.5-21-18-21Z" fill="url(#sk__ID__)"/>
<!-- щетина -->
<path d="M43.4 58c.6 6 2 10 4.6 13.6 2.6 3.6 5.4 6 12 6.3 6.6-.3 9.4-2.7 12-6.3 2.6-3.6 4-7.6 4.6-13.6-1.6 5-3.6 7.4-6.6 8.4-2.2-1.8-6-2.6-10-2.6s-7.8.8-10 2.6c-3-1-5-3.4-6.6-8.4Z" fill="url(#st__ID__)"/>
<!-- волосы: зачёс вверх и назад, короткие виски -->
<path d="M41.6 49c-1.4-6-1-12 2-17 4-7 11-11 19-10.5 8 .4 14 4.5 16.5 11 1.8 4.7 1.6 10.5.4 16.5-1-5-2.4-8.6-4.5-11-3.2 1.4-7.4 1.8-12 1.2-5.5-.7-10.4-2.5-14-2-3.4 2.6-5.8 6.6-7.4 11.8Z" fill="url(#hr__ID__)"/>
<path d="M47 31c5-5 12-7 19-5M50 28c6-3 14-3 20 1M44 38c3-4 7-6 11-7" fill="none" stroke="url(#gd__ID__)" stroke-width=".6" opacity=".7"/>
<!-- брови: прямые, уверенные -->
<path d="M46.4 47.2c3-1.4 6.8-1.6 10-.6" fill="none" stroke="#2a1c12" stroke-width="1.7"/>
<path d="M63.6 46.6c3.2-1 7-.8 10 .6" fill="none" stroke="#2a1c12" stroke-width="1.7"/>
<!-- глаза -->
<path d="M47.6 52.8c2.6-2 6.6-2 8.8.2-2.6 1.4-6.2 1.4-8.8-.2Z" fill="#f6efe6"/>
<path d="M63.6 53c2.2-2.2 6.2-2.2 8.8-.2-2.6 1.6-6.2 1.6-8.8.2Z" fill="#f6efe6"/>
<circle cx="52.2" cy="52.8" r="1.85" fill="#3f2a1b"/><circle cx="67.8" cy="52.8" r="1.85" fill="#3f2a1b"/>
<circle cx="52.2" cy="52.8" r=".85" fill="#0f0905"/><circle cx="67.8" cy="52.8" r=".85" fill="#0f0905"/>
<circle cx="52.8" cy="52.2" r=".45" fill="#fff"/><circle cx="68.4" cy="52.2" r=".45" fill="#fff"/>
<path d="M47.4 52.9c2.8-2.5 7-2.5 9.2.1M63.4 53c2.2-2.6 6.4-2.6 9.2-.1" fill="none" stroke="#24170e" stroke-width=".9"/>
<path d="M48.6 55.4c1.8.8 4.6.9 6.6.2M64.8 55.6c2 .7 4.8.6 6.6-.2" fill="none" stroke="#b58866" stroke-width=".5" opacity=".7"/>
<!-- нос -->
<path d="M60.4 54c.4 3.6 1.4 6.4 2.4 8.2-1 1.2-3.2 1.4-4.8.6" fill="none" stroke="#a97c5c" stroke-width=".9"/>
<!-- губы: лёгкая улыбка -->
<path d="M54.4 67.6c1.8.6 3.8.4 5.6.1 1.8.3 3.8.5 5.6-.1-1.6 2.6-3.6 3.6-5.6 3.6s-4-1-5.6-3.6Z" fill="#b47a66"/>
<path d="M54 67.4c2 .9 4 .9 6 .5 2 .4 4 .4 6-.5" fill="none" stroke="#6e4033" stroke-width=".7"/>
<path d="M53.4 66.6l.8 1M66.6 66.6l-.8 1" fill="none" stroke="#6e4033" stroke-width=".5"/>
`;

export function portraitSvg(who, id) {
  return (who === 'adam' ? ADAM : EVA).replace(/__ID__/g, id);
}
