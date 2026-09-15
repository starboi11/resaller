const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 's', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', қ: 'q', ғ: 'g', ҳ: 'h', ў: 'o',
};

const SYNONYMS: Record<string, string[]> = {
  telefon: ['smartfon', 'mobil', 'iphone', 'android'],
  smartfon: ['telefon', 'mobil'],
  noutbuk: ['laptop', 'notebook', 'kompyuter'],
  krossovka: ['oyoq kiyim', 'tufli', 'sneaker'],
  quloqchin: ['naushnik', 'headphone', 'earbuds'],
  sumka: ['ryukzak', 'xalta'],
  xolodilnik: ['muzlatgich'],
  muzlatgich: ['холодильник'],
};

export function normalizeSearch(value: string) {
  return value.toLocaleLowerCase().normalize('NFKD').replace(/[’'`]/g, '').split('').map((letter) => CYRILLIC[letter] ?? letter).join('').replace(/[^a-z0-9]+/g, ' ').trim();
}

export function searchTerms(value: string) {
  const normalized = normalizeSearch(value);
  const expanded = new Set(normalized.split(' ').filter(Boolean));
  for (const term of [...expanded]) for (const synonym of SYNONYMS[term] ?? []) expanded.add(normalizeSearch(synonym));
  return [...expanded];
}

function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const saved = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return row[b.length]!;
}

export function marketplaceScore(query: string, values: Array<string | null | undefined>) {
  if (!query.trim()) return 1;
  const haystack = normalizeSearch(values.filter(Boolean).join(' '));
  const words = haystack.split(' ');
  let score = 0;
  for (const term of searchTerms(query)) {
    if (haystack.includes(term)) score += 10;
    else if (words.some((word) => Math.abs(word.length - term.length) <= 2 && distance(word, term) <= Math.max(1, Math.floor(term.length / 4)))) score += 4;
  }
  return score;
}
