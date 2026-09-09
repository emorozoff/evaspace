/* Иконки — простые контуры, рисуются вектором и не грузятся из сети. */

const S = ({ children, size = 22, fill = 'none', ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...rest}>
    {children}
  </svg>
);

export const IcHome = (p) => (
  <S {...p}><path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" /></S>
);
export const IcCalendar = (p) => (
  <S {...p}><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></S>
);
export const IcTeam = (p) => (
  <S {...p}><circle cx="9" cy="9" r="3.2" /><path d="M3.5 19.5c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6" /><path d="M16 6.4a3 3 0 0 1 0 5.6M17.5 15.2c2 .6 3.2 2.1 3.6 4.3" /></S>
);
export const IcPeople = (p) => (
  <S {...p}><circle cx="12" cy="8" r="3.4" /><path d="M5 20c.7-3.7 3.4-5.6 7-5.6s6.3 1.9 7 5.6" /></S>
);
export const IcBook = (p) => (
  <S {...p}><path d="M4 5.5A2 2 0 0 1 6 3.5h13v14H6a2 2 0 0 0-2 2z" /><path d="M4 19.5a2 2 0 0 1 2-2h13v3H6a2 2 0 0 1-2-1z" /></S>
);
export const IcUser = (p) => (
  <S {...p}><circle cx="12" cy="8.5" r="3.6" /><path d="M4.8 20c.8-3.6 3.6-5.5 7.2-5.5s6.4 1.9 7.2 5.5" /></S>
);
export const IcBell = (p) => (
  <S {...p} size={p.size || 19}><path d="M6 9a6 6 0 0 1 12 0c0 4 1.2 5.4 1.8 6H4.2C4.8 14.4 6 13 6 9z" /><path d="M10 19a2 2 0 0 0 4 0" /></S>
);
export const IcBack = (p) => (<S {...p}><path d="M15 5 8 12l7 7" /></S>);
export const IcNext = (p) => (<S {...p} size={p.size || 18}><path d="M9 5l7 7-7 7" /></S>);
export const IcPlus = (p) => (<S {...p}><path d="M12 5v14M5 12h14" /></S>);
export const IcCheck = (p) => (<S {...p} size={p.size || 18}><path d="m5 12.5 4.5 4.5L19 7" /></S>);
export const IcClose = (p) => (<S {...p} size={p.size || 18}><path d="M6 6l12 12M18 6 6 18" /></S>);
export const IcSearch = (p) => (<S {...p} size={p.size || 18}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></S>);
export const IcShare = (p) => (
  <S {...p} size={p.size || 18}><path d="M12 15V4M8.5 7.5 12 4l3.5 3.5" /><path d="M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" /></S>
);
export const IcPlay = (p) => (<S {...p} fill="currentColor" stroke="none"><path d="M8 5.5v13l11-6.5z" /></S>);
export const IcPin = (p) => (
  <S {...p} size={p.size || 16}><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" /><circle cx="12" cy="10" r="2.4" /></S>
);
export const IcClock = (p) => (<S {...p} size={p.size || 16}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></S>);
export const IcLink = (p) => (
  <S {...p} size={p.size || 18}><path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.3-2.3a4 4 0 0 0-5.7-5.7L11.5 6.8" /><path d="M13.5 10.5a4 4 0 0 0-5.7 0l-2.3 2.3a4 4 0 1 0 5.7 5.7l1.3-1.3" /></S>
);
export const IcMoney = (p) => (
  <S {...p}><rect x="3" y="6" width="18" height="12" rx="3" /><circle cx="12" cy="12" r="2.6" /><path d="M6.5 9.5v5M17.5 9.5v5" /></S>
);
export const IcTrophy = (p) => (
  <S {...p}><path d="M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 5.5H4.5V7a3 3 0 0 0 3 3M17 5.5h2.5V7a3 3 0 0 1-3 3" /><path d="M12 14v3M8.5 20h7l-.8-3h-5.4z" /></S>
);
export const IcCoffee = (p) => (
  <S {...p}><path d="M4 8h13v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" /><path d="M17 9.5h1.5a2.5 2.5 0 0 1 0 5H17" /><path d="M7.5 3.5v2M11 3.5v2" /></S>
);
export const IcSpark = (p) => (
  <S {...p} fill="currentColor" stroke="none"><path d="M12 2.5c.9 5.1 3.5 7.7 8.6 8.6-5.1.9-7.7 3.5-8.6 8.6-.9-5.1-3.5-7.7-8.6-8.6 5.1-.9 7.7-3.5 8.6-8.6z" /></S>
);
export const IcCity = (p) => (
  <S {...p}><path d="M3 20h18" /><path d="M5 20V9l6-4v15" /><path d="M11 20V11h8v9" /><path d="M14.5 14.5h1M14.5 17.5h1M7.5 10.5h1M7.5 13.5h1M7.5 16.5h1" /></S>
);
export const IcEdit = (p) => (
  <S {...p} size={p.size || 18}><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" /><path d="M14.5 7.5 17 10" /></S>
);
export const IcOut = (p) => (
  <S {...p} size={p.size || 18}><path d="M14 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h7" /><path d="M17 8.5 20.5 12 17 15.5M20 12h-9" /></S>
);
export const IcDownload = (p) => (
  <S {...p} size={p.size || 18}><path d="M12 4v11M8 11.5l4 4 4-4" /><path d="M5 19h14" /></S>
);
export const IcFilter = (p) => (<S {...p} size={p.size || 18}><path d="M4 6h16M7 12h10M10 18h4" /></S>);
export const IcFire = (p) => (
  <S {...p} size={p.size || 16}><path d="M12 3c3.5 3.2 5.5 5.8 5.5 8.8A5.5 5.5 0 0 1 12 21a5.5 5.5 0 0 1-5.5-5.2c0-2.2 1-3.6 2.4-5 .2 1.3.8 2.1 1.7 2.4C10 10.4 10.6 6.9 12 3z" /></S>
);

export const NAV_ICONS = { home: IcHome, calendar: IcCalendar, team: IcTeam, people: IcPeople, book: IcBook, user: IcUser };
