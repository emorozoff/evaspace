// Набор иконок (линейные, 24×24). Один стиль на всё приложение.
const S = ({ children, size = 22, fill = 'none', sw = 1.7, ...p }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill}
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    {children}
  </svg>
);

export const IcHome = (p) => (
  <S {...p}>
    <path d="M3.6 10.4 12 3.8l8.4 6.6" />
    <path d="M5.5 9.8V19a1.4 1.4 0 0 0 1.4 1.4h10.2A1.4 1.4 0 0 0 18.5 19V9.8" />
    <path d="M9.6 20.4v-5.2h4.8v5.2" />
  </S>
);

export const IcLibrary = (p) => (
  <S {...p}>
    <path d="M4 5.4A1.4 1.4 0 0 1 5.4 4h4.2A2.4 2.4 0 0 1 12 6.4v13a2 2 0 0 0-2-2H5.4A1.4 1.4 0 0 1 4 16v-10.6Z" />
    <path d="M20 5.4A1.4 1.4 0 0 0 18.6 4h-4.2A2.4 2.4 0 0 0 12 6.4v13a2 2 0 0 1 2-2h4.6A1.4 1.4 0 0 0 20 16V5.4Z" />
  </S>
);

export const IcCourses = (p) => (
  <S {...p}>
    <path d="m12 4 9 4.6-9 4.6-9-4.6L12 4Z" />
    <path d="M6.4 10.6V16c0 1.6 2.5 3 5.6 3s5.6-1.4 5.6-3v-5.4" />
    <path d="M21 8.6v5.2" />
  </S>
);

export const IcMarket = (p) => (
  <S {...p}>
    <path d="M5.2 8h13.6l-1 11.2a1.6 1.6 0 0 1-1.6 1.4H7.8a1.6 1.6 0 0 1-1.6-1.4L5.2 8Z" />
    <path d="M8.8 10V7.2a3.2 3.2 0 0 1 6.4 0V10" />
  </S>
);

export const IcCommunity = (p) => (
  <S {...p}>
    <circle cx="9" cy="8.4" r="3" />
    <path d="M3.6 19.4c.5-2.9 2.8-4.6 5.4-4.6s4.9 1.7 5.4 4.6" />
    <path d="M16 5.8a2.9 2.9 0 0 1 0 5.6" />
    <path d="M17.6 14.6c1.9.5 3.2 2 3.5 4.1" />
  </S>
);

export const IcStar = ({ size = 20, filled = false, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" {...p}>
    <path d="m12 3.2 2.5 5.4 5.9.7-4.4 4 1.2 5.8L12 16.2 6.8 19.1 8 13.3l-4.4-4 5.9-.7L12 3.2Z" />
  </svg>
);

// Путеводная звезда — логотип
export const IcSparkStar = ({ size = 24, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M12 1.6c.5 4.5 1.4 7.1 3 8.6 1.5 1.5 4.1 2.3 7.4 1.8-3.3.5-5.9 1.3-7.4 2.8-1.6 1.5-2.5 4.1-3 8.6-.5-4.5-1.4-7.1-3-8.6-1.5-1.5-4.1-2.3-7.4-2.8 3.3.5 5.9-.3 7.4-1.8 1.6-1.5 2.5-4.1 3-8.6Z" />
  </svg>
);

export const IcPlay = ({ size = 22, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M8 5.4c0-.9 1-1.5 1.8-1L18.4 10c.7.5.7 1.5 0 2l-8.6 5.6c-.8.5-1.8-.1-1.8-1V5.4Z" />
  </svg>
);

export const IcCheck = (p) => (
  <S sw={2.4} {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </S>
);

export const IcBack = (p) => (
  <S sw={2} {...p}>
    <path d="M14.5 5 8 12l6.5 7" />
  </S>
);

export const IcNext = (p) => (
  <S sw={2} {...p}>
    <path d="M9.5 5 16 12l-6.5 7" />
  </S>
);

export const IcPlus = (p) => (
  <S sw={2} {...p}>
    <path d="M12 5.5v13M5.5 12h13" />
  </S>
);

export const IcClose = (p) => (
  <S sw={2} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </S>
);

export const IcMic = (p) => (
  <S {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
    <path d="M12 18v3" />
  </S>
);

export const IcSend = (p) => (
  <S {...p}>
    <path d="M20.5 3.5 10.8 13.2" />
    <path d="M20.5 3.5 14.4 20.8l-3.6-7.6-7.6-3.6L20.5 3.5Z" />
  </S>
);

export const IcCalendar = (p) => (
  <S {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 9.6h17M8 3v4M16 3v4" />
  </S>
);

export const IcGift = (p) => (
  <S {...p}>
    <rect x="3.5" y="8.5" width="17" height="4.5" rx="1.2" />
    <path d="M5 13v6a1.6 1.6 0 0 0 1.6 1.6h10.8A1.6 1.6 0 0 0 19 19v-6M12 8.5v12" />
    <path d="M12 8.5S10.8 3.5 8.4 3.5a2.4 2.4 0 0 0 0 5M12 8.5s1.2-5 3.6-5a2.4 2.4 0 0 1 0 5" />
  </S>
);

export const IcUser = (p) => (
  <S {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.6 20.2c.7-3.7 3.8-5.9 7.4-5.9s6.7 2.2 7.4 5.9" />
  </S>
);

export const IcLock = (p) => (
  <S {...p}>
    <rect x="4.6" y="10" width="14.8" height="10.4" rx="3" />
    <path d="M8.2 10V7.4a3.8 3.8 0 0 1 7.6 0V10" />
  </S>
);

export const IcHeart = ({ filled, ...p }) => (
  <S fill={filled ? 'currentColor' : 'none'} {...p}>
    <path d="M12 20s-7.4-4.4-7.4-9.3A4.2 4.2 0 0 1 12 8.2a4.2 4.2 0 0 1 7.4 2.5C19.4 15.6 12 20 12 20Z" />
  </S>
);

export const IcMessage = (p) => (
  <S {...p}>
    <path d="M20.4 12c0 4-3.8 7-8.4 7-1 0-2-.2-2.9-.4L4 20l1.3-3.6A6.6 6.6 0 0 1 3.6 12c0-4 3.8-7 8.4-7s8.4 3 8.4 7Z" />
  </S>
);

export const IcCart = (p) => (
  <S {...p}>
    <path d="M3 4.5h2.3l2.3 11.2h9.9l2.2-8.2H6.2" />
    <circle cx="9.6" cy="19.4" r="1.4" />
    <circle cx="17" cy="19.4" r="1.4" />
  </S>
);

export const IcSettings = (p) => (
  <S {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 14.4a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 0 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7h-.3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1v-.3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 0 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1.1Z" />
  </S>
);

export const IcSearch = (p) => (
  <S {...p}>
    <circle cx="11" cy="11" r="6.4" />
    <path d="m16 16 4.4 4.4" />
  </S>
);

export const IcClock = (p) => (
  <S {...p}>
    <circle cx="12" cy="12" r="8.4" />
    <path d="M12 7.4V12l3 1.8" />
  </S>
);

export const IcFlame = (p) => (
  <S {...p}>
    <path d="M12 21c3.6 0 6-2.4 6-5.6 0-4-3.4-5.6-3.4-9.4-2 1-2.8 3-2.8 4.6 0 1-.7 1.6-1.4 1.6-.9 0-1.4-.8-1.4-2-1.6 1.4-3 3.4-3 5.2C6 18.6 8.4 21 12 21Z" />
  </S>
);

export const IcWallet = (p) => (
  <S {...p}>
    <rect x="3.4" y="6" width="17.2" height="13" rx="3" />
    <path d="M3.4 10h17.2M16.4 14.6h1.6" />
  </S>
);

export const IcCrown = (p) => (
  <S {...p}>
    <path d="M4 17.6h16M4.6 7.2l3.6 3.4L12 5l3.8 5.6 3.6-3.4-1.4 8.2H6L4.6 7.2Z" />
  </S>
);

export const IcVideo = (p) => (
  <S {...p}>
    <rect x="3" y="6" width="12.6" height="12" rx="3" />
    <path d="m15.6 13 5.4 3.2V7.8L15.6 11v2Z" />
  </S>
);

export const IcSound = ({ off, ...p }) => (
  <S {...p}>
    <path d="M11 5.2 6.8 8.8H3.8v6.4h3l4.2 3.6V5.2Z" />
    {off ? <path d="m15.4 9.6 4.4 4.8M19.8 9.6l-4.4 4.8" /> : <path d="M14.8 9a4.2 4.2 0 0 1 0 6M17.4 6.6a7.6 7.6 0 0 1 0 10.8" />}
  </S>
);

export const IcShare = (p) => (
  <S {...p}>
    <path d="M12 15.6V3.8M8.4 7.2 12 3.6l3.6 3.6" />
    <path d="M5.4 12.4v6.4a1.6 1.6 0 0 0 1.6 1.6h10a1.6 1.6 0 0 0 1.6-1.6v-6.4" />
  </S>
);

export const IcTrash = (p) => (
  <S {...p}>
    <path d="M4.6 6.6h14.8M9.4 6.6V4.8a1.2 1.2 0 0 1 1.2-1.2h2.8a1.2 1.2 0 0 1 1.2 1.2v1.8" />
    <path d="M6.6 6.6 7.6 19a1.6 1.6 0 0 0 1.6 1.4h5.6a1.6 1.6 0 0 0 1.6-1.4l1-12.4" />
  </S>
);

export const IcFilter = (p) => (
  <S {...p}>
    <path d="M3.6 6.4h16.8M6.6 12h10.8M10 17.6h4" />
  </S>
);

export const IcMoon = (p) => (
  <S {...p}>
    <path d="M20 14.4A8.4 8.4 0 0 1 9.6 4 8.4 8.4 0 1 0 20 14.4Z" />
  </S>
);

export const IcBolt = (p) => (
  <S {...p}>
    <path d="M13.4 3 5.6 13.4h5.2L10.2 21l7.8-10.4h-5.2L13.4 3Z" />
  </S>
);

export const IcUsers = IcCommunity;
export default S;
