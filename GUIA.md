# Guia de uso

## Primer comando

Desde esta carpeta:

```bash
python3 calcbolge.py encode nop 17
```

Salida real (2026-10-10):

```text
position 17  opcode 68 (nop)  ->  '3'   ascii 51
  check: (51 + 17) mod 94 = 68
  effect: no effect
  after it executes this cell becomes ')'
```

## Regla de oro

Calcbolge escribe y lee la capa posicional Classic; no ejecuta el programa.
Usa posiciones de celda `0..59048`. La coordenada `v` que muestra `coords` es
solo el cociente de dividir la posicion entre 94; no forma parte del decoder.
El curso web que acompana a la herramienta si incluye un runner Classic
independiente para sus ejercicios; no cambia el alcance del CLI.

## Curso web: Malbolge desde cero

La carpeta `curso/` contiene una web estatica en espanol con 100 retos en diez
niveles, editor local, pruebas oficiales y una VM Classic ejecutada en Web
Worker. El reto 100 verifica la quine de Matthias Lutter por huella del fuente,
estado final y huella de salida.

Desde la raiz de Calcbolge, inicia un servidor local:

```bash
python3 -m http.server 8000 --directory curso
```

Abre <http://localhost:8000/>. Los programas y el progreso no se envian a
ningun servidor. Para los retos de `cat`, raiz digital y adder, descarga los
artefactos desde malbolge.org y cargalos en la mesa de trabajo; no estan
copiados dentro del curso. El archivo descargable `cat.mal` termina al llegar
a EOF; el fragmento corto incluido en la pagina del cat es distinto y no
termina, por lo que su reto compara una salida acotada.

Las pruebas del curso corren con:

```bash
node --test tests/test_curso.mjs
```

## La formula

Quieres el opcode OP en la celda C. Que caracter escribes?

```
opcode = (ascii + c) mod 94     <- lo que calcula la VM
r      = (opcode - c) mod 94
ASCII  = 33 + ((opcode - c - 33) mod 94) <- caracter imprimible
```

Los caracteres graficos son 33..126 = **94** valores, los mismos 94 del
alfabeto de ejecucion. Asi que para cada par (opcode, posicion) hay
**exactamente un** caracter valido. Si `r` queda en 0..32, se suma 94 para
llevarlo al rango imprimible.

## Un opcode en una posicion

```bash
python3 calcbolge.py encode jmp 0
```

```text
position 0  opcode 4 (jmp)  ->  'b'   ascii 98
  check: (98 + 0) mod 94 = 4
  effect: c = mem[d]
  after it executes this cell becomes 'T'
```

Ese 'b' es la primera letra de la quine de Lutter.

## Al reves: que hace un caracter en una posicion

```bash
python3 calcbolge.py decode 4 10
```

```text
'4' (ascii 52) at position 10  ->  opcode 62 (opr)
  effect: r = crazy(a, mem[d]); mem[d] = r; a = r
```

El mismo '4' en la celda 16 es un nop. La posicion es media instruccion.

## Rampas: el truco que lo hace escribible

Las posiciones son independientes. Si sube la posicion, baja el caracter.
Una tirada del mismo opcode es una cuesta ASCII hacia abajo.

```bash
python3 calcbolge.py ramp nop 3 12
```

```text
12 x nop (opcode 68) starting at position 3:

A@?>=<;:9876

  ascii: 65 down to 54
  verified: 12/12 cells decode to nop
```

## Ensamblar una secuencia completa

Escribes lo que quieres que HAGA la maquina. La aritmetica posicional deja
de ser tu problema. El sufijo `*N` repite.

```bash
python3 calcbolge.py asm "jmp in movd nop*7 opr nop*11"
```

```text
22 cells starting at position 0:

bt&A@?>=<;49876543210/

  verified: 22/22 cells decode to the requested opcode
  reads as: jmp in movd nop nop nop nop nop nop nop opr nop nop nop nop nop ...
```

Esos 22 caracteres son **identicos** a las primeras 22 celdas de la quine de
Lutter. La herramienta no se ajusto a ese resultado: la aritmetica cae ahi.

## El menu completo de una celda (para code golf)

```bash
python3 calcbolge.py table 0 6
```

```text
    pos |  jmp |  out |   in |  rot | movd |  opr |  nop |  hlt
-----------------------------------------------------------------
      0 |  'b' |  'c' |  'u' |  "'" |  '(' |  '>' |  'D' |  'Q'
      1 |  'a' |  'b' |  't' |  '&' |  "'" |  '=' |  'C' |  'P'
      2 |  '`' |  'a' |  's' |  '%' |  '&' |  '<' |  'B' |  'O'
      3 |  '_' |  '`' |  'r' |  '$' |  '%' |  ';' |  'A' |  'N'
      4 |  '^' |  '_' |  'q' |  '#' |  '$' |  ':' |  '@' |  'M'
      5 |  ']' |  '^' |  'p' |  '"' |  '#' |  '9' |  '?' |  'L'
```

## Reusar un caracter que ya tienes (golf)

Un caracter significa 8 cosas distintas segun donde lo pongas. El ciclo es
de periodo 94, asi que cualquier caracter puede ser cualquiera de las 8
instrucciones en la celda correcta.

```bash
python3 calcbolge.py golf 4 94
```

```text
'4' (ascii 52) over the next 94 positions:

 opcode   name  first position
      4    jmp  c = 46, then every 94 (next 140)
      5    out  c = 47, then every 94 (next 141)
     23     in  c = 65, then every 94 (next 159)
     39    rot  c = 81, then every 94 (next 175)
     40   movd  c = 82, then every 94 (next 176)
     62    opr  c = 10, then every 94 (next 104)
     68    nop  c = 16, then every 94 (next 110)
     81    hlt  c = 29, then every 94 (next 123)

  a character's opcode cycles with period 94, so every character
  can serve as all 8 instructions given the right cell.
```

Fijate: '4' da opr en c=10 y nop en c=16. Son **exactamente** las dos
posiciones donde Lutter lo usa en su quine.

## Coordenadas de fase

Cada posicion tiene una descomposicion de cociente y resto:

```
u = c mod 94
v = floor(c / 94)
c = u + 94v
```

El decoder usa `u`; las posiciones `c`, `c+94`, `c+188`, etc. tienen la misma
fase. Esto solo describe como se indexan las posiciones. En particular,
`29516 = 94 * 314` permite dibujar el conjunto `0..29515` como 314 filas por
94 columnas, pero no demuestra una geometria toroidal del runtime. Los
factores 94 y 314 comparten el factor 2, asi que esa factorizacion de conjuntos
no es un isomorfismo de grupos aditivos.

```bash
python3 calcbolge.py coords 29515 nop
```

Salida real (2026-10-10):

```text
position 29515 = (u=93, v=313) where c = u + 94*v
  u = c mod 94; v = floor(c/94)
  decode uses u only: opcode = (ASCII + u) mod 94; v does not enter
  same phase in Classic memory: 628 positions, c = 93 + 94*k
  nop (68): r = (68 - 93) mod 94 = 69
  source: ASCII 69 -> 'E'; decode check = 68
```

## Verificar la herramienta

```bash
python3 calcbolge.py selftest
```

Salida real (2026-10-10):

```text
backend: standalone Classic positional formula

local roundtrip: PASS (472392 pairs, exhaustive)
Lutter opening vector: PASS (bt&A@?>=<;49876543210/)
encryption table is a permutation of 94 graphic chars: PASS
Lutter quine: 59032 cells, first 8 decode to 'jimnnnnn' (expect 'jimnnnnn' -> jmp in movd nop x5)
  cell 0 is jmp: PASS

SELFTEST=PASS
```

Tambien puedes ejecutar las pruebas unitarias:

```bash
python3 -m unittest discover -s tests -q
```

Salida real (2026-10-10):

```text
Ran 10 tests in 0.328s

OK
```

| Resultado | Significa | Que hacer |
| --- | --- | --- |
| `SELFTEST=PASS` | La formula pasa los 472392 roundtrips y los vectores conocidos | Puedes usar encode/decode/asm |
| `Lutter quine not found ... skipped` | No existe el artefacto opcional junto al checkout | La formula y el vector de 22 celdas siguen verificados |
| `SELFTEST=FAIL` | Fallo un roundtrip, vector o tabla local | No confies en la salida; revisa el error impreso |
| `position must be in 0..59048` | La posicion queda fuera de la memoria Classic | Corrige `c`; Free/Unshackled tienen otro perfil |

## Trampas

- Calcbolge **no ejecuta** Malbolge. Solo traduce la capa posicional de
  instrucciones. Para ejecutar usa cualquier motor de la familia -bolge.
- El cifrado post-ejecucion (`after`) se aplica a la celda de `c`, y si la
  instruccion fue un `jmp`, `c` ya cambio. La herramienta te da la tabla,
  no simula ese orden.
- No planifica flujo de control; el ejemplo de llamada y retorno requiere un
  verificador/runtime Classic por separado.
- No confundas los 59032 caracteres de la quine con las 59049 celdas de
  memoria del VM.
- `coords` no prueba que el runtime tenga cuatro dimensiones. Solo muestra
  `u=c mod 94` y `v=floor(c/94)` como indices de posiciones.

## Ejemplo de llamada y retorno

Desde la carpeta raiz de Calcbolge, el verificador compara el oraculo Python
Classic con el runner Zig. En Linux necesita `zig` en `PATH` y compila el
runner en una carpeta temporal; en Windows usa el `.exe` existente.

```bash
python3 ejemplos/llamada_y_retorno/verificar.py
```

Resultado real (2026-10-10; salida final del comando):

```text
LLAMADA_Y_RETORNO=PASS (9/9)
```
