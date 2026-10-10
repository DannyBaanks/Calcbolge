#!/usr/bin/env python3
"""Calcbolge - hand-writing calculator for Classic Malbolge.

Answers the question you actually have while writing Malbolge by hand:
"I want opcode OP at position C. What character do I type?"

All tables and semantics are transcribed from Rustbolge (`Rustbolge/src/lib.rs`),
which is a bit-exact port of `Malbolge-Engine/src/vm.c`. The self-test checks a
fixed Lutter opening vector and the full quine when its artifact is available.

The key identity:

    opcode = (ascii + c) mod 94          <- what the VM computes
    residue = (opcode - c) mod 94
    ascii  = 33 + ((opcode - c - 33) mod 94)

Graphic characters are exactly 33..126, which is 94 values, so for every
(opcode, position) pair there is EXACTLY ONE graphic character that works.
That is why Malbolge is writable at all.
"""

from __future__ import annotations

import sys
from pathlib import Path

MEM_SIZE = 59049          # 3^10
LAST = MEM_SIZE - 1
POW9 = 19683              # 3^9
HALF = 243                # 3^5
ALPHABET = 94             # graphic range 33..126 inclusive

# Rustbolge/src/lib.rs:20 — post-execution encryption table
ENCRYPT = (
    "5z]&gqtyfr$(we4{WP)H-Zn,[%\\3dL+Q;>U!pJS72FhOA1CB6v^=I_0/8|jsb9m<."
    "TVac`uY*MK'X~xDl}REokN:#?G\"i@"
)
assert len(ENCRYPT) == ALPHABET, len(ENCRYPT)

# Rustbolge/src/lib.rs:23 — indexed [b % 3][a % 3]
CRAZY_TBL = ((1, 0, 0), (1, 0, 2), (2, 2, 1))

# Rustbolge/src/lib.rs:242-280
OPS = {
    4:  ("jmp",  "c = mem[d]"),
    5:  ("out",  "output a % 256"),
    23: ("in",   "a = next input byte (EOF = 59048)"),
    39: ("rot",  "r = rotate(mem[d]); mem[d] = r; a = r"),
    40: ("movd", "d = mem[d]"),
    62: ("opr",  "r = crazy(a, mem[d]); mem[d] = r; a = r"),
    68: ("nop",  "no effect"),
    81: ("hlt",  "halt (VInstruction)"),
}
BY_NAME = {name: op for op, (name, _) in OPS.items()}
BY_NAME["end"] = 81   # accepted alias for the halt opcode

BACKEND = "standalone Classic positional formula"


def _local_opcode_at(ch: str, c: int) -> int:
    return (ord(ch) + c) % ALPHABET


def _local_char_for(op: int, c: int) -> str:
    v = (op - c) % ALPHABET
    return chr(v if v >= 33 else v + ALPHABET)


def opcode_at(ch: str, c: int) -> int:
    """What the VM will execute for character `ch` sitting at position `c`."""
    if len(ch) != 1 or not 33 <= ord(ch) <= 126:
        raise SystemExit(f"{ch!r} is not a graphic character (33..126)")
    return _local_opcode_at(ch, c)


def char_for(op: int, c: int) -> str:
    """The single graphic character producing opcode `op` at position `c`."""
    if not 0 <= op < ALPHABET:
        raise ValueError(f"opcode must be in 0..{ALPHABET - 1}")
    return _local_char_for(op, c)


def coordinates(c: int) -> tuple[int, int]:
    """Return the quotient/remainder coordinates induced by the 94-cell phase."""
    if not 0 <= c < MEM_SIZE:
        raise ValueError(f"position must be in 0..{LAST}")
    v, u = divmod(c, ALPHABET)
    return u, v


def rotate(n: int) -> int:
    """Ternary right-rotate of a 10-trit word. Rustbolge/src/lib.rs:48."""
    if not 0 <= n < MEM_SIZE:
        raise ValueError(f"word must be in 0..{LAST}")
    return POW9 * (n % 3) + n // 3


def crazy(a: int, b: int) -> int:
    """The crazy operator, trit by trit. Rustbolge/src/lib.rs:25-46."""
    if not 0 <= a < MEM_SIZE or not 0 <= b < MEM_SIZE:
        raise ValueError(f"crazy operands must be in 0..{LAST}")
    r, p, aa, bb = 0, 1, a, b
    for _ in range(10):
        r += CRAZY_TBL[bb % 3][aa % 3] * p
        aa //= 3
        bb //= 3
        p *= 3
    return r


def encrypt(ch: str) -> str:
    """What the cell becomes after the instruction at it executes."""
    return ENCRYPT[ord(ch) - 33]


def resolve_op(token: str) -> int:
    """Accept either a mnemonic (nop) or a raw opcode number (68)."""
    if token in BY_NAME:
        return BY_NAME[token]
    try:
        op = int(token)
    except ValueError:
        raise SystemExit(f"unknown opcode: {token!r} (try: {', '.join(BY_NAME)})")
    if op not in OPS:
        raise SystemExit(f"{op} is not one of the 8 valid opcodes: {sorted(OPS)}")
    return op


def graphic(src: str) -> str:
    return "".join(ch for ch in src if 33 <= ord(ch) <= 126)


def parse_int(value: str, label: str) -> int:
    try:
        return int(value)
    except ValueError as exc:
        raise SystemExit(f"{label} must be an integer: {value!r}") from exc


# --- commands ---------------------------------------------------------------

def cmd_encode(args):
    """encode OP POS  ->  the character to type."""
    op, c = resolve_op(args[0]), parse_int(args[1], "position")
    if not 0 <= c < MEM_SIZE:
        raise SystemExit(f"position must be in 0..{LAST}")
    ch = char_for(op, c)
    name, effect = OPS[op]
    print(f"position {c}  opcode {op} ({name})  ->  {ch!r}   ascii {ord(ch)}")
    print(f"  check: ({ord(ch)} + {c}) mod 94 = {opcode_at(ch, c)}")
    print(f"  effect: {effect}")
    print(f"  after it executes this cell becomes {encrypt(ch)!r}")


def cmd_decode(args):
    """decode CHAR POS  ->  the opcode."""
    if len(args[0]) != 1:
        raise SystemExit("decode expects exactly one character")
    ch, c = args[0], parse_int(args[1], "position")
    if not 0 <= c < MEM_SIZE:
        raise SystemExit(f"position must be in 0..{LAST}")
    v = opcode_at(ch, c)
    name, effect = OPS.get(v, ("nop", "no effect (any value outside the 8 is a nop)"))
    print(f"{ch!r} (ascii {ord(ch)}) at position {c}  ->  opcode {v} ({name})")
    print(f"  effect: {effect}")


def cmd_ramp(args):
    """ramp OP POS N  ->  N consecutive cells all holding the same opcode.

    This is the trick: position rises by 1 each cell, so the character must
    fall by 1. A run of identical opcodes is a descending ASCII ramp.
    """
    op, c, n = resolve_op(args[0]), parse_int(args[1], "position"), parse_int(args[2], "length")
    if not 0 <= c < MEM_SIZE:
        raise SystemExit(f"position must be in 0..{LAST}")
    if n < 1 or c + n > MEM_SIZE:
        raise SystemExit(f"ramp length must fit in Classic memory (1..{MEM_SIZE - c})")
    chars = [char_for(op, c + i) for i in range(n)]
    name, _ = OPS[op]
    print(f"{n} x {name} (opcode {op}) starting at position {c}:\n")
    print("".join(chars))
    print(f"\n  ascii: {ord(chars[0])} down to {ord(chars[-1])}"
          f"{' (wraps through 33 -> 126)' if any(ord(chars[i+1]) > ord(chars[i]) for i in range(n-1)) else ''}")
    bad = [(i, ch) for i, ch in enumerate(chars) if opcode_at(ch, c + i) != op]
    print(f"  verified: {len(chars) - len(bad)}/{len(chars)} cells decode to {name}")
    if bad:
        print(f"  MISMATCH at {bad[:5]}")


def cmd_table(args):
    """table POS [ROWS]  ->  every legal character at that position.

    For code golf: this is your full menu of choices at one cell.
    """
    c = parse_int(args[0], "position")
    rows = parse_int(args[1], "row count") if len(args) > 1 else 1
    if not 0 <= c < MEM_SIZE:
        raise SystemExit(f"position must be in 0..{LAST}")
    if rows < 1 or c + rows > MEM_SIZE:
        raise SystemExit(f"row count must fit in Classic memory (1..{MEM_SIZE - c})")
    print(f"{'pos':>7} | " + " | ".join(f"{OPS[op][0]:>4}" for op in sorted(OPS)))
    print("-" * (9 + 7 * len(OPS)))
    for i in range(rows):
        p = c + i
        cells = " | ".join(f"{char_for(op, p)!r:>4}" for op in sorted(OPS))
        print(f"{p:>7} | {cells}")


def cmd_after(args):
    """after CHAR  ->  the encrypted replacement, and its orbit."""
    if len(args[0]) != 1 or not 33 <= ord(args[0]) <= 126:
        raise SystemExit("after expects exactly one graphic character (33..126)")
    ch = args[0]
    seen, cur = [], ch
    while cur not in seen:
        seen.append(cur)
        cur = encrypt(cur)
    print(f"{ch!r} -> {encrypt(ch)!r}")
    print(f"  encryption orbit ({len(seen)} cells before it repeats):")
    print("  " + " -> ".join(repr(x) for x in seen[:24]) + (" ..." if len(seen) > 24 else ""))


def cmd_crazy(args):
    """crazy A B  ->  the crazy operator on two 10-trit words."""
    a, b = parse_int(args[0], "operand A"), parse_int(args[1], "operand B")
    if not 0 <= a < MEM_SIZE or not 0 <= b < MEM_SIZE:
        raise SystemExit(f"crazy operands must be in 0..{LAST}")
    r = crazy(a, b)
    def trits(n):
        return "".join(str((n // 3 ** k) % 3) for k in reversed(range(10)))
    print(f"crazy({a}, {b}) = {r}")
    print(f"  a = {trits(a)}")
    print(f"  b = {trits(b)}")
    print(f"  r = {trits(r)}")


def cmd_trace(args):
    """trace FILE [N]  ->  decode the first N cells of a program."""
    path = args[0]
    n = parse_int(args[1], "cell count") if len(args) > 1 else 24
    if not 1 <= n <= MEM_SIZE:
        raise SystemExit(f"cell count must be in 1..{MEM_SIZE}")
    with open(path, "rb") as fh:
        src = graphic(fh.read().decode("latin-1"))
    if len(src) > MEM_SIZE:
        raise SystemExit(f"program exceeds Classic memory ({MEM_SIZE} cells)")
    print(f"{path}: {len(src)} graphic cells\n")
    print(f"{'pos':>7} {'char':>5} {'ascii':>6} {'op':>4}  name")
    for c, ch in enumerate(src[:n]):
        v = opcode_at(ch, c)
        print(f"{c:>7} {ch!r:>5} {ord(ch):>6} {v:>4}  {OPS.get(v, ('nop', ''))[0]}")


def cmd_asm(args):
    """asm "OP OP OP ..." [POS]  ->  the source text for that opcode sequence.

    The whole point: you write what you want the machine to DO, and the
    positional arithmetic is not your problem any more. `*N` repeats an
    opcode, so `nop*40` is a 40-cell ramp.
    """
    seq = args[0].replace(",", " ").split()
    start = parse_int(args[1], "starting position") if len(args) > 1 else 0
    plan = []
    for token in seq:
        name, _, count = token.partition("*")
        repeat = int(count) if count else 1
        if repeat < 1:
            raise SystemExit(f"repeat count must be positive: {token!r}")
        plan.extend([resolve_op(name)] * repeat)
    if not plan:
        raise SystemExit("opcode plan must contain at least one instruction")
    if not 0 <= start < MEM_SIZE or start + len(plan) > MEM_SIZE:
        raise SystemExit(f"plan must fit in Classic memory (positions 0..{LAST})")
    src = "".join(char_for(op, start + i) for i, op in enumerate(plan))
    print(f"{len(plan)} cells starting at position {start}:\n")
    print(src)
    print()
    bad = [(start + i, src[i], op) for i, op in enumerate(plan)
           if opcode_at(src[i], start + i) != op]
    print(f"  verified: {len(plan) - len(bad)}/{len(plan)} cells decode to the requested opcode")
    if bad:
        print(f"  MISMATCH: {bad[:5]}")
    names = [OPS[op][0] for op in plan]
    print(f"  reads as: {' '.join(names[:16])}{' ...' if len(names) > 16 else ''}")


def cmd_coordinates(args):
    """coords POS [OP]  ->  quotient/remainder coordinates and phase aliases."""
    c = parse_int(args[0], "position")
    try:
        u, v = coordinates(c)
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc
    phase_count = (LAST - u) // ALPHABET + 1
    print(f"position {c} = (u={u}, v={v}) where c = u + {ALPHABET}*v")
    print(f"  u = c mod {ALPHABET}; v = floor(c/{ALPHABET})")
    print(f"  decode uses u only: opcode = (ASCII + u) mod {ALPHABET}; v does not enter")
    print(f"  same phase in Classic memory: {phase_count} positions, c = {u} + {ALPHABET}*k")
    if len(args) > 1:
        op = resolve_op(args[1])
        ch = char_for(op, c)
        residue = (op - u) % ALPHABET
        ascii_code = residue if residue >= 33 else residue + ALPHABET
        name = OPS[op][0]
        print(f"  {name} ({op}): r = ({op} - {u}) mod {ALPHABET} = {residue}")
        print(f"  source: ASCII {ascii_code} -> {ch!r}; decode check = {opcode_at(ch, c)}")


def cmd_golf(args):
    """golf CHAR [SPAN]  ->  which opcode this character gives at each position.

    For code golf: one character means 8 different things depending on where
    you put it. This shows you the first position in SPAN that yields each
    opcode, so you can reuse a character you already have instead of
    introducing a new one.
    """
    if len(args[0]) != 1 or not 33 <= ord(args[0]) <= 126:
        raise SystemExit("golf expects exactly one graphic character (33..126)")
    ch = args[0]
    span = parse_int(args[1], "span") if len(args) > 1 else ALPHABET
    if not 1 <= span <= MEM_SIZE:
        raise SystemExit(f"span must be in 1..{MEM_SIZE}")
    print(f"{ch!r} (ascii {ord(ch)}) over the next {span} positions:\n")
    print(f"{'opcode':>7}  {'name':>5}  first position")
    for op in sorted(OPS):
        hit = next((c for c in range(span) if opcode_at(ch, c) == op), None)
        where = f"c = {hit}" + (f", then every 94 (next {hit + ALPHABET})" if hit is not None else "")
        print(f"{op:>7}  {OPS[op][0]:>5}  {where if hit is not None else 'not within span'}")
    print(f"\n  a character's opcode cycles with period 94, so every character")
    print(f"  can serve as all 8 instructions given the right cell.")


def cmd_selftest(args):
    """Exhaustively verify the standalone positional formula and fixed vectors."""
    fails = []
    print(f"backend: {BACKEND}\n")

    # Check every valid Classic instruction at every address in the 10-trit VM.
    local_bad = 0
    for c in range(MEM_SIZE):
        for op in OPS:
            ch = _local_char_for(op, c)
            if not (33 <= ord(ch) <= 126) or _local_opcode_at(ch, c) != op:
                local_bad += 1
    print(f"local roundtrip: {'PASS' if not local_bad else 'FAIL'} "
          f"({MEM_SIZE * len(OPS)} pairs, exhaustive)")
    if local_bad:
        fails.append(f"local roundtrip failed on {local_bad} pairs")

    # Fixed independent vector from Lutter's published quine opening.
    plan = [4, 23, 40] + [68] * 7 + [62] + [68] * 11
    mine = "".join(char_for(op, i) for i, op in enumerate(plan))
    expected = "bt&A@?>=<;49876543210/"
    print(f"Lutter opening vector: {'PASS' if mine == expected else 'FAIL'} ({mine})")
    if mine != expected:
        fails.append("Lutter opening vector mismatch")

    if len(set(ENCRYPT)) != ALPHABET:
        fails.append("encryption table is not a permutation")
    print(f"encryption table is a permutation of 94 graphic chars: "
          f"{'PASS' if len(set(ENCRYPT)) == ALPHABET else 'FAIL'}")

    quine = None
    root = Path(__file__).resolve().parent
    for cand in (root.parent / "lou_scheffer_package/evidence/quine_lutter.malbolge",
                 root.parent / "MALDOOM/vendor/quines/quine_lutter.malbolge"):
        try:
            with cand.open("rb") as fh:
                quine = graphic(fh.read().decode("latin-1"))
            break
        except OSError:
            continue
    if quine is None:
        print("Lutter quine not found next to this repo; skipped")
    else:
        head = "".join(OPS.get(opcode_at(ch, c), ("nop",))[0][0] for c, ch in enumerate(quine[:8]))
        print(f"Lutter quine: {len(quine)} cells, first 8 decode to {head!r} "
              f"(expect 'jimnnnnn' -> jmp in movd nop x5)")
        if len(quine) != 59032:
            fails.append(f"unexpected Lutter quine length: {len(quine)} (expected 59032)")
        if quine[:22] != expected:
            fails.append("Lutter quine opening differs from the fixed 22-cell vector")
        if opcode_at(quine[0], 0) != 4:
            fails.append("Lutter quine cell 0 is not jmp")
        print(f"  cell 0 is jmp: {'PASS' if opcode_at(quine[0], 0) == 4 else 'FAIL'}")

    print()
    print("SELFTEST=" + ("PASS" if not fails else "FAIL"))
    for f in fails[:10]:
        print("  " + f)
    return 1 if fails else 0


COMMANDS = {
    "encode": (cmd_encode, "OP POS", "character for an opcode at a position"),
    "decode": (cmd_decode, "CHAR POS", "opcode for a character at a position"),
    "ramp": (cmd_ramp, "OP POS N", "N cells of the same opcode (descending ramp)"),
    "table": (cmd_table, "POS [ROWS]", "all 8 legal characters per position"),
    "after": (cmd_after, "CHAR", "post-execution encryption and its orbit"),
    "crazy": (cmd_crazy, "A B", "the crazy operator, trit by trit"),
    "trace": (cmd_trace, "FILE [N]", "decode the first N cells of a program"),
    "asm": (cmd_asm, '"OPS" [POS]', "assemble an opcode sequence into source"),
    "golf": (cmd_golf, "CHAR [SPAN]", "what one character means at each position"),
    "coords": (cmd_coordinates, "POS [OP]", "show the 94-phase coordinates and optional source character"),
    "selftest": (cmd_selftest, "", "exhaustively verify the formula and Lutter vectors"),
}


def main(argv):
    if len(argv) < 2:
        print("Calcbolge - standalone hand-writing calculator for Classic Malbolge")
        print(f"backend: {BACKEND}\n")
        print("usage: calcbolge.py <command> [args]\n")
        for name, (_, sig, doc) in COMMANDS.items():
            print(f"  {name:<9} {sig:<12} {doc}")
        print("\nopcodes: " + ", ".join(f"{n}={op}" for op, (n, _) in sorted(OPS.items(), key=lambda x: x[1][0])))
        return 2
    if argv[1] not in COMMANDS:
        raise SystemExit(f"unknown command: {argv[1]!r}")
    fn, sig, _ = COMMANDS[argv[1]]
    parts = sig.split()
    need = len([t for t in parts if not t.startswith("[")])
    args = argv[2:]
    if not need <= len(args) <= len(parts):
        raise SystemExit(f"usage: calcbolge.py {argv[1]} {sig}")
    return fn(args) or 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
