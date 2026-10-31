// Графика и звуки «Аськи» подключаются обычными скриптами (/aska/art.js, /aska/sounds.js).
interface AskaSmile { id: string; codes: string[]; name: string }
interface Window {
  AskaArt?: {
    flowerSvg(color: string, size?: number, opts?: { logo?: boolean; glyph?: string; ring?: string }): string;
    statusFlower(key: string, size?: number, ring?: string): string;
    envelopeSvg(size?: number): string;
    smileSvg(id: string, size?: number): string;
    SMILES: AskaSmile[];
    postcardSvg(kind: string): string;
    magnetSvg(code: string, size?: number, opts?: { serial?: string }): string;
    COUNTRIES: { code: string; name: string; from: string; flag: string; tier?: string }[];
  };
  // Виниловый плеер «Аськи»: хиты синтезируются из нот, файлов нет (/aska/music.js)
  AskaMusic?: {
    TRACKS: { id: string; title: string; artist: string; year: number; style: string; bpm: number; color: string }[];
    STYLE_NAMES: Record<string, string>;
    play(id: string): void;
    playQueue(ids: string[], name: string, startIndex?: number): void;
    pause(): void;
    resume(): void;
    stop(): void;
    next(): void;
    duration(id: string): number;
    readonly state: { playing: boolean; trackId: string | null };
    onChange(f: (state: { playing: boolean; trackId: string | null }) => void): void;
    unlock(): void;
  };
  AskaSound?: {
    enabled: boolean;
    unlock(): void;
    play(name: string): number;
    smile(id: string): number;
    hasSmile(id: string): boolean;
  };
}
