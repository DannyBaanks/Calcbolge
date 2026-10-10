# Calcbolge

> A hand-writing calculator for Classic Malbolge.

You want opcode `OP` in cell `C`. What character do you type? That is the
only question Calcbolge answers, and it is the question that stands between
Malbolge and being writable by a person.

```
opcode = (ASCII + c) mod 94      <- what the VM computes
residue = (opcode - c) mod 94
ASCII = 33 + ((opcode - c - 33) mod 94) <- printable character to type
```

Graphic characters are exactly `33..126`, which is **94** values — the same 94
as the execution alphabet. So for every `(opcode, position)` pair there is
**exactly one** graphic character that works. Never zero, never two. That is
the whole trick.

## Why Malbolge is writable at all

Positions are independent. There is no accumulated state in the encoding, so
cell 10 does not care what you put in cell 9. Two consequences:

1. **A run of one opcode is a descending ASCII ramp.** Position rises by 1, so
   the character must fall by 1. `nop*7` from cell 3 is literally `A@?>=<;`.
2. **You can drop a real instruction into the middle of a ramp and nothing
   downstream breaks.** The ramp just resumes at its own recomputed value.

Both are visible in the first 22 cells of Matthias Lutter's quine:

```
 3-9    A @ ? > = < ;        nop ramp, ascii 65 -> 59
 10     '4' (52)             opr   <- deliberate instruction, mid-ramp
 11-21  9 8 7 6 5 4 3 2 1 0 /    ramp resumes at 57, not 58
```

And `'4'` appears at cell 10 **and** at cell 16. At 10 it is `opr`; at 16 it is
`nop`. Same character, six cells apart, two different instructions. Position is
not decoration — it is half the instruction.

## Standalone Classic tool

Calcbolge implements the positional formula locally; its CLI has no runtime
dependency on another Malbolge project. `MALBOLGE`, `MALBOLGE-MB-DATABASE` and
`MalbolgeFree` remain independent projects. The optional call/return example
has a separate verifier that compares against the Classic reference runtime.
Calcbolge itself stays a Classic source-position tool: it does not adopt MBIR
or Malbolge Free's non-Classic execution profiles.

```
opcode = (ASCII + c) mod 94
ASCII  = 33 + ((opcode - c - 33) mod 94)
```

The 94 graphic ASCII characters are the unique printable representatives of
the residues modulo 94. For a Classic cell, `c` is restricted to `0..59048`.

## Verification

`selftest` exhaustively verifies the local implementation and fixed vectors:

1. **Exhaustive roundtrip** — all 8 Classic instructions at all 59,049
   positions: 472,392 encode/decode pairs.
2. **Fixed vector** — assembles the first 22 cells of Lutter's quine from
   opcode names and compares them with the known source string.
3. **Encryption table** — checks that all 94 graphic characters map
   bijectively.
4. **Full quine, when available** — searches for the adjacent Lutter artifact
   relative to this script, not the shell's current directory; otherwise it
   reports that optional check as skipped.

The self-test checks Calcbolge's own formula and known vectors; it does not
claim to be a second Malbolge VM or a cross-runtime parity proof. Run the
unit tests with:

```
python3 -m unittest discover -s tests -v
```

## The 94-phase coordinates

For a Classic position `c`, Calcbolge displays its quotient/remainder
coordinates:

```
u = c mod 94
v = floor(c / 94)
c = u + 94v
```

The positional decoder reads `u` and is invariant under `c -> c + 94`; `v` is
useful as an index for those repeated phases, but does not enter the opcode
formula. Since `29516 = 94 * 314`, positions `0..29515` can be laid out as 314
rows of 94 positions. This is a row-major bijection of a finite set, not an
additive-group isomorphism or evidence that the VM has a toroidal or 4D runtime
geometry.

```
$ python3 calcbolge.py coords 29515 nop
position 29515 = (u=93, v=313) where c = u + 94*v
  u = c mod 94; v = floor(c/94)
  decode uses u only: opcode = (ASCII + u) mod 94; v does not enter
  same phase in Classic memory: 628 positions, c = 93 + 94*k
  nop (68): r = (68 - 93) mod 94 = 69
  source: ASCII 69 -> 'E'; decode check = 68
```

The 59,049-cell Classic memory is not the 59,032-character quine: the latter
is a particular program length, not the VM's address-space size.

## Assemble a sequence

`asm` reproduces the quine's opening from a description written in words:

```
$ python3 calcbolge.py asm "jmp in movd nop*7 opr nop*11"
bt&A@?>=<;49876543210/
  verified: 22/22 cells decode to the requested opcode
```

Byte-identical to Lutter's first 22 cells. The tool was not fitted to that
result; the arithmetic simply lands there.

## Commands

| command | what it does |
|---|---|
| `encode OP POS` | the one character giving that opcode at that position |
| `decode CHAR POS` | the opcode a character produces at a position |
| `ramp OP POS N` | N cells of the same opcode (the descending ramp) |
| `asm "OPS" [POS]` | assemble a whole opcode sequence; `nop*40` repeats |
| `table POS [ROWS]` | all 8 legal characters per position, side by side |
| `coords POS [OP]` | show `(c mod 94, floor(c/94))` and optionally encode an opcode |
| `golf CHAR [SPAN]` | which opcode one character gives at which position |
| `after CHAR` | post-execution encryption, and the character's orbit |
| `crazy A B` | the crazy operator, trit by trit |
| `trace FILE [N]` | decode the first N cells of a real program |
| `selftest` | exhaustively verify the formula and known Lutter vectors |

Opcodes accept mnemonics or numbers: `jmp`=4, `out`=5, `in`=23, `rot`=39,
`movd`=40, `opr`=62, `nop`=68, `hlt`=81 (also `end`). Plans accept spaces or
commas. Any other decoded value has no instruction in Classic.

## Provenance

The positional formula is also implemented in the separate `MALBOLGE` and
`MalbolgeFree` projects; Calcbolge owns its standalone implementation. The
tables below are transcribed from `Rustbolge/src/lib.rs`, which is a bit-exact
port of `Malbolge-Engine/src/vm.c` and agrees byte-for-byte with Swiftbolge,
Javolge and Cobolge on the step-17 snapshot (`29372AAD…FE4`):

- encryption table — `lib.rs:20`
- crazy table `[[1,0,0],[1,0,2],[2,2,1]]`, indexed `[b%3][a%3]` — `lib.rs:23`
- `rotate(n) = 19683*(n%3) + n/3` — `lib.rs:48`
- opcode effects and the post-execution encrypt/advance — `lib.rs:242-286`

## Not claimed

Calcbolge is an encoder/decoder for the positional instruction layer. It does
**not** execute Malbolge, does not model memory, registers, or the encryption
of cells other than the one you ask about, and does not plan control flow. For
execution use any engine in the `-bolge` family; for high-level construction
use a Classic or Free compiler/runtime. The coordinate command is only a
quotient/remainder view of source positions, not a claim about runtime
topology. `CLAIM_SCOPE <= EVIDENCE_SCOPE`.

Requires Python ≥ 3.8. No dependencies.
