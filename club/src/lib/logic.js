/**
 * Правила клуба одним входом. Сама логика живёт в соседних файлах —
 * club, schedule, teams, meet, chats, points, base, rules, — а этот файл
 * только собирает их вместе, чтобы экраны не знали, где что лежит.
 */
export * from './club.js';
export * from './schedule.js';
export * from './points.js';
export * from './teams.js';
export * from './meet.js';
export * from './chats.js';
export * from './base.js';
export * from './rules.js';
