#!/usr/bin/env python3
"""Verifica 'llamada y retorno' contra dos motores Malbolge Classic independientes.

1. Oraculo Classic MALBOLGE/malbolge.py (salida, pasos, estado).
2. Traza del recorrido de c usando las funciones del propio oraculo.
3. Runner Zig MALBOLGE/intermediate_vm_runner.exe en E10 (anchura Classic).
4. Control: la celda 43 (direccion de retorno) cambiada por otro valor valido.
5. Caso sin entrada (EOF).
"""
from __future__ import annotations

import importlib.util
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
MALBOLGE = HERE.parents[2] / "MALBOLGE"
sys.path.insert(0, str(HERE.parents[1]))
import calcbolge as cb  # noqa: E402

spec = importlib.util.spec_from_file_location("oracle", MALBOLGE / "malbolge.py")
oracle = importlib.util.module_from_spec(spec)
spec.loader.exec_module(oracle)

SOURCE = (HERE / "llamada_y_retorno.mal").read_text(encoding="ascii")


def traced(source: str, stdin: bytes, max_steps: int = 10_000):
    """El bucle de malbolge.run, registrando c y d en cada paso."""
    mem = oracle.load_memory(source)
    a = c = d = steps = pos = 0
    out, path = bytearray(), []
    while steps < max_steps:
        steps += 1
        op = (mem[c] + c) % 94
        path.append((c, d, cb.OPS.get(op, ("nop",))[0]))
        if op == 4:
            c = mem[d]
        elif op == 5:
            out.append(a % 256)
        elif op == 23:
            if pos < len(stdin):
                a = stdin[pos]; pos += 1
            else:
                a = oracle.EOF_VALUE
        elif op == 39:
            v = mem[d]; mem[d] = v // 3 + (v % 3) * 3 ** 9; a = mem[d]
        elif op == 40:
            d = mem[d]
        elif op == 62:
            mem[d] = oracle.crazy(a, mem[d]); a = mem[d]
        elif op == 81:
            return "HALTED", steps, bytes(out), path, (a, c, d)
        if 33 <= mem[c] <= 126:
            mem[c] = oracle._ENCRYPT[mem[c]]
        c = (c + 1) % oracle.MEMORY_SIZE
        d = (d + 1) % oracle.MEMORY_SIZE
    return "OUT_OF_FUEL", steps, bytes(out), path, (a, c, d)


def zig(source: str, stdin: bytes):
    args = ["10", source.encode().hex(), stdin.hex(), "10000", "0", "0", "0"]
    if os.name == "nt":
        exe = MALBOLGE / "intermediate_vm_runner.exe"
        p = subprocess.run([str(exe), *args], capture_output=True, text=True, timeout=60)
    else:
        zig_compiler = shutil.which("zig")
        if zig_compiler is None:
            raise RuntimeError("Linux verification needs Zig on PATH to build the Classic runner")
        with tempfile.TemporaryDirectory(prefix="calcbolge-runner-") as temp_dir:
            exe = Path(temp_dir) / "intermediate_vm_runner"
            subprocess.run(
                [zig_compiler, "build-exe", str(MALBOLGE / "intermediate_vm_runner.zig"),
                 "-O", "ReleaseFast", f"-femit-bin={exe}"],
                check=True,
                capture_output=True,
                text=True,
                timeout=120,
            )
            p = subprocess.run([str(exe), *args], capture_output=True, text=True, timeout=60)
    if p.returncode:
        raise RuntimeError(f"Classic runner exited {p.returncode}: {p.stderr.strip()}")
    line = next((l for l in (p.stderr + p.stdout).splitlines() if l.startswith("RESULT")), None)
    if line is None:
        raise RuntimeError(f"Classic runner emitted no RESULT line: {p.stderr.strip()}")
    return dict(t.split("=", 1) for t in line.split()[1:])


def check(name: str, ok: bool) -> bool:
    print(f"  {'PASS' if ok else 'FAIL'}  {name}")
    return ok


def main() -> int:
    results = []
    print(f"programa ({len(SOURCE)} celdas): {SOURCE}\n")

    status, steps, out = oracle.run(SOURCE, b"AB")
    t_status, t_steps, t_out, path, (a, c, d) = traced(SOURCE, b"AB")
    print(f"oraculo Classic, entrada 'AB': {status}, {steps} pasos, salida {out!r}")
    results.append(check("salida ABB, HALTED, 46 pasos", (status, steps, out) == ("HALTED", 46, b"ABB")))
    results.append(check("la traza reproduce al oraculo", (t_status, t_steps, t_out) == (status, steps, out)))

    cs = [p[0] for p in path]
    print("\nrecorrido de c (sin la rampa 2..39):")
    for c_, d_, op in path:
        if not 2 <= c_ <= 39:
            print(f"    c={c_:>2}  d={d_:>2}  {op}")
    jumps = [(cs[i], cs[i + 1]) for i in range(len(cs) - 1) if cs[i + 1] != cs[i] + 1]
    print(f"  saltos observados: {jumps}")
    results.append(check("llamada 40 -> 59 y retorno 61 -> 56", jumps == [(40, 59), (61, 56)]))
    results.append(check("termina en la celda 57 (entre quien llama y la subrutina)", cs[-1] == 57))
    results.append(check("las celdas 41..55 nunca se ejecutan", not any(41 <= x <= 55 for x in cs)))
    ret = next(p for p in path if p[0] == 61)
    results.append(check("el retorno lee la direccion desde d = 43", ret[1] == 43))

    z = zig(SOURCE, b"AB")
    print(f"\nrunner Zig E10: status={z['status']} steps={z['steps']} out_hex={z['out_hex']} a={z['a']} c={z['c']} d={z['d']}")
    results.append(check("Zig coincide con el oraculo (estado, pasos, salida, a, c, d)",
                         (z["status"], int(z["steps"]), bytes.fromhex(z["out_hex"]), int(z["a"]), int(z["c"]), int(z["d"]))
                         == (status, steps, out, a, c, d)))

    print("\ncontrol: la celda 43 deja de guardar 55")
    mutant = SOURCE[:43] + cb.char_for(68, 43) + SOURCE[44:]
    m_status, m_steps, m_out, m_path, _ = traced(mutant, b"AB")
    m_jumps = [(m_path[i][0], m_path[i + 1][0]) for i in range(len(m_path) - 1) if m_path[i + 1][0] != m_path[i][0] + 1]
    print(f"  celda 43 = {ord(mutant[43])}: {m_status}, {m_steps} pasos, salida {m_out[:12]!r}, saltos {m_jumps[:3]}")
    results.append(check("sin la direccion correcta el retorno no vuelve a 56", (61, 56) not in m_jumps))

    e_status, e_steps, e_out = oracle.run(SOURCE, b"")
    print(f"\nsin entrada (EOF): {e_status}, {e_steps} pasos, salida {e_out!r}  (59048 % 256 = {59048 % 256})")
    results.append(check("con EOF sigue el mismo camino e imprime 0xA8 tres veces", (e_status, e_steps, e_out) == ("HALTED", 46, b"\xa8\xa8\xa8")))

    print(f"\nLLAMADA_Y_RETORNO={'PASS' if all(results) else 'FAIL'} ({sum(results)}/{len(results)})")
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
