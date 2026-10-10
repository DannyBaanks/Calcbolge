import { assemble, encodeOpcode } from "./classic-vm.mjs";

const lessons = [];
const units = [
  "El alfabeto imprimible",
  "Leer instrucciones por posición",
  "La inversa modular",
  "Las ocho instrucciones",
  "Escribir código por tramos",
  "Memoria, registros y ejecución",
  "Cifrado automodificable",
  "Ternario y operador crazy",
  "Trazas y programas de verdad",
  "Banco de pruebas y quine",
];

function add(title, concept, prompt, kind, expected, explanation, extra = {}) {
  const id = lessons.length + 1;
  lessons.push({
    id,
    unit: Math.ceil(id / 10),
    unitTitle: units[Math.floor((id - 1) / 10)],
    difficulty: Math.ceil(id / 10),
    title,
    concept,
    prompt,
    kind,
    expected,
    explanation,
    ...extra,
  });
}

function choice(title, concept, prompt, options, correct, explanation) {
  add(title, concept, prompt, "choice", String(correct), explanation, { options });
}

function text(title, concept, prompt, expected, explanation, kind = "text") {
  add(title, concept, prompt, kind, String(expected), explanation);
}

function source(title, concept, prompt, opcodes, start, explanation) {
  add(title, concept, prompt, "source", assemble(opcodes, start), explanation);
}

function opcodes(plan) {
  const names = {
    jmp: 4, out: 5, in: 23, rot: 39, movd: 40, opr: 62, nop: 68, end: 81, halt: 81,
  };
  const result = [];
  for (const token of plan.trim().split(/\s+/)) {
    const match = /^([a-z]+)(?:\*(\d+))?$/i.exec(token);
    if (!match || !(match[1].toLowerCase() in names)) throw new Error(`Invalid course plan: ${token}`);
    result.push(...Array(Number(match[2] ?? 1)).fill(names[match[1].toLowerCase()]));
  }
  return result;
}

// 01-10: printable characters and the basic positional equation.
choice("Una base rara", "Classic usa 94 caracteres gráficos.",
  "¿Cuántas posiciones tiene el alfabeto imprimible de Malbolge?", ["8", "94", "256", "59049"], 1,
  "Los códigos ASCII 33..126 son 94 caracteres, justo un ciclo módulo 94.");
text("Primer símbolo", "Identifica el primer ASCII imprimible.",
  "Escribe el código decimal ASCII de `!`.", 33, "`!` es el ASCII 33.", "number");
text("Último símbolo", "Cierra el rango imprimible.",
  "Escribe el código decimal ASCII de `~`.", 126, "`~` es el ASCII 126.", "number");
choice("El alfabeto completo", "Reconoce el rango fuente.",
  "¿Qué rango puede aparecer como una celda fuente gráfica válida?", ["0..93", "32..125", "33..126", "0..255"], 2,
  "Cada celda fuente válida es un ASCII imprimible entre 33 y 126, inclusive.");
text("Codifica un NOP", "Aplica la inversa en la primera celda.",
  "¿Qué carácter codifica `nop` (opcode 68) en la posición 0?", encodeOpcode(68, 0),
  "r=(68−0) mod 94=68, y ASCII 68 es `D`.", "char");
text("El tres misterioso", "La posición cambia la instrucción.",
  "¿Qué opcode produce el carácter `3` en la posición 17?", 68,
  "(ASCII 51 + posición 17) mod 94 = 68, que es NOP.", "number");
text("Salto al inicio", "Codifica un JMP sin calculadora.",
  "¿Qué carácter da opcode 4 en la posición 0?", encodeOpcode(4, 0),
  "r=4 y el representante imprimible ASCII 98 es `b`.", "char");
text("Decodifica la suma", "Calcula opcode=(ASCII+c) mod 94.",
  "Calcula (51 + 17) mod 94.", 68, "La suma ya es menor que 94: el resultado es 68.", "number");
text("OUT en la primera celda", "Codifica una salida.",
  "¿Qué carácter da opcode 5 (OUT) en la posición 0?", encodeOpcode(5, 0),
  "ASCII 99 es `c`; (99+0) mod 94 = 5.", "char");
text("Encuentra la posición", "Despeja c módulo 94.",
  "El carácter `.` (ASCII 46) debe dar opcode 5. ¿Cuál es la primera posición no negativa válida?", 53,
  "(46+c) mod 94=5; el menor c no negativo es 53.", "number");

// 11-20: inverse decoding and phase periodicity.
text("El opcode de Q", "Lee una celda en su posición real.",
  "¿Qué opcode produce `Q` (ASCII 81) en la posición 0?", 81,
  "(81+0) mod 94=81: HALT.", "number");
text("Un ! en la celda 65", "El mismo símbolo cambia con c.",
  "¿Qué opcode produce `!` en la posición 65?", 4,
  "(33+65) mod 94=4: JMP.", "number");
text("Una fase después", "Las fases se repiten cada 94 celdas.",
  "¿Qué opcode produce `D` en la posición 94?", 68,
  "94 mod 94=0; `D` vuelve a decodificar como opcode 68.", "number");
text("ROT en la celda 5", "Invierte una instrucción en otra fase.",
  "¿Qué carácter codifica ROT (39) en la posición 5?", encodeOpcode(39, 5),
  "(39−5) mod 94=34; ASCII 34 es la comilla doble.", "char");
text("HALT casi al final", "Practica el wrap del alfabeto.",
  "¿Qué carácter codifica HALT (81) en la posición 93?", encodeOpcode(81, 93),
  "(81−93) mod 94=82; el carácter ASCII 82 es `R`.", "char");
choice("La fase no es el registro", "Separa índice de estado de VM.",
  "¿Qué coordenada usa la ecuación de opcode al descomponer c=u+94v?",
  ["u=c mod 94", "v=floor(c/94)", "a", "d"], 0,
  "El decode clásico solo depende de c mod 94; v es el cociente de índice.");
text("El 4 en c=10", "Observa un carácter en contexto.",
  "En la celda 10, ¿qué instrucción es el carácter `4`?", 62,
  "(52+10) mod 94=62: OPR.", "number");
text("El mismo 4 en c=16", "La posición forma parte de la instrucción.",
  "En la celda 16, ¿qué instrucción es el mismo carácter `4`?", 68,
  "(52+16) mod 94=68: NOP.");
text("Otra vuelta", "Calcula el alias periódico de una celda.",
  "Si `c=17`, ¿cuál es la siguiente posición con la misma fase?", 111,
  "La fase se repite al sumar 94: 17+94=111.", "number");
text("Doblar el residuo", "Convierte un residuo bajo en ASCII gráfico.",
  "Si r=32, ¿qué ASCII imprimible lo representa?", 126,
  "Los residuos 0..32 se desplazan 94 posiciones: 32+94=126.", "number");

// 21-30: modular arithmetic and source construction.
text("Wrap de una suma", "Ahora sí hay que envolver módulo 94.",
  "Calcula (10 + 90) mod 94.", 6, "100−94=6.", "number");
text("Residuo negativo", "Usa el residuo no negativo.",
  "¿Cuánto vale −1 módulo 94 en la convención 0..93?", 93,
  "−1 es una unidad debajo de 0; al envolver queda 93.", "number");
text("Codifica JMP en c=93", "Combina wrap y representante gráfico.",
  "¿Qué carácter codifica opcode 4 en la posición 93?", encodeOpcode(4, 93),
  "r=(4−93) mod 94=5; al salir del rango gráfico, 5+94=99, `c`.", "char");
text("Codifica OPR en c=3", "Normaliza a un ASCII imprimible.",
  "¿Qué carácter codifica opcode 62 en la posición 3?", encodeOpcode(62, 3),
  "r=59, que ya es imprimible: ASCII 59 es `;`.", "char");
text("Busca dónde vive JMP", "Resuelve la ecuación para c.",
  "¿Cuál es la primera posición que hace que `?` (ASCII 63) sea JMP?", 35,
  "(63+35) mod 94=4.", "number");
text("Decodifica una fase tardía", "La posición puede pasar de 94.",
  "¿Qué opcode produce `,` (ASCII 44) en c=101?", 51,
  "101 mod 94=7; (44+7) mod 94=51.", "number");
text("La última celda Classic", "El rango de direcciones es finito.",
  "¿Qué carácter codifica NOP en la posición 59048?", encodeOpcode(68, 59048),
  "59048 mod 94=16; (68−16) mod 94=52, ASCII `4`.", "char");
text("Un símbolo arbitrario", "Decodifica aunque no sea un opcode válido.",
  "¿Qué residuo produce `?` (ASCII 63) en la posición 51?", 20,
  "(63+51) mod 94=20. El decoder puede calcularlo aunque 20 no sea instrucción.", "number");
choice("Un representante único", "Entiende por qué la codificación se puede invertir.",
  "Para una pareja (opcode, posición), ¿cuántos caracteres gráficos válidos existen?",
  ["Ninguno", "Uno", "Dos", "94"], 1,
  "Los 94 ASCII gráficos representan exactamente una vez cada residuo módulo 94.");
choice("La forma inversa", "Elige una fórmula que siempre regresa al rango 33..126.",
  "¿Cuál es la forma directa de convertir opcode y c en ASCII imprimible?",
  ["opcode+c", "33+((opcode−c−33) mod 94)", "(opcode−c) mod 256", "c−opcode"], 1,
  "33+((opcode−c−33) mod 94) produce exactamente un valor de 33 a 126.");

// 31-40: instruction semantics, validity and loader rules.
choice("JMP", "Un salto toma su destino de memoria.",
  "¿Qué hace opcode 4?", ["A=crazy(A,[D])", "C=[D]", "A=entrada", "imprime A"], 1,
  "JMP asigna a C el valor de la celda apuntada por D.");
choice("OUT", "La salida es un byte.",
  "¿Qué produce opcode 5?", ["A mod 256", "D mod 94", "el carácter fuente", "nada"], 0,
  "OUT añade A mod 256 al flujo de salida.");
choice("IN", "La entrada llega al acumulador.",
  "¿Qué registro cambia al ejecutar IN?", ["C", "D", "A", "la celda fuente"], 2,
  "IN pone en A el siguiente byte de entrada; EOF tiene semántica definida aparte.");
choice("EOF en el oráculo del curso", "Aprende la convención verificable de este perfil Classic.",
  "¿Qué valor toma A al leer EOF en este curso?", ["−1", "0", "59048", "94"], 2,
  "El oráculo Classic del curso sigue la convención original: EOF=59048.");
choice("ROT", "La rotación transforma la celda de datos.",
  "¿Qué celda rota la instrucción ROT?", ["mem[C]", "mem[D]", "mem[A]", "mem[C+1]"], 1,
  "ROT aplica la rotación ternaria a mem[D] y copia el resultado a A.");
choice("MOVD", "D puede saltar independientemente de C.",
  "¿Cuál es el efecto de MOVD?", ["D=mem[D]", "C=mem[C]", "A=mem[D]", "D=C"], 0,
  "MOVD carga en D el valor almacenado en mem[D].");
choice("OPR", "Crazy es una operación ternaria sobre palabras.",
  "¿Qué dos valores recibe OPR?", ["A y mem[D]", "C y D", "mem[C] y mem[C−1]", "ASCII y 94"], 0,
  "OPR calcula crazy(A, mem[D]), guarda el resultado en mem[D] y también en A.");
choice("NOP", "La instrucción más tranquila.",
  "¿Qué efecto directo tiene NOP?", ["Detiene", "No modifica registros", "Lee entrada", "Cifra toda la memoria"], 1,
  "NOP no cambia registros ni celdas; el avance y cifrado de la máquina siguen.");
choice("HALT", "Fin de ejecución.",
  "¿Qué opcode detiene el programa?", ["4", "40", "68", "81"], 3,
  "81 es HALT (también llamado END en algunas tablas).");
choice("El loader no es un editor libre", "Un programa Classic debe cargar legalmente.",
  "¿Qué requiere el loader clásico para cada carácter del fuente?",
  ["ASCII gráfico y opcode legal en esa posición", "Cualquier Unicode", "solo módulo 94", "que sea NOP"], 0,
  "El fuente debe ser imprimible y cada celda debe decodificar a una instrucción legal.");

// 41-50: ramps and writing real source by hand.
source("Rampa NOP de cuatro celdas", "Una instrucción repetida crea una rampa.",
  "Escribe las cuatro celdas NOP desde c=0.", Array(4).fill(68), 0,
  "Al avanzar una celda el carácter baja uno: `D C B A`.");
source("Tres instrucciones", "Pasa de nombres a caracteres fuente.",
  "Escribe IN, OUT, HALT desde c=0.", opcodes("in out end"), 0,
  "El plan se codifica celda por celda; el resultado debe cargar como Classic válido.");
source("Una rampa desde c=3", "Los NOP no tienen que empezar en cero.",
  "Codifica siete NOP consecutivos desde c=3.", Array(7).fill(68), 3,
  "La rampa es `A@?>=<;`.");
source("Inserta un OUT", "Un cambio de instrucción no desplaza el plan.",
  "Escribe NOP, NOP, OUT, NOP, NOP desde c=0.", [68, 68, 5, 68, 68], 0,
  "Cada opcode se calcula con su posición absoluta; lo que insertas no cambia las celdas posteriores.");
text("El carácter del OPR", "Usa la posición del código, no solo el número.",
  "¿Qué carácter codifica OPR (62) en la celda 10?", encodeOpcode(62, 10),
  "(62−10) mod 94=52, ASCII `4`.", "char");
text("Vuelve a ser NOP", "Un mismo símbolo cambia al desplazarse.",
  "¿Qué carácter codifica NOP en la celda 17?", encodeOpcode(68, 17),
  "La respuesta es `3`; al sumar la posición vuelve a 68.", "char");
text("Mismo símbolo, otro opcode", "Decodifica el ejemplo clásico.",
  "¿Qué opcode es `4` en la posición 10?", 62,
  "(52+10) mod 94=62.", "number");
text("Mismo símbolo, seis celdas después", "Observa la periodicidad dentro del ejemplo.",
  "¿Qué opcode es `4` en la posición 16?", 68,
  "(52+16) mod 94=68.");
source("Plan de seis pasos", "Codifica un programa pequeño.",
  "Escribe JMP, IN, OUT, NOP, OUT, HALT desde c=0.", opcodes("jmp in out nop out end"), 0,
  "Se ensamblan 6 instrucciones, con cada carácter comprobable en su posición.");
const opening = opcodes("jmp in movd nop*7 opr nop*11");
source("La apertura de la quine", "La aritmética posicional ya construye una secuencia real.",
  "Escribe las primeras 22 celdas del plan JMP IN MOVD NOP×7 OPR NOP×11.", opening, 0,
  "El resultado coincide con la apertura publicada de la quine de Lutter; es solo el prefijo, no la quine completa.");

// 51-60: machine state and execution order.
choice("Estado inicial del laboratorio", "Fija el estado inicial del oráculo de las lecciones.",
  "¿Con qué valores empiezan A, C y D en las trazas de este laboratorio?",
  ["A=1,C=1,D=1", "A=0,C=0,D=0", "A=EOF,C=0,D=59048", "No se fijan"], 1,
  "El runner de enseñanza usa A=C=D=0 para hacer las trazas reproducibles.");
choice("Un byte de salida", "Interpreta OUT con precisión.",
  "Si A=300, ¿qué byte imprime OUT?", ["300", "44", "256", "0"], 1,
  "300 mod 256=44.");
choice("Entrada de un carácter", "Vincula IN con A.",
  "Si el siguiente byte de entrada es `Z` (ASCII 90), ¿qué queda en A tras IN?", ["5", "68", "90", "59048"], 2,
  "IN consume el byte 90 y lo copia a A.");
choice("Los punteros avanzan", "Una instrucción no termina toda la actualización.",
  "Después de una instrucción no HALT, ¿qué hacen normalmente C y D?", ["Ambos avanzan una celda", "Solo C retrocede", "Ambos se ponen en cero", "Solo cambia A"], 0,
  "Tras el efecto de instrucción y el cifrado, C y D avanzan módulo 59049.");
choice("Orden de un JMP", "El salto interactúa con la celda de aterrizaje.",
  "En el oráculo Classic del curso, después de JMP a mem[D], ¿qué celda se cifra?",
  ["Siempre la celda JMP original", "La celda de destino", "La celda D+1", "Todas"], 1,
  "El destino pasa a ser C antes del cifrado posterior a la instrucción.");
choice("D no es C", "Los saltos no teletransportan ambos registros.",
  "Al ejecutar JMP, ¿qué pasa directamente con D?", ["Se carga con el destino", "No salta; avanza en el paso normal", "Se copia desde C", "Se pone en EOF"], 1,
  "JMP modifica C. D mantiene su flujo y se incrementa en el avance normal.");
choice("La lectura cambia A", "Entra un nuevo estado.",
  "Si A=0 y se lee `A` con IN, ¿qué byte queda en A?", ["0", "65", "94", "255"], 1,
  "El ASCII de la letra A es 65.");
choice("El movimiento de D", "MOVD lee memoria y después ocurre el avance.",
  "Si mem[D]=123, ¿qué valor asigna MOVD a D?", ["D=123", "A=123", "C=123", "mem[123]=D"], 0,
  "El efecto directo de MOVD es D=mem[D].");
choice("Dirección de retorno fija", "La llamada manual usa un dato fuente como destino.",
  "En el ejemplo de llamada/retorno de Calcbolge, ¿dónde guarda el programa la dirección fija de retorno?",
  ["En el carácter de salida", "En una celda de fuente no ejecutada", "En Unicode", "En el registro A"], 1,
  "Una celda que parece JMP puede actuar como dato cuando el flujo no la ejecuta.");
choice("Las dos mitades", "Usa la estructura descrita por Lutter.",
  "Según la página oficial de la quine, ¿qué intervalos forman código y datos?",
  ["0..29515 y 29516..59031", "0..59048 y 59049..", "0..93 y 94..187", "solo un bloque"], 0,
  "La quine publicada separa código y datos en dos bloques de 29 516 caracteres.");

// 61-70: the character encryption that changes future visits.
const encryptionTable = "5z]&gqtyfr$(we4{WP)H-Zn,[%\\3dL+Q;>U!pJS72FhOA1CB6v^=I_0/8|jsb9m<.TVac`uY*MK'X~xDl}REokN:#?G\"i@";
function encrypted(character) {
  return encryptionTable[character.charCodeAt(0) - 33];
}
text("Cifrado de la exclamación", "Cada carácter gráfico tiene sucesor en XLAT.",
  "¿En qué carácter se convierte `!` tras ejecutarse?", encrypted("!"),
  "La tabla de traducción XLAT empieza con `! → 5`.", "char");
text("Cifrado de D", "Busca el reemplazo, no el opcode.",
  "¿En qué carácter se convierte `D` tras ejecutarse?", encrypted("D"),
  "El cifrado pos-ejecución es una permutación fija de los 94 gráficos.", "char");
text("Cifrado de 4", "Las celdas ejecutadas mutan.",
  "¿En qué carácter se convierte `4` tras ejecutarse?", encrypted("4"),
  "Es la celda de la tabla XLAT indexada por ASCII−33.", "char");
text("Cifrado de tilde", "También se cifra el extremo superior.",
  "¿En qué carácter se convierte `~` tras ejecutarse?", encrypted("~"),
  "La tabla cubre todo el alfabeto imprimible, incluido `~`.", "char");
choice("Permutación, no azar", "Distingue automodificación de aleatoriedad.",
  "¿Qué describe el cifrado clásico de una celda ejecutada?",
  ["Una permutación fija de 94 símbolos", "Un carácter aleatorio", "Una suma de 94", "Un borrado"], 0,
  "La tabla XLAT es determinista y permuta exactamente los 94 caracteres gráficos.");
choice("Una celda, una mutación", "El cifrado modifica una ubicación.",
  "En el paso normal de la VM, ¿qué celda se cifra?",
  ["La celda actual de C (después del efecto del salto)", "Toda la memoria", "Siempre mem[0]", "mem[A]"], 0,
  "El carácter de la celda ejecutada —o el destino tras JMP— se cifra antes del avance.");
choice("Segunda visita", "La instrucción futura puede cambiar.",
  "Si un JMP vuelve a una celda que ya se ejecutó, ¿qué debes decodificar?",
  ["Siempre el carácter fuente original", "El valor actual de memoria", "Solo A", "El código Unicode"], 1,
  "La primera ejecución cifra la memoria; una visita posterior decodifica el valor mutado.");
choice("Cifrado vs. decode", "No mezcles dos tablas distintas.",
  "¿El cifrado XLAT depende de la posición c?", ["Sí, suma c", "No, solo transforma el valor de la celda", "Depende de A", "Depende de D"], 1,
  "La posición entra al decode de opcode; XLAT es una permutación del carácter.");
choice("Un ciclo reproducible", "Los símbolos tienen órbitas deterministas.",
  "Si aplicas XLAT dos veces a la misma entrada, ¿el resultado depende de la máquina?",
  ["Sí, del azar", "No, es determinista", "Solo en Linux", "Solo si es NOP"], 1,
  "La misma tabla fija siempre da el mismo siguiente símbolo.");
choice("¿Qué se cifra en JMP?", "Comprueba el orden en el destino.",
  "JMP en c=40 lee destino 58. ¿Qué posición se cifra en ese paso?",
  ["40", "58", "59", "D+2"], 1,
  "La semántica del oráculo carga C=mem[D] antes del cifrado; se cifra la posición 58.");

// 71-80: ternary words and the crazy operator.
text("Diez trits", "Classic fija el ancho de cada palabra.",
  "¿Cuántos trits tiene una palabra Malbolge Classic?", 10,
  "Classic usa palabras de ancho fijo k=10.", "number");
text("Tamaño de memoria", "Cuenta las direcciones del perfil clásico.",
  "¿Cuánto vale 3¹⁰?", 59049, "Hay 59 049 celdas: las direcciones válidas son 0..59 048.", "number");
text("Última palabra", "Distingue cantidad de celdas y dirección máxima.",
  "¿Cuál es la dirección de la última celda Classic?", 59048,
  "59049 es la cantidad; la dirección de la última celda es 59048.", "number");
text("Rotación de un trit", "La rotación ternaria mueve el trit bajo al superior.",
  "¿Cuánto vale ROT(1) en una palabra de 10 trits?", 19683,
  "ROT(n)=floor(n/3)+(n mod 3)×3⁹; ROT(1)=3⁹=19683.", "number");
text("El segundo trit extremo", "Prueba otra vuelta ternaria.",
  "¿Cuánto vale ROT(2)?", 39366, "El trit 2 salta al extremo alto: 2×19683=39366.", "number");
text("Crazy de ceros", "Una tabla ternaria sorprende incluso en el caso mínimo.",
  "¿Cuánto da crazy(0,0) al repetir la entrada de la tabla diez trits?", 29524,
  "El resultado es diez trits 1: 1+3+…+3⁹=29524.", "number");
choice("Índices de crazy", "El orden de operandos importa.",
  "¿Cómo se indexa la tabla crazy del oráculo?", ["[a%3][b%3]", "[b%3][a%3]", "[a+b][3]", "[c%94][d%94]"], 1,
  "Por cada trit se lee CRAZY[b%3][a%3], luego se descartan ambos trits bajos.");
text("Crazy(0,1)", "Calcula trits poco a poco.",
  "¿Qué valor da crazy(0,1)?", 29524,
  "El trit bajo produce 1 y los nueve trits altos también quedan en 1.");
text("Crazy(1,0)", "Invierte operandos y observa la diferencia.",
  "¿Qué valor da crazy(1,0)?", 29523,
  "El trit bajo produce 0; los nueve trits superiores forman 29523.");
choice("Relleno de memoria", "La memoria no escrita también tiene estructura.",
  "¿Cómo se rellena Classic desde la última celda fuente?",
  ["Se llena de ceros", "mem[i]=crazy(mem[i−1],mem[i−2])", "Se copia el fuente", "Con números aleatorios"], 1,
  "El cargador extiende el programa con la cadena determinista de crazy.");

// 81-90: execution traces and the web's famous programs.
text("Ejecuta ubO", "El pequeño eco de tres instrucciones.",
  "El programa `ubO` hace IN, OUT, HALT. ¿Qué imprime con entrada `Z`?",
  "Z", "Lee Z, saca Z y detiene. El resultado es byte a byte el mismo.", "text");
text("Cuenta los pasos", "Cada instrucción ocupa un paso.",
  "¿Cuántos pasos tarda `ubO` con entrada `Z`?", 3,
  "Un paso para IN, uno para OUT y uno para HALT.", "number");
choice("Celda 1 de ubO", "Decodifica una instrucción dentro de un programa.",
  "En `ubO`, ¿qué hace la celda de índice 1?", ["IN", "OUT", "NOP", "HALT"], 1,
  "El carácter `b` en c=1 decodifica a opcode 5, OUT.");
text("Salto de llamada", "Sigue C sin mover el resto del estado.",
  "En el ejemplo de llamada, JMP ejecutado en c=40 aterriza en el carácter 58; ¿qué celda ejecuta después?",
  59, "El destino 58 se cifra y C incrementa; la siguiente instrucción corre en 59.", "number");
text("Retorno estático", "Un salto puede leer datos que no se ejecutan.",
  "En el ejemplo de Calcbolge, el JMP de retorno en c=61 lee 55 desde mem[43]. ¿Qué celdas ejecuta luego?",
  56, "JMP fija C=55 y el avance lo lleva a c=56.", "number");
choice("Dos cats distintos", "La página separa un cat perpetuo de uno que termina.",
  "¿Qué dice malbolge.org del pequeño cat mostrado en `cat.html`?",
  ["Termina al leer EOF", "No termina al leer EOF", "No usa IN", "No imprime bytes"], 1,
  "El fragmento didáctico no termina ante EOF; la descarga cat.mal es otro programa.");
choice("La descarga cat.mal", "Comprueba una propiedad del artefacto enlazado.",
  "¿Qué hace el `cat.mal` descargable de la página oficial en la prueba del curso?",
  ["Refleja la entrada y termina", "Siempre imprime cero", "Solo funciona con MEOW", "No tiene salida"], 0,
  "El curso verifica el artefacto descargable por fingerprint, ejecución y salida exacta.");
choice("Límite de salida", "Una ejecución puede cortarse por seguridad.",
  "¿Qué significa OUTPUT_LIMIT en el laboratorio?",
  ["El programa terminó por HALT", "El laboratorio cortó al alcanzar el máximo de bytes", "La fuente es inválida", "El programa fue compilado"], 1,
  "El límite protege la interfaz de loops y no es una afirmación de que la VM hizo HALT.");
choice("El caracter ilegal", "La posición importa también al validar el loader.",
  "¿Qué ocurre si una celda fuente imprimible no decodifica a los ocho opcodes legales?",
  ["La máquina la convierte en NOP al cargar", "El loader rechaza el programa", "Se ignora c", "Se cifra antes de arrancar"], 1,
  "El loader Classic valida cada instrucción del fuente y rechaza un opcode ilegal.");
choice("Más memoria no es más dimensión", "Separa dirección y una metáfora.",
  "¿Qué demuestra el par u=c mod 94 y v=floor(c/94)?",
  ["Una coordenatización por cociente y resto", "Una VM 4D", "Una topología física", "La ejecución de crazy"], 0,
  "Es una identidad de indexación; no prueba geometría intrínseca del runtime.");

// 91-99: exact, executable checks against the programs published at malbolge.org.
const officialHashes = {
  cat: "386f15f1e8c0bd982a6d7a2a4d3ffec64bb137af0b3db01b49287e0b4dab3ddc",
  digitalRoot: "0239ae24d3d299509e228ff76b3c77ad3f9dcea4d0500dee67e3a80510bf2e86",
  adder: "74b4e4d325af68aba7ca84b223dec406095b620fb261091a2e1874db597f47fa",
  infiniteCat: "8f84a46fda271bb397cc53dfd7a18a8c45ba3c47a35c64b05d4ac4214c6d880f",
  quineSource: "6812b7c10679f571887e84238d02ed1c2e0b4f013b8299a60f9ff5e3e9162543",
  quineOutput: "dca8476f8b70c8462c32f661f63c5f8b1ad6c33946b3c7a9a35186c824117d98",
};

function officialRun(title, concept, prompt, artifact, stdin, expectedOutput, options = {}) {
  const expected = options.outputLimit ? "OUTPUT_LIMIT" : "HALTED";
  const sourceHash = officialHashes[artifact];
  add(title, concept, prompt, "program", "", options.explanation ?? "La prueba ejecuta un artefacto publicado; el fuente se valida por fingerprint y su comportamiento, sin incluirlo en el curso.", {
    artifact,
    sourceHash,
    runCase: {
      stdin,
      expectedOutput: Array.from(expectedOutput, (ch) => ch.charCodeAt(0)),
      expectedStatus: expected,
      maxSteps: options.maxSteps ?? 1_000_000,
      maxOutput: options.outputLimit ? expectedOutput.length : 100_000,
      outputLimit: !!options.outputLimit,
    },
  });
}

officialRun("Carga el cat ejecutable", "Primer oráculo real de malbolge.org.",
  "Descarga `cat.mal` desde malbolge.org y cárgalo en el editor de abajo. Ejecuta la prueba corta con entrada `M`.",
  "cat", "M", "M", { maxSteps: 50_000 });
officialRun("El cat refleja una palabra", "Más de un byte y estado de ejecución completo.",
  "Con el mismo `cat.mal`, prueba la entrada `MEOW`. Debe devolver exactamente esos cuatro bytes y HALT.",
  "cat", "MEOW", "MEOW", { maxSteps: 50_000 });
officialRun("El cat conserva Latin-1", "Comprueba una entrada fuera de ASCII pero dentro de un byte.",
  "Con el cat oficial, ejecuta la entrada `ÿ` (U+00FF). La salida debe ser el byte FF, no UTF-8.",
  "cat", "ÿ", "ÿ", { maxSteps: 50_000 });
officialRun("EOF del cat", "Un cat que termina debe tratar EOF sin producir basura.",
  "Ejecuta el cat descargable con entrada vacía. ¿HALT y salida vacía?",
  "cat", "", "", { maxSteps: 50_000 });
officialRun("Raíz digital: nueve cifras", "Primera prueba del calculador oficial.",
  "Carga `digital_root.mal` desde malbolge.org y envíale `123456789`.",
  "digitalRoot", "123456789", "9\n", { maxSteps: 700_000 });
officialRun("Raíz digital: reducción", "La suma se repite hasta un dígito.",
  "Con el mismo programa, envíale `9876`; 9+8+7+6=30 y 3+0=3.",
  "digitalRoot", "9876", "3\n", { maxSteps: 400_000 });
officialRun("Adder: suma pequeña", "Prueba el adder oficial con dos operandos.",
  "Carga `adder.mal` desde malbolge.org y envíale `123 456`.",
  "adder", "123 456", "579\n", { maxSteps: 500_000 });
officialRun("Adder: límite documentado", "Lleva el adder al máximo de su contrato.",
  "Con el mismo programa, suma `999 999`. Ambos operandos están en el rango 0..999.",
  "adder", "999 999", "1998\n", { maxSteps: 500_000 });
officialRun("El cat que no termina", "Distingue el fragmento de la descarga.",
  "Copia el pequeño cat no terminante de `cat.html` en el editor. Con entrada `MEOW`, pide solo cuatro bytes de salida. El sandbox corta en OUTPUT_LIMIT; esos bytes deben ser `MEOW`.",
  "infiniteCat", "MEOW", "MEOW", { maxSteps: 1_000_000, outputLimit: true });

add(
  "Escribe la quine de Lutter",
  "El examen final: programa que imprime su propio fuente.",
  "Descarga `quine.mal` desde malbolge.org y escribe o carga su programa completo. El curso no te da el fuente. Para aprobar, las 59 032 celdas deben coincidir con el artefacto canónico y, al ejecutarlo, su salida debe coincidir byte por byte con la quine publicada, terminar en HALT y completar dentro del presupuesto.",
  "quine",
  "",
  "La fuente se compara por SHA-256 tras quitar solo espacios ASCII; luego se ejecuta en el runner Classic del curso. El hash de salida se compara con el archivo publicado completo, incluidos sus saltos de línea.",
  {
    artifact: "quine",
    sourceHash: officialHashes.quineSource,
    outputHash: officialHashes.quineOutput,
    sourceLength: 59_032,
    outputLength: 59_852,
    maxSteps: 75_000_000,
  },
);

if (lessons.length !== 100) {
  throw new Error(`El curso debe tener 100 retos; hay ${lessons.length}.`);
}

export { lessons, units };
