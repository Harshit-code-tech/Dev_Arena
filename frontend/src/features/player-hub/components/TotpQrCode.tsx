import { useMemo } from "react";

type Props = {
  value: string;
  label?: string;
};

type RsBlock = {
  totalCount: number;
  dataCount: number;
};

const RS_BLOCKS_L: Record<number, RsBlock[]> = {
  1: [{ totalCount: 26, dataCount: 19 }],
  2: [{ totalCount: 44, dataCount: 34 }],
  3: [{ totalCount: 70, dataCount: 55 }],
  4: [{ totalCount: 100, dataCount: 80 }],
  5: [{ totalCount: 134, dataCount: 108 }],
  6: [
    { totalCount: 86, dataCount: 68 },
    { totalCount: 86, dataCount: 68 },
  ],
  7: [
    { totalCount: 98, dataCount: 78 },
    { totalCount: 98, dataCount: 78 },
  ],
  8: [
    { totalCount: 121, dataCount: 97 },
    { totalCount: 121, dataCount: 97 },
  ],
};

const PATTERN_POSITIONS: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
};

const G15 = 0x0537;
const G18 = 0x1f25;
const G15_MASK = 0x5412;
const ERROR_CORRECTION_LEVEL_L = 1;

const gfExp = new Array<number>(512).fill(0);
const gfLog = new Array<number>(256).fill(0);
let x = 1;
for (let i = 0; i < 255; i += 1) {
  gfExp[i] = x;
  gfLog[x] = i;
  x <<= 1;
  if (x & 0x100) x ^= 0x11d;
}
for (let i = 255; i < 512; i += 1) gfExp[i] = gfExp[i - 255];

function gfMul(a: number, b: number) {
  if (!a || !b) return 0;
  return gfExp[gfLog[a] + gfLog[b]];
}

function polynomialMultiply(a: number[], b: number[]) {
  const result = new Array<number>(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) {
      result[i + j] ^= gfMul(a[i], b[j]);
    }
  }
  return result;
}

function generatorPolynomial(ecCount: number) {
  let result = [1];
  for (let i = 0; i < ecCount; i += 1) {
    result = polynomialMultiply(result, [1, gfExp[i]]);
  }
  return result;
}

function errorCorrectionBytes(data: number[], ecCount: number) {
  const generator = generatorPolynomial(ecCount);
  const working = [...data, ...new Array<number>(ecCount).fill(0)];
  for (let i = 0; i < data.length; i += 1) {
    const coefficient = working[i];
    if (!coefficient) continue;
    for (let j = 0; j < generator.length; j += 1) {
      working[i + j] ^= gfMul(generator[j], coefficient);
    }
  }
  return working.slice(data.length);
}

class BitBuffer {
  private bytes: number[] = [];
  length = 0;

  put(value: number, length: number) {
    for (let i = length - 1; i >= 0; i -= 1) this.putBit(((value >>> i) & 1) === 1);
  }

  putBit(bit: boolean) {
    const byteIndex = Math.floor(this.length / 8);
    if (this.bytes.length <= byteIndex) this.bytes.push(0);
    if (bit) this.bytes[byteIndex] |= 0x80 >>> (this.length % 8);
    this.length += 1;
  }

  toBytes() {
    return [...this.bytes];
  }
}

function bchDigit(value: number) {
  let digit = 0;
  let current = value;
  while (current !== 0) {
    digit += 1;
    current >>>= 1;
  }
  return digit;
}

function bchTypeInfo(data: number) {
  let value = data << 10;
  while (bchDigit(value) - bchDigit(G15) >= 0) {
    value ^= G15 << (bchDigit(value) - bchDigit(G15));
  }
  return ((data << 10) | value) ^ G15_MASK;
}

function bchTypeNumber(data: number) {
  let value = data << 12;
  while (bchDigit(value) - bchDigit(G18) >= 0) {
    value ^= G18 << (bchDigit(value) - bchDigit(G18));
  }
  return (data << 12) | value;
}

function mask(maskPattern: number, row: number, column: number) {
  switch (maskPattern) {
    case 0: return (row + column) % 2 === 0;
    case 1: return row % 2 === 0;
    case 2: return column % 3 === 0;
    case 3: return (row + column) % 3 === 0;
    case 4: return (Math.floor(row / 2) + Math.floor(column / 3)) % 2 === 0;
    case 5: return ((row * column) % 2) + ((row * column) % 3) === 0;
    case 6: return (((row * column) % 2) + ((row * column) % 3)) % 2 === 0;
    case 7: return (((row * column) % 3) + ((row + column) % 2)) % 2 === 0;
    default: return false;
  }
}

function chooseVersion(byteLength: number) {
  for (let version = 1; version <= 8; version += 1) {
    const blocks = RS_BLOCKS_L[version];
    const dataCodewords = blocks.reduce((sum, block) => sum + block.dataCount, 0);
    const requiredBits = 4 + 8 + byteLength * 8;
    if (requiredBits <= dataCodewords * 8) return version;
  }
  throw new Error("Authenticator QR payload is too large.");
}

function createCodewords(text: string, version: number) {
  const payload = Array.from(new TextEncoder().encode(text));
  const blocks = RS_BLOCKS_L[version];
  const totalDataCount = blocks.reduce((sum, block) => sum + block.dataCount, 0);
  const buffer = new BitBuffer();

  buffer.put(0b0100, 4); // byte mode
  buffer.put(payload.length, 8); // versions 1-9
  payload.forEach((byte) => buffer.put(byte, 8));

  if (buffer.length + 4 <= totalDataCount * 8) buffer.put(0, 4);
  while (buffer.length % 8 !== 0) buffer.putBit(false);

  const bytes = buffer.toBytes();
  let pad = true;
  while (bytes.length < totalDataCount) {
    bytes.push(pad ? 0xec : 0x11);
    pad = !pad;
  }

  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;
  blocks.forEach((block) => {
    const data = bytes.slice(offset, offset + block.dataCount);
    offset += block.dataCount;
    dataBlocks.push(data);
    ecBlocks.push(errorCorrectionBytes(data, block.totalCount - block.dataCount));
  });

  const result: number[] = [];
  const maxData = Math.max(...dataBlocks.map((block) => block.length));
  const maxEc = Math.max(...ecBlocks.map((block) => block.length));
  for (let i = 0; i < maxData; i += 1) {
    dataBlocks.forEach((block) => {
      if (i < block.length) result.push(block[i]);
    });
  }
  for (let i = 0; i < maxEc; i += 1) {
    ecBlocks.forEach((block) => {
      if (i < block.length) result.push(block[i]);
    });
  }
  return result;
}

function setupPositionProbePattern(modules: Array<Array<boolean | null>>, row: number, col: number) {
  const moduleCount = modules.length;
  for (let r = -1; r <= 7; r += 1) {
    for (let c = -1; c <= 7; c += 1) {
      const y = row + r;
      const xPos = col + c;
      if (y < 0 || y >= moduleCount || xPos < 0 || xPos >= moduleCount) continue;
      const dark =
        (r >= 0 && r <= 6 && (c === 0 || c === 6))
        || (c >= 0 && c <= 6 && (r === 0 || r === 6))
        || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
      modules[y][xPos] = dark;
    }
  }
}

function setupPositionAdjustPattern(modules: Array<Array<boolean | null>>, version: number) {
  const positions = PATTERN_POSITIONS[version];
  positions.forEach((row) => {
    positions.forEach((col) => {
      if (modules[row][col] !== null) return;
      for (let r = -2; r <= 2; r += 1) {
        for (let c = -2; c <= 2; c += 1) {
          modules[row + r][col + c] = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
        }
      }
    });
  });
}

function setupTimingPattern(modules: Array<Array<boolean | null>>) {
  const moduleCount = modules.length;
  for (let i = 8; i < moduleCount - 8; i += 1) {
    if (modules[i][6] === null) modules[i][6] = i % 2 === 0;
    if (modules[6][i] === null) modules[6][i] = i % 2 === 0;
  }
}

function setupTypeNumber(modules: Array<Array<boolean | null>>, version: number, test: boolean) {
  if (version < 7) return;
  const bits = bchTypeNumber(version);
  const moduleCount = modules.length;
  for (let i = 0; i < 18; i += 1) {
    const dark = !test && ((bits >>> i) & 1) === 1;
    modules[Math.floor(i / 3)][(i % 3) + moduleCount - 11] = dark;
    modules[(i % 3) + moduleCount - 11][Math.floor(i / 3)] = dark;
  }
}

function setupTypeInfo(modules: Array<Array<boolean | null>>, maskPattern: number, test: boolean) {
  const data = (ERROR_CORRECTION_LEVEL_L << 3) | maskPattern;
  const bits = bchTypeInfo(data);
  const moduleCount = modules.length;

  for (let i = 0; i < 15; i += 1) {
    const dark = !test && ((bits >>> i) & 1) === 1;
    if (i < 6) modules[i][8] = dark;
    else if (i < 8) modules[i + 1][8] = dark;
    else modules[moduleCount - 15 + i][8] = dark;
  }

  for (let i = 0; i < 15; i += 1) {
    const dark = !test && ((bits >>> i) & 1) === 1;
    if (i < 8) modules[8][moduleCount - i - 1] = dark;
    else if (i < 9) modules[8][7] = dark;
    else modules[8][15 - i - 1] = dark;
  }

  modules[moduleCount - 8][8] = !test;
}

function mapData(modules: Array<Array<boolean | null>>, data: number[], maskPattern: number) {
  const moduleCount = modules.length;
  let row = moduleCount - 1;
  let direction = -1;
  let byteIndex = 0;
  let bitIndex = 7;

  for (let col = moduleCount - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1;
    while (true) {
      for (let c = 0; c < 2; c += 1) {
        const currentCol = col - c;
        if (modules[row][currentCol] !== null) continue;
        let dark = false;
        if (byteIndex < data.length) dark = ((data[byteIndex] >>> bitIndex) & 1) === 1;
        if (mask(maskPattern, row, currentCol)) dark = !dark;
        modules[row][currentCol] = dark;
        bitIndex -= 1;
        if (bitIndex < 0) {
          byteIndex += 1;
          bitIndex = 7;
        }
      }
      row += direction;
      if (row < 0 || row >= moduleCount) {
        row -= direction;
        direction = -direction;
        break;
      }
    }
  }
}

function lostPoint(modules: boolean[][]) {
  const moduleCount = modules.length;
  let score = 0;

  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      let same = 0;
      const dark = modules[row][col];
      for (let r = -1; r <= 1; r += 1) {
        if (row + r < 0 || row + r >= moduleCount) continue;
        for (let c = -1; c <= 1; c += 1) {
          if ((r === 0 && c === 0) || col + c < 0 || col + c >= moduleCount) continue;
          if (dark === modules[row + r][col + c]) same += 1;
        }
      }
      if (same > 5) score += 3 + same - 5;
    }
  }

  for (let row = 0; row < moduleCount - 1; row += 1) {
    for (let col = 0; col < moduleCount - 1; col += 1) {
      const count = Number(modules[row][col]) + Number(modules[row + 1][col]) + Number(modules[row][col + 1]) + Number(modules[row + 1][col + 1]);
      if (count === 0 || count === 4) score += 3;
    }
  }

  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount - 6; col += 1) {
      if (
        modules[row][col]
        && !modules[row][col + 1]
        && modules[row][col + 2]
        && modules[row][col + 3]
        && modules[row][col + 4]
        && !modules[row][col + 5]
        && modules[row][col + 6]
      ) score += 40;
    }
  }

  for (let col = 0; col < moduleCount; col += 1) {
    for (let row = 0; row < moduleCount - 6; row += 1) {
      if (
        modules[row][col]
        && !modules[row + 1][col]
        && modules[row + 2][col]
        && modules[row + 3][col]
        && modules[row + 4][col]
        && !modules[row + 5][col]
        && modules[row + 6][col]
      ) score += 40;
    }
  }

  let darkCount = 0;
  modules.forEach((row) => row.forEach((dark) => { if (dark) darkCount += 1; }));
  score += Math.abs((100 * darkCount) / (moduleCount * moduleCount) - 50) / 5 * 10;
  return score;
}

function makeMatrix(text: string, maskPattern: number, test: boolean) {
  const payloadLength = new TextEncoder().encode(text).length;
  const version = chooseVersion(payloadLength);
  const data = createCodewords(text, version);
  const moduleCount = version * 4 + 17;
  const modules: Array<Array<boolean | null>> = Array.from({ length: moduleCount }, () => Array<boolean | null>(moduleCount).fill(null));

  setupPositionProbePattern(modules, 0, 0);
  setupPositionProbePattern(modules, moduleCount - 7, 0);
  setupPositionProbePattern(modules, 0, moduleCount - 7);
  setupPositionAdjustPattern(modules, version);
  setupTimingPattern(modules);
  setupTypeNumber(modules, version, test);
  setupTypeInfo(modules, maskPattern, test);
  mapData(modules, data, maskPattern);

  return modules.map((row) => row.map((cell) => Boolean(cell)));
}

function qrMatrix(text: string) {
  let bestMask = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let candidate = 0; candidate < 8; candidate += 1) {
    const score = lostPoint(makeMatrix(text, candidate, true));
    if (score < bestScore) {
      bestScore = score;
      bestMask = candidate;
    }
  }
  return makeMatrix(text, bestMask, false);
}

export default function TotpQrCode({ value, label = "Google Authenticator setup QR code" }: Props) {
  const matrix = useMemo(() => qrMatrix(value), [value]);
  const quietZone = 4;
  const size = matrix.length + quietZone * 2;
  const path = useMemo(() => {
    const commands: string[] = [];
    matrix.forEach((row, y) => {
      row.forEach((dark, xPos) => {
        if (dark) commands.push(`M${xPos + quietZone} ${y + quietZone}h1v1h-1z`);
      });
    });
    return commands.join("");
  }, [matrix]);

  return (
    <svg
      className="secure-chat-auth-qr"
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
