// Графика и звуки «Аськи» подключаются обычными скриптами (/aska/art.js, /aska/sounds.js).
interface AskaSmile { id: string; codes: string[]; name: string }
interface Window {
  AskaArt?: {
    flowerSvg(color: string, size?: number, opts?: { logo?: boolean; glyph?: string; ring?: string }): string;
    statusFlower(key: string, size?: number, ring?: string): string;
    envelopeSvg(size?: number): string;
    smileSvg(id: string, size?: number): string;
    SMILES: AskaSmile[];
  };
  AskaSound?: {
    enabled: boolean;
    unlock(): void;
    play(name: string): number;
    smile(id: string): number;
    hasSmile(id: string): boolean;
  };
}
