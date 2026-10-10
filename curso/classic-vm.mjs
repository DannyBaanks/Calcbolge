const MEMORY_SIZE = 59_049;
const EOF_VALUE = 59_048;
const ALPHABET_SIZE = 94;
const POW_3_9 = 19_683;
const OPCODES = new Map([
  [4, "JMP"],
  [5, "OUT"],
  [23, "IN"],
  [39, "ROT"],
  [40, "MOVD"],
  [62, "OPR"],
  [68, "NOP"],
  [81, "HALT"],
]);
const CRAZY_TABLE = [
  [1, 0, 0],
  [1, 0, 2],
  [2, 2, 1],
];
const XLAT = "5z]&gqtyfr$(we4{WP)H-Zn,[%\\3dL+Q;>U!pJS72FhOA1CB6v^=I_0/8|jsb9m<.TVac`uY*MK'X~xDl}REokN:#?G\"i@";
const ENCRYPT = new Uint8Array(ALPHABET_SIZE);

for (let i = 0; i < ALPHABET_SIZE; i += 1) {
  ENCRYPT[i] = XLAT.charCodeAt(i);
}

function isAsciiWhitespace(code) {
  return code === 32 || (code >= 9 && code <= 13);
}

function crazy(a, b) {
  let result = 0;
  let place = 1;
  for (let i = 0; i < 10; i += 1) {
    result += CRAZY_TABLE[b % 3][a % 3] * place;
    a = Math.floor(a / 3);
    b = Math.floor(b / 3);
    place *= 3;
  }
  return result;
}

function rotate(value) {
  return Math.floor(value / 3) + (value % 3) * POW_3_9;
}

function latin1Input(input) {
  const bytes = [];
  for (const character of input) {
    const code = character.codePointAt(0);
    if (code > 255) {
      throw new Error(`La entrada contiene U+${code.toString(16).toUpperCase()}, fuera de Latin-1.`);
    }
    bytes.push(code);
  }
  return bytes;
}

function load(source) {
  const cells = [];
  for (const character of source) {
    const code = character.codePointAt(0);
    if (isAsciiWhitespace(code)) continue;
    if (code < 33 || code > 126) {
      throw new Error(`Código fuente no imprimible en la celda ${cells.length}.`);
    }
    cells.push(code);
    if (cells.length > MEMORY_SIZE) {
      throw new Error(`El programa excede las ${MEMORY_SIZE} celdas de Malbolge Classic.`);
    }
  }
  if (cells.length === 0) throw new Error("El programa está vacío.");

  const memory = new Uint32Array(MEMORY_SIZE);
  memory.set(cells);
  for (let i = cells.length; i < MEMORY_SIZE; i += 1) {
    memory[i] = crazy(memory[i - 1], memory[i - 2]);
  }
  return memory;
}

export function normalizeSource(source) {
  let result = "";
  for (const character of source) {
    const code = character.codePointAt(0);
    if (code >= 33 && code <= 126) {
      result += character;
    } else if (!isAsciiWhitespace(code)) {
      throw new Error(`Carácter no permitido en el fuente: U+${code.toString(16).toUpperCase()}.`);
    }
  }
  return result;
}

export function encryptGraphic(code) {
  if (!Number.isInteger(code) || code < 33 || code > 126) {
    throw new RangeError("El cifrado Classic solo acepta ASCII gráfico (33..126).");
  }
  return ENCRYPT[code - 33];
}

export function encodeOpcode(opcode, position) {
  const residue = ((opcode - position) % ALPHABET_SIZE + ALPHABET_SIZE) % ALPHABET_SIZE;
  return String.fromCharCode(residue >= 33 ? residue : residue + ALPHABET_SIZE);
}

export function assemble(opcodes, start = 0) {
  if (!Number.isInteger(start) || start < 0 || start + opcodes.length > MEMORY_SIZE) {
    throw new Error("El plan debe caber en las 59 049 celdas Classic.");
  }
  return opcodes.map((opcode, index) => encodeOpcode(opcode, start + index)).join("");
}

export function runClassic(source, stdin = "", options = {}) {
  const {
    maxSteps = 2_000_000,
    maxOutput = 100_000,
    traceLimit = 80,
    onProgress = null,
  } = options;
  const memory = load(source);
  const input = latin1Input(stdin);
  const output = [];
  const trace = [];
  let inputPosition = 0;
  let a = 0;
  let c = 0;
  let d = 0;

  for (let steps = 1; steps <= maxSteps; steps += 1) {
    const cell = memory[c];
    if (cell < 33 || cell > 126) {
      if (trace.length < traceLimit) {
        trace.push({ step: steps, c, d, a, cell, opcode: null, mnemonic: "INVALID" });
      }
      return { status: "STUCK_INVALID_CELL", steps, output: Uint8Array.from(output), trace, a, c, d };
    }
    const opcode = (cell + c) % ALPHABET_SIZE;
    const mnemonic = OPCODES.get(opcode) ?? "NOP";
    if (trace.length < traceLimit) trace.push({ step: steps, c, d, a, cell, opcode, mnemonic });

    switch (opcode) {
      case 4:
        c = memory[d];
        break;
      case 5:
        output.push(a % 256);
        if (output.length >= maxOutput) {
          return { status: "OUTPUT_LIMIT", steps, output: Uint8Array.from(output), trace, a, c, d };
        }
        break;
      case 23:
        a = inputPosition < input.length ? input[inputPosition++] : EOF_VALUE;
        break;
      case 39:
        memory[d] = rotate(memory[d]);
        a = memory[d];
        break;
      case 40:
        d = memory[d];
        break;
      case 62:
        memory[d] = crazy(a, memory[d]);
        a = memory[d];
        break;
      case 81:
        return { status: "HALTED", steps, output: Uint8Array.from(output), trace, a, c, d };
      default:
        break;
    }

    if (memory[c] >= 33 && memory[c] <= 126) memory[c] = encryptGraphic(memory[c]);
    c = (c + 1) % MEMORY_SIZE;
    d = (d + 1) % MEMORY_SIZE;
    if (onProgress && steps % 2_000_000 === 0) onProgress(steps);
  }
  return { status: "MAX_STEPS", steps: maxSteps, output: Uint8Array.from(output), trace, a, c, d };
}

export const CLASSIC_MEMORY_SIZE = MEMORY_SIZE;
export const CLASSIC_EOF = EOF_VALUE;
export const CLASSIC_ENCRYPTION = XLAT;
