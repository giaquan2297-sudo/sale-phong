// Minimal, self-contained QR Code generator (Byte mode, L/M error correction)
// Based on ISO/IEC 18004 standard QR Code specification.

const EXP_TABLE = new Uint8Array(512);
const LOG_TABLE = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  EXP_TABLE[i] = EXP_TABLE[i + 255] = x;
  LOG_TABLE[x] = i;
  x <<= 1;
  if (x & 256) x ^= 0x11d;
}

function gmul(a, b) {
  if (a === 0 || b === 0) return 0;
  return EXP_TABLE[LOG_TABLE[a] + LOG_TABLE[b]];
}

function getGeneratorPoly(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gmul(poly[j], EXP_TABLE[i]);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

function calcEcc(data, eccLen) {
  const gen = getGeneratorPoly(eccLen);
  const res = new Uint8Array(data.length + eccLen);
  res.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        res[i + j] ^= gmul(gen[j], coef);
      }
    }
  }
  return Array.from(res.subarray(data.length));
}

// Table of versions (1 to 4) - data capacity and ECC codewords (Level M)
const QR_TABLE = {
  1: { size: 21, dataBytes: 16, eccBytes: 10, align: [] },
  2: { size: 25, dataBytes: 28, eccBytes: 16, align: [6, 18] },
  3: { size: 29, dataBytes: 44, eccBytes: 26, align: [6, 22] },
  4: { size: 33, dataBytes: 64, eccBytes: 18 * 2, align: [6, 26], blocks: 2 },
};

export function generateQrMatrix(text) {
  const utf8 = new TextEncoder().encode(text);
  const len = utf8.length;

  let version = 1;
  while (version <= 4 && QR_TABLE[version].dataBytes - 2 < len) {
    version++;
  }
  if (version > 4) version = 4;

  const cfg = QR_TABLE[version];
  const size = cfg.size;

  // Build bit buffer: Mode (0100 for Byte) + Count (8 bits) + Data + Terminator
  const bits = [];
  const pushBits = (val, count) => {
    for (let i = count - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1);
    }
  };

  pushBits(4, 4); // Byte mode
  pushBits(len, 8); // Character count
  for (let i = 0; i < len; i++) {
    pushBits(utf8[i], 8);
  }
  // Terminator
  for (let i = 0; i < 4 && bits.length < cfg.dataBytes * 8; i++) {
    bits.push(0);
  }
  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);

  // Pad bytes
  const pad = [0xec, 0x11];
  let p = 0;
  while (bits.length < cfg.dataBytes * 8) {
    pushBits(pad[p++ % 2], 8);
  }

  // Convert bits to data bytes
  const dataBytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    dataBytes.push(b);
  }

  // Calculate ECC
  const ecc = calcEcc(dataBytes, cfg.eccBytes);
  const totalCodewords = dataBytes.concat(ecc);

  // Create matrix
  const matrix = Array.from({ length: size }, () => new Array(size).fill(null));
  const isFunction = Array.from({ length: size }, () => new Array(size).fill(false));

  const setModule = (r, c, val) => {
    matrix[r][c] = val ? 1 : 0;
    isFunction[r][c] = true;
  };

  // 1. Finder patterns (7x7) + separators (8x8)
  const addFinder = (row, col) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
            const isBlack =
              r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
            setModule(nr, nc, isBlack);
          } else {
            setModule(nr, nc, false); // Separator
          }
        }
      }
    }
  };
  addFinder(0, 0);
  addFinder(0, size - 7);
  addFinder(size - 7, 0);

  // 2. Alignment patterns
  if (cfg.align.length > 0) {
    for (const r of cfg.align) {
      for (const c of cfg.align) {
        if (isFunction[r][c]) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const isBlack = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
            setModule(r + dr, c + dc, isBlack);
          }
        }
      }
    }
  }

  // 3. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (!isFunction[6][i]) setModule(6, i, i % 2 === 0);
    if (!isFunction[i][6]) setModule(i, 6, i % 2 === 0);
  }

  // 4. Dark module
  setModule(size - 8, 8, true);

  // 5. Reserve format info area
  for (let i = 0; i < 9; i++) {
    if (!isFunction[8][i]) isFunction[8][i] = true;
    if (!isFunction[i][8]) isFunction[i][8] = true;
  }
  for (let i = size - 8; i < size; i++) {
    if (!isFunction[8][i]) isFunction[8][i] = true;
    if (!isFunction[i][8]) isFunction[i][8] = true;
  }

  // 6. Place data in zig-zag 2-column paths
  const allBits = [];
  for (const b of totalCodewords) {
    for (let i = 7; i >= 0; i--) allBits.push((b >>> i) & 1);
  }

  let bitIdx = 0;
  let upwards = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--; // Skip vertical timing column
    const rows = upwards
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const r of rows) {
      for (const c of [right, right - 1]) {
        if (!isFunction[r][c]) {
          const bit = bitIdx < allBits.length ? allBits[bitIdx++] : 0;
          // Apply standard mask 0: (row + col) % 2 === 0
          const mask = (r + c) % 2 === 0;
          matrix[r][c] = (bit ^ (mask ? 1 : 0)) === 1 ? 1 : 0;
        }
      }
    }
    upwards = !upwards;
  }

  // 7. Format information for Error Correction M (00) + Mask 0 (000) = 00000
  // 15-bit format with BCH error correction and mask 101010000010010 = 101010000010010 (val: 0x5412)
  const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];

  // Place format info along top-left finder
  for (let i = 0; i < 6; i++) matrix[8][i] = formatBits[i];
  matrix[8][7] = formatBits[6];
  matrix[8][8] = formatBits[7];
  matrix[7][8] = formatBits[8];
  for (let i = 9; i < 15; i++) matrix[14 - i][8] = formatBits[i];

  // Place format info along bottom-left and top-right finders
  for (let i = 0; i < 7; i++) matrix[size - 1 - i][8] = formatBits[i];
  for (let i = 7; i < 15; i++) matrix[8][size - 15 + i] = formatBits[i];

  return matrix;
}
