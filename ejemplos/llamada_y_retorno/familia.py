#!/usr/bin/env python3
"""La familia completa de la forma 'llamada y retorno', derivada por aritmetica
de posicion y ejecutada entera en el oraculo Classic.

La forma: in, out en 0-1; jmp de llamada en k; subrutina in, out, jmp; al volver
out, end. Con la forma fija, casi todo queda forzado por la posicion:

  - la llamada en k aterriza en char(jmp, k) y sigue en s = char + 1
  - al llegar al jmp de retorno, d vale k + 3  -> la celda del dato es D = k + 3
  - el dato solo puede ser uno de los 8 caracteres validos en D
  - el retorno cae en ese valor y sigue en R = valor + 1

Se enumeran FORMAS, no celdas: para comparar, el espacio exhaustivo de 62 celdas
es 8^62 ~ 9.8e55 programas.
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1]))
import calcbolge as cb  # noqa: E402
import verificar as V  # noqa: E402

JMP, IN, OUT, END, NOP = 4, 23, 5, 81, 68


def layouts():
    for k in range(2, 94):
        s = ord(cb.char_for(JMP, k)) + 1
        if s <= k + 4:
            continue
        D = k + 3
        if not (k < D < s - 1):
            continue
        for op in cb.OPS:
            R = ord(cb.char_for(op, D)) + 1
            used = set(range(0, k + 1)) | {s - 1, s, s + 1, s + 2, D}
            if R in used or R + 1 in used or R - 1 in (s, s + 1, s + 2):
                continue
            yield k, s, D, op, R


def build(k, s, D, dop, R) -> str:
    n = max(s + 2, R + 1) + 1
    plan = [NOP] * n
    plan[0], plan[1], plan[k] = IN, OUT, JMP
    plan[D] = dop
    plan[R], plan[R + 1] = OUT, END
    plan[s], plan[s + 1], plan[s + 2] = IN, OUT, JMP
    return "".join(cb.char_for(o, i) for i, o in enumerate(plan))


def main() -> int:
    t0 = time.time()
    family = list(layouts())
    ok, fails, shortest = 0, [], None
    for lay in family:
        k, s, D, dop, R = lay
        src = build(*lay)
        status, steps, out, path, _ = V.traced(src, b"AB")
        cs = [p[0] for p in path]
        jumps = [(cs[i], cs[i + 1]) for i in range(len(cs) - 1) if cs[i + 1] != cs[i] + 1]
        good = status == "HALTED" and out == b"ABB" and jumps == [(k, s), (s + 2, R)] and cs[-1] == R + 1
        ok += good
        if not good:
            fails.append((lay, status, out, jumps[:3]))
        if good and (shortest is None or len(src) < len(shortest[1])):
            shortest = (lay, src)
    backward = sum(1 for (k, s, D, op, R) in family if R < s)
    print(f"formas derivadas por aritmetica de posicion: {len(family)} (retorno hacia atras: {backward})")
    print(f"ejecutadas en el oraculo Classic: {ok}/{len(family)} llaman, vuelven donde se predijo, "
          f"imprimen ABB y terminan en R+1  ({time.time() - t0:.0f} s)")
    if shortest:
        (k, s, D, op, R), src = shortest
        print(f"la mas corta: {len(src)} celdas, llamada en {k}, subrutina en {s}, dato en {D}, retorno a {R}")
        print(f"  {src}")
    print(f"espacio exhaustivo equivalente a 62 celdas: 8^62 = {8 ** 62:.2e}")
    for f in fails[:5]:
        print("  FALLA:", f)
    print(f"FAMILIA_LLAMADA_Y_RETORNO={'PASS' if ok == len(family) else 'FAIL'}")
    return 0 if ok == len(family) else 1


if __name__ == "__main__":
    sys.exit(main())
