/**
 * Генератор QR-кода: байтовый режим, уровень коррекции M, версии 1–10.
 *
 * Своя реализация вместо npm-пакета сделана намеренно: образ фронтенда собирается
 * через `npm ci` по зафиксированному package-lock.json, а контур аутентификации
 * лучше держать без лишних зависимостей. Алгоритм — по ISO/IEC 18004.
 *
 * Версий 1–10 хватает с запасом: otpauth-ссылка занимает около 130 байт,
 * а версия 10 вмещает 213.
 */

/** Общее число кодовых слов по версиям 1–10. */
const TOTAL_CODEWORDS = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
/** Слов коррекции на блок (уровень M). */
const ECC_PER_BLOCK = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
/** Число блоков коррекции (уровень M). */
const ECC_BLOCKS = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const MAX_VERSION = TOTAL_CODEWORDS.length;

export type QrMatrix = boolean[][];

function charCountBits(version: number): number {
  return version < 10 ? 8 : 16;
}

function eccCodewords(version: number): number {
  return ECC_PER_BLOCK[version - 1] * ECC_BLOCKS[version - 1];
}

function capacityBytes(version: number): number {
  const dataBits = (TOTAL_CODEWORDS[version - 1] - eccCodewords(version)) * 8;
  return Math.floor((dataBits - 4 - charCountBits(version)) / 8);
}

function pickVersion(byteLength: number): number | null {
  for (let version = 1; version <= MAX_VERSION; version++) {
    if (byteLength <= capacityBytes(version)) {
      return version;
    }
  }
  return null;
}

function bitOf(value: number, index: number): boolean {
  return ((value >>> index) & 1) !== 0;
}

/** Умножение в поле GF(256) с образующим полиномом 0x11D. */
function mul(a: number, b: number): number {
  let result = 0;
  for (let i = 7; i >= 0; i--) {
    result = ((result << 1) ^ ((result >>> 7) * 0x11d)) & 0xff;
    result ^= ((b >>> i) & 1) * a;
  }
  return result;
}

/** Образующий полином Рида — Соломона заданной степени. */
function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = mul(result[j], root);
      if (j + 1 < result.length) {
        result[j] ^= result[j + 1];
      }
    }
    root = mul(root, 0x02);
  }
  return result;
}

/** Остаток от деления данных на образующий полином — это и есть слова коррекции. */
function rsRemainder(data: number[], divisor: number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coefficient, i) => {
      result[i] ^= mul(coefficient, factor);
    });
  }
  return result;
}

/** Служебный заголовок, данные и добивка до полной ёмкости версии. */
function buildDataCodewords(version: number, data: number[]): number[] {
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) {
      bits.push((value >>> i) & 1);
    }
  };

  push(0b0100, 4); // байтовый режим
  push(data.length, charCountBits(version));
  data.forEach((byte) => push(byte, 8));

  const capacityBits =
    (TOTAL_CODEWORDS[version - 1] - eccCodewords(version)) * 8;
  push(0, Math.min(4, capacityBits - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      byte = (byte << 1) | bits[i + j];
    }
    codewords.push(byte);
  }

  let pad = 0xec;
  while (codewords.length * 8 < capacityBits) {
    codewords.push(pad);
    pad ^= 0xec ^ 0x11; // чередование 0xEC и 0x11 по стандарту
  }
  return codewords;
}

/** Разбивка на блоки, коррекция ошибок и перемежение слов. */
function addEcc(version: number, data: number[]): number[] {
  const rawCodewords = TOTAL_CODEWORDS[version - 1];
  const numBlocks = ECC_BLOCKS[version - 1];
  const blockEccLen = ECC_PER_BLOCK[version - 1];
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const divisor = rsDivisor(blockEccLen);

  const blocks: number[][] = [];
  let offset = 0;
  for (let i = 0; i < numBlocks; i++) {
    const dataLen = shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1);
    const chunk = data.slice(offset, offset + dataLen);
    offset += dataLen;
    const ecc = rsRemainder(chunk, divisor);
    const block = chunk.slice();
    if (i < numShortBlocks) {
      block.push(0); // выравнивание короткого блока для перемежения
    }
    blocks.push(block.concat(ecc));
  }

  const result: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) {
        result.push(block[i]);
      }
    });
  }
  return result;
}

/** Координаты выравнивающих узоров. */
function alignmentPositions(version: number): number[] {
  if (version === 1) {
    return [];
  }
  const count = Math.floor(version / 7) + 2;
  const size = version * 4 + 17;
  const step = Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < count; pos -= step) {
    result.splice(1, 0, pos);
  }
  return result;
}

function maskBit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

function drawQr(version: number, codewords: number[], mask: number): QrMatrix {
  const size = version * 4 + 17;
  const modules: boolean[][] = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false)
  );
  const reserved: boolean[][] = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false)
  );

  const setFunction = (x: number, y: number, dark: boolean) => {
    if (x < 0 || y < 0 || x >= size || y >= size) {
      return;
    }
    modules[y][x] = dark;
    reserved[y][x] = true;
  };

  // Синхродорожки
  for (let i = 0; i < size; i++) {
    setFunction(6, i, i % 2 === 0);
    setFunction(i, 6, i % 2 === 0);
  }

  // Поисковые узоры вместе с разделителями
  const drawFinder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        setFunction(cx + dx, cy + dy, distance !== 2 && distance !== 4);
      }
    }
  };
  drawFinder(3, 3);
  drawFinder(size - 4, 3);
  drawFinder(3, size - 4);

  // Выравнивающие узоры, кроме углов с поисковыми
  const positions = alignmentPositions(version);
  const last = positions.length - 1;
  positions.forEach((y, i) => {
    positions.forEach((x, j) => {
      const corner =
        (i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0);
      if (corner) {
        return;
      }
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          setFunction(
            x + dx,
            y + dy,
            Math.max(Math.abs(dx), Math.abs(dy)) !== 1
          );
        }
      }
    });
  });

  // Полоса формата: уровень коррекции M кодируется нулём, поэтому остаётся номер маски
  const formatData = mask;
  let formatRemainder = formatData;
  for (let i = 0; i < 10; i++) {
    formatRemainder =
      (formatRemainder << 1) ^ ((formatRemainder >>> 9) * 0x537);
  }
  const formatBits = ((formatData << 10) | formatRemainder) ^ 0x5412;
  for (let i = 0; i <= 5; i++) {
    setFunction(8, i, bitOf(formatBits, i));
  }
  setFunction(8, 7, bitOf(formatBits, 6));
  setFunction(8, 8, bitOf(formatBits, 7));
  setFunction(7, 8, bitOf(formatBits, 8));
  for (let i = 9; i < 15; i++) {
    setFunction(14 - i, 8, bitOf(formatBits, i));
  }
  for (let i = 0; i < 8; i++) {
    setFunction(size - 1 - i, 8, bitOf(formatBits, i));
  }
  for (let i = 8; i < 15; i++) {
    setFunction(8, size - 15 + i, bitOf(formatBits, i));
  }
  setFunction(8, size - 8, true); // всегда тёмный модуль

  // Полоса версии нужна с версии 7
  if (version >= 7) {
    let versionRemainder = version;
    for (let i = 0; i < 12; i++) {
      versionRemainder =
        (versionRemainder << 1) ^ ((versionRemainder >>> 11) * 0x1f25);
    }
    const versionBits = (version << 12) | versionRemainder;
    for (let i = 0; i < 18; i++) {
      const dark = bitOf(versionBits, i);
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFunction(a, b, dark);
      setFunction(b, a, dark);
    }
  }

  // Данные укладываются зигзагом справа налево
  let bit = 0;
  const totalBits = codewords.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) {
      right = 5; // столбец 6 занят синхродорожкой
    }
    for (let vertical = 0; vertical < size; vertical++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vertical : vertical;
        if (!reserved[y][x] && bit < totalBits) {
          modules[y][x] = bitOf(codewords[bit >>> 3], 7 - (bit & 7));
          bit++;
        }
      }
    }
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!reserved[y][x] && maskBit(mask, x, y)) {
        modules[y][x] = !modules[y][x];
      }
    }
  }
  return modules;
}

/** Штраф за плохую читаемость: длинные полосы, однотонные квадраты, перекос яркости. */
function penalty(modules: QrMatrix): number {
  const size = modules.length;
  let score = 0;

  const lineScore = (line: boolean[]) => {
    let result = 0;
    let run = 1;
    for (let i = 1; i < line.length; i++) {
      if (line[i] === line[i - 1]) {
        run++;
        if (run === 5) {
          result += 3;
        } else if (run > 5) {
          result += 1;
        }
      } else {
        run = 1;
      }
    }
    return result;
  };

  for (let i = 0; i < size; i++) {
    score += lineScore(modules[i]);
    score += lineScore(modules.map((row) => row[i]));
  }

  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const value = modules[y][x];
      if (
        value === modules[y][x + 1] &&
        value === modules[y + 1][x] &&
        value === modules[y + 1][x + 1]
      ) {
        score += 3;
      }
    }
  }

  const dark = modules.reduce(
    (sum, row) => sum + row.filter(Boolean).length,
    0
  );
  const ratio = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(ratio - 50) / 5) * 10;
  return score;
}

/**
 * Строит матрицу QR-кода: `true` — тёмный модуль. Возвращает `null`, если текст
 * длиннее ёмкости версии 10 — тогда вызывающий код показывает только ключ.
 */
export function encodeQr(text: string): QrMatrix | null {
  const data = Array.from(new TextEncoder().encode(text));
  const version = pickVersion(data.length);
  if (version === null) {
    return null;
  }
  const codewords = addEcc(version, buildDataCodewords(version, data));

  let best: QrMatrix | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = drawQr(version, codewords, mask);
    const score = penalty(candidate);
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}
