/**
 * The closed pictogram icon catalog: the only icon ids the LLM may use (beat-sheet.ts builds its
 * zod enum from this table and the screenplay prompt lists it). Path data is extracted at build
 * time by scripts/icons-build.ts (pinned, sha256-checked) into assets/icons/icons.json; no icon
 * is fetched at render time. Add an icon as a row here, then rebuild.
 */

/** Visual families: a shot draws one family, a video at most MAX_ICON_FAMILIES. */
export const ICON_FAMILIES = {
  phosphor: { name: 'Phosphor Icons 2.1.1 (fill weight)', url: 'https://phosphoricons.com', licence: 'MIT' },
  'game-icons': { name: 'game-icons.net', url: 'https://game-icons.net', licence: 'CC BY 3.0 (credit each author; listed per icon in assets/icons/icons.json)' },
} as const;
export type IconFamily = keyof typeof ICON_FAMILIES;
export const MAX_ICON_FAMILIES = 2;

/** Phosphor fill icons by their Phosphor name: people, money, places, transport, nature, food, health, tech, power. */
const PHOSPHOR = [
  // people
  'person', 'person-simple-walk', 'person-simple-run', 'users-three', 'baby', 'student', 'graduation-cap', 'wheelchair', 'hard-hat',
  'handshake', 'brain', 'heart', 'heartbeat', 'skull', 'crown',
  // money and work
  'coin', 'coins', 'money', 'bank', 'piggy-bank', 'wallet', 'credit-card', 'receipt', 'hand-coins', 'currency-dollar', 'currency-eur',
  'currency-gbp', 'currency-jpy', 'currency-cny', 'currency-inr', 'vault', 'scales', 'trend-up', 'trend-down', 'briefcase',
  'shopping-cart', 'storefront', 'package',
  // places and buildings
  'house', 'building', 'building-apartment', 'buildings', 'city', 'factory', 'warehouse', 'farm', 'hospital', 'church', 'mosque',
  'synagogue', 'bridge', 'lighthouse', 'tent', 'windmill', 'nuclear-plant', 'solar-panel', 'globe', 'map-pin', 'flag', 'flag-banner',
  'mountains',
  // transport
  'car', 'bus', 'train', 'airplane', 'boat', 'sailboat', 'anchor', 'bicycle', 'truck', 'tractor', 'rocket', 'ambulance',
  'shipping-container', 'gas-pump',
  // nature and weather
  'tree', 'tree-evergreen', 'leaf', 'plant', 'waves', 'drop', 'fire', 'snowflake', 'sun', 'moon', 'cloud-rain', 'lightning', 'wind',
  'tornado', 'planet', 'thermometer-hot', 'thermometer-cold', 'biohazard', 'radioactive',
  // animals
  'cat', 'dog', 'horse', 'cow', 'bird', 'fish',
  // food
  'bread', 'grains', 'egg', 'fork-knife', 'bowl-food', 'coffee', 'wine',
  // health and science
  'pill', 'syringe', 'first-aid', 'stethoscope', 'dna', 'microscope', 'flask', 'face-mask', 'virus', 'atom',
  // tech and media
  'battery-full', 'lightbulb', 'laptop', 'device-mobile', 'television', 'database', 'robot', 'gear', 'wrench', 'hammer', 'newspaper',
  'book', 'books', 'scroll', 'phone',
  // power, law and conflict
  'sword', 'shield', 'bomb', 'crosshair', 'medal', 'medal-military', 'gavel', 'megaphone', 'prohibit', 'siren', 'lock', 'target', 'trophy',
  'warning', 'clock',
] as const;

/** game-icons.net silhouettes for military and historical subjects: id → author/name in the game-icons repo. */
const GAME_ICONS = {
  'centurion-helmet': 'delapouite/centurion-helmet',
  'spartan-helmet': 'delapouite/spartan-helmet',
  'viking-helmet': 'delapouite/viking-helmet',
  'samurai-helmet': 'delapouite/samurai-helmet',
  'brodie-helmet': 'skoll/brodie-helmet',
  'roman-shield': 'delapouite/roman-shield',
  'roman-toga': 'delapouite/roman-toga',
  swordsman: 'cathelineau/swordman',
  pikeman: 'delapouite/pikeman',
  archer: 'delapouite/archer',
  bowman: 'lorc/bowman',
  cavalry: 'delapouite/cavalry',
  'mounted-knight': 'skoll/mounted-knight',
  chariot: 'cathelineau/chariot',
  'crossed-swords': 'lorc/crossed-swords',
  spears: 'lorc/spears',
  musket: 'skoll/musket',
  rifle: 'sbed/rifle',
  'machine-gun': 'skoll/machine-gun',
  cannon: 'lorc/cannon',
  'field-gun': 'quoting/field-gun',
  trebuchet: 'delapouite/trebuchet',
  catapult: 'heavenly-dog/catapult',
  'siege-tower': 'delapouite/siege-tower',
  tank: 'lorc/battle-tank',
  'great-war-tank': 'cathelineau/great-war-tank',
  biplane: 'quoting/biplane',
  'jet-fighter': 'delapouite/jet-fighter',
  bomber: 'lord-berandas/bomber',
  'stealth-bomber': 'delapouite/stealth-bomber',
  submarine: 'delapouite/submarine',
  battleship: 'cathelineau/battleship',
  galley: 'delapouite/galley',
  galleon: 'lorc/galleon',
  caravel: 'delapouite/caravel',
  'iron-warship': 'cathelineau/iron-hulled-warship',
  'missile-launcher': 'delapouite/missile-launcher',
  grenade: 'lorc/grenade',
  castle: 'delapouite/castle',
  'hill-fort': 'delapouite/hill-fort',
  'military-fort': 'delapouite/military-fort',
  watchtower: 'delapouite/watchtower',
  'defensive-wall': 'heavenly-dog/defensive-wall',
  pyramids: 'delapouite/egyptian-pyramids',
  'greek-temple': 'delapouite/greek-temple',
  'byzantine-temple': 'delapouite/byzantin-temple',
  amphora: 'delapouite/amphora',
  'scroll-quill': 'delapouite/scroll-quill',
  'laurel-crown': 'lorc/laurel-crown',
  'imperial-crown': 'delapouite/imperial-crown',
  'throne-king': 'delapouite/throne-king',
  'pope-crown': 'delapouite/pope-crown',
  farmer: 'delapouite/farmer',
  miner: 'delapouite/miner',
  prisoner: 'delapouite/prisoner',
  'plague-doctor': 'delapouite/plague-doctor-profile',
  tombstone: 'lorc/tombstone',
  coffin: 'lorc/coffin',
  graveyard: 'delapouite/graveyard',
  elephant: 'delapouite/elephant',
  camel: 'delapouite/camel',
  'trojan-horse': 'delapouite/trojan-horse',
  wheat: 'lorc/wheat',
  'gold-stack': 'delapouite/gold-stack',
  'coins-pile': 'delapouite/coins-pile',
  anvil: 'lorc/anvil',
  'oil-rig': 'delapouite/oil-rig',
  'oil-pump': 'delapouite/oil-pump',
  barrel: 'delapouite/barrel',
} as const;

const shared = PHOSPHOR.filter((id) => id in GAME_ICONS);
if (shared.length > 0) throw new Error(`icon ids in both families: ${shared.join(', ')}`);

/** Every icon id → its family and source file (Phosphor name, or game-icons author/name). */
export const ICONS = {
  ...(Object.fromEntries(PHOSPHOR.map((id) => [id, { family: 'phosphor', file: id }])) as Record<(typeof PHOSPHOR)[number], { family: 'phosphor'; file: string }>),
  ...(Object.fromEntries(Object.entries(GAME_ICONS).map(([id, file]) => [id, { family: 'game-icons', file }])) as Record<keyof typeof GAME_ICONS, { family: 'game-icons'; file: string }>),
};
export type IconId = keyof typeof ICONS;

/** An icon as the renderer draws it: one combined path filled with a tone. `author` for credits (game-icons). */
export interface IconPath {
  d: string;
  viewBox: string;
  family: IconFamily;
  author?: string;
}
