// ============ PHONE NUMBER DETECTION ============

// Detect Taiwan mobile phone numbers from chat messages
// Supports: 0912345678, 0912-345-678, 09 1234 5678, +886912345678, etc.
export function detectPhoneNumber(text: string): string | null {
  // Taiwan mobile patterns
  const patterns = [
    /(?:\+886|886)[\s-]?0?9\d{2}[\s-]?\d{3}[\s-]?\d{3}/,
    /09\d{2}[\s-]?\d{3}[\s-]?\d{3}/,
    /09\d{2}[\s-]?\d{6}/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // Normalize to 09xx-xxx-xxx format
      const raw = match[0].replace(/[\s-+]/g, '');
      let digits = raw;
      if (digits.startsWith('886')) {
        digits = '0' + digits.slice(3);
      }
      if (digits.length === 10 && digits.startsWith('09')) {
        return `${digits.slice(0,4)}-${digits.slice(4,7)}-${digits.slice(7)}`;
      }
    }
  }

  // Also detect landline numbers (07-xxx-xxxx, 02-xxxx-xxxx, etc.)
  const landlineMatch = text.match(/0[2-9][\s-]?\d{3,4}[\s-]?\d{4}/);
  if (landlineMatch) {
    const raw = landlineMatch[0].replace(/[\s-]/g, '');
    if (raw.length >= 9 && raw.length <= 10) {
      return raw;
    }
  }

  return null;
}

// ============ GENDER DETECTION FROM NAME ============

// Detect gender from customer display name using common Chinese name patterns
export function detectGenderFromName(name: string | null): 'male' | 'female' | 'unknown' {
  if (!name) return 'unknown';

  const cleanName = name.trim();
  if (!cleanName) return 'unknown';

  // Common female indicators in Chinese names
  const femalePatterns = [
    /女士/, /小姐/, /媽媽/, /阿姨/, /姐姐/, /妹妹/, /嫂/,
    /太太/, /夫人/, /姑姑/, /婆婆/, /阿嬤/, /奶奶/,
  ];

  // Common male indicators in Chinese names
  const malePatterns = [
    /先生/, /大哥/, /爸爸/, /叔叔/, /伯伯/, /哥哥/, /弟弟/,
    /阿伯/, /阿公/, /爺爺/, /老闆/,
  ];

  for (const p of femalePatterns) {
    if (p.test(cleanName)) return 'female';
  }
  for (const p of malePatterns) {
    if (p.test(cleanName)) return 'male';
  }

  // Check last character of name for common gender-specific characters
  // (only if name looks like a Chinese name, 2-4 characters)
  if (/^[\u4e00-\u9fff]{2,4}$/.test(cleanName)) {
    const lastChar = cleanName[cleanName.length - 1];
    const secondChar = cleanName.length >= 2 ? cleanName[cleanName.length - 2] : '';

    // Common female name characters
    const femaleChars = '美麗娟芳萍婷玲珍雅惠淑芬蘭英華玉秀芝蓉琴嬌嫻靜慧瑩瑤琳珊蕙薇蓮菊瑜彤妍姿婉嫣韻';
    // Common male name characters
    const maleChars = '雄偉強剛明志豪傑龍勇軍輝鵬飛武斌鑫磊峰彪昌棟柱亮宏達建國榮勝德福財旺';

    if (femaleChars.includes(lastChar)) return 'female';
    if (maleChars.includes(lastChar)) return 'male';
    if (femaleChars.includes(secondChar)) return 'female';
    if (maleChars.includes(secondChar)) return 'male';
  }

  return 'unknown';
}

// Get the appropriate greeting based on gender (fallback when no name)
export function getGenderGreeting(gender: 'male' | 'female' | 'unknown'): string {
  switch (gender) {
    case 'male': return '大哥';
    case 'female': return '小姐';
    case 'unknown': return '人客';
  }
}

// Get a friendly name-based greeting from customer's display name
// e.g., "王雅玲" → "雅玲", "小明" → "小明", "John" → "John"
export function getNameGreeting(name: string | null, gender: 'male' | 'female' | 'unknown'): string {
  if (!name || !name.trim()) return getGenderGreeting(gender);

  const clean = name.trim();

  // Pure Chinese name: extract given name
  if (/^[\u4e00-\u9fff]{2,4}$/.test(clean)) {
    if (clean.length === 2) return clean; // 2-char name: use full name (e.g., "雅玲")
    if (clean.length === 3) return clean.slice(1); // 3-char: use given name (e.g., "王雅玲" → "雅玲")
    if (clean.length === 4) return clean.slice(2); // 4-char: use last 2 (e.g., "司馬相如" → "相如")
  }

  // Mixed or non-Chinese name: use as-is if short, otherwise truncate
  if (clean.length <= 10) return clean;
  return getGenderGreeting(gender);
}
