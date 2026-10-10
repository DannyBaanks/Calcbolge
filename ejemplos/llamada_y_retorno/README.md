# Llamada y retorno

Un programa Malbolge Classic diseñado a mano desde cero: el principal llama a
una subrutina y la subrutina **vuelve** a quien la llamó.

```
ubBA@?>=<;:9876543210/.-,+*)('&%$#"!~}|{:yx7vutsrqponmlk+vh:'%
```

62 celdas. Entrada `AB` → salida `ABB`.

No se encontró con búsqueda ni parte de un programa conocido. No se afirma que
sea inédito: HeLL de Matthias Lutter ya construye subrutinas.

## La idea

En Malbolge, después de un `jmp` el registro `c` salta pero `d` **no**: sigue
avanzando uno por paso desde donde estaba. La subrutina aprovecha ese retraso.
Cuando llega a su propio `jmp`, `d` apunta a una celda del hueco que el
principal se saltó, y ahí está guardada la dirección de retorno. Nadie la
escribe en tiempo de ejecución: viene en el fuente.

```
celda   op     qué hace                                                    d
  0     in     lee 'A'                                                    0
  1     out    imprime 'A'                                                1
 2-39   nop    rampa
 40     jmp    LLAMADA: su carácter vale 58 → sigue en 59                 40
 41-42  nop    hueco
 43     (jmp)  DATO, nunca se ejecuta: vale 55 = dirección de retorno
 44-55  nop    hueco (55 = aterrizaje del retorno)
 56     out    tras volver: imprime lo que dejó la subrutina              44
 57     end    fin del principal                                          45
 58     nop    aterrizaje de la llamada
 59     in     SUBRUTINA: lee 'B'                                         41
 60     out    imprime 'B'                                                42
 61     jmp    RETORNO: lee mem[43] = 55 → sigue en 56                    43
```

La celda 43 se lee estáticamente como `jmp`, pero es un dato. Es la misma
trampa que se ve en el núcleo de la quine de Lutter: el opcode estático de una
celda no dice qué papel cumple.

## Del plan al Malbolge

`plan.txt` lista los ops tramo por tramo. Calcbolge convierte cada op en el
único carácter válido para esa celda (`(op - c) mod 94`) y produce
`llamada_y_retorno.mal`.

## Verificar

```bash
python3 verificar.py
```

Salida real (2026-09-12):

```text
oraculo Classic, entrada 'AB': HALTED, 46 pasos, salida b'ABB'
  PASS  salida ABB, HALTED, 46 pasos
  PASS  la traza reproduce al oraculo

recorrido de c (sin la rampa 2..39):
    c= 0  d= 0  in
    c= 1  d= 1  out
    c=40  d=40  jmp
    c=59  d=41  in
    c=60  d=42  out
    c=61  d=43  jmp
    c=56  d=44  out
    c=57  d=45  hlt
  saltos observados: [(40, 59), (61, 56)]
  PASS  llamada 40 -> 59 y retorno 61 -> 56
  PASS  termina en la celda 57 (entre quien llama y la subrutina)
  PASS  las celdas 41..55 nunca se ejecutan
  PASS  el retorno lee la direccion desde d = 43

runner Zig E10: status=HALTED steps=46 out_hex=414242 a=66 c=57 d=45
  PASS  Zig coincide con el oraculo (estado, pasos, salida, a, c, d)

control: la celda 43 deja de guardar 55
  celda 43 = 119: HALTED, 128 pasos, salida b'ABB', saltos [(40, 59), (61, 120), (155, 38)]
  PASS  sin la direccion correcta el retorno no vuelve a 56

sin entrada (EOF): HALTED, 46 pasos, salida b'\xa8\xa8\xa8'  (59048 % 256 = 168)
  PASS  con EOF sigue el mismo camino e imprime 0xA8 tres veces

LLAMADA_Y_RETORNO=PASS (9/9)
```

La verificacion compara el oraculo Python Classic con el runner Zig en E10.
En Windows usa `intermediate_vm_runner.exe`; en Linux necesita `zig` en `PATH`
y compila el runner en un directorio temporal, sin escribir artefactos en
`MALBOLGE/`.

## Lo más importante del control

Con la dirección de retorno rota (celda 43 = 119), el retorno se va a la celda
120, dentro del relleno crazy-fill, y el programa termina 128 pasos después
**imprimiendo también `ABB`**.

Un test que solo mirara la salida aprobaría el programa roto. Lo que separa al
correcto del roto es el recorrido de `c` (61 → 56 contra 61 → 120). Por eso la
verificación exige la traza, no solo la salida.

## Límites

- La subrutina se puede llamar **una sola vez**: Malbolge cifra cada celda
  después de ejecutarla, así que un segundo paso por 59–61 ejecutaría otras
  instrucciones. Reutilizarla exigiría restaurar esas celdas, que es lo que hace
  el núcleo de la quine.
- La dirección de retorno es fija: el principal no puede elegir a dónde volver.
- No está optimizado para tamaño. Se puede acortar acercando la llamada a la
  subrutina.

## La familia completa: buscar formas, no celdas

Fijada la forma (llamada, subrutina de 3 ops, retorno), la posición fuerza casi
todo: la llamada en `k` aterriza en su propio carácter, la celda del dato es
`k + 3` y el retorno cae en uno de los 8 valores válidos de esa celda.
Enumerar esas formas en vez de enumerar celdas:

```powershell
py familia.py
```

```text
formas derivadas por aritmetica de posicion: 396 (retorno hacia atras: 213)
ejecutadas en el oraculo Classic: 396/396 llaman, vuelven donde se predijo, imprimen ABB y terminan en R+1  (53 s)
la mas corta: 56 celdas, llamada en 46, subrutina en 53, dato en 49, retorno a 50
  ubBA@?>=<;:9876543210/.-,+*)('&%$#"!~}|{zyxwvu4sr11|n@-+
espacio exhaustivo equivalente a 62 celdas: 8^62 = 9.81e+55
FAMILIA_LLAMADA_Y_RETORNO=PASS
```

Autobolge ya busca en el espacio de opcodes (`zig/frontier_scan.zig`: 8^longitud
candidatos, carácter `chr(33 + (opcode - 33 - pos) % 94)`), así que darle la
fórmula no le añade nada. Lo que esta familia muestra es otra cosa: la
aritmética de posición vuelve calculables los saltos antes de ejecutar, y eso
reduce una forma de 62 celdas de 8^62 candidatos a 396, todas verificadas.

Límite: alguien tiene que proponer la forma. Aquí se verificó una sola familia,
con una sola entrada (`AB`) y una sola llamada por programa.
