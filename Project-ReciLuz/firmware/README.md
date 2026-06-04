# ReciLuz — Firmware & Otimização de Algoritmos

Firmware do ESP32 para o sistema ReciLuz, com análise comparativa empírica entre duas estruturas de dados para gestão de histórico de sensores: **Array com Deslocamento O(n)** vs **Buffer Circular O(1)**.

---

## Sumário

1. [O Problema](#1-o-problema)
2. [As Duas Vertentes](#2-as-duas-vertentes)
3. [Implementação](#3-implementação)
4. [Arquitetura com FreeRTOS](#4-arquitetura-com-freertos)
5. [Benchmark de Escalabilidade](#5-benchmark-de-escalabilidade)
6. [Resultados Empíricos](#6-resultados-empíricos)
7. [Dashboard de Análise](#7-dashboard-de-análise)
8. [Como Gravar o Firmware](#8-como-gravar-o-firmware)
9. [Estrutura dos Arquivos](#9-estrutura-dos-arquivos)

---

## 1. O Problema

Em sistemas embarcados como o ESP32, existe uma disparidade temporal crítica entre duas operações:

| Operação | Escala de tempo |
|---|---|
| Leitura de sensor (ADC, DHT22, ultrassônico) | **µs** (microssegundos) |
| Transmissão de rede via MQTT/HTTP | **ms** (milissegundos) — até 1000× mais lento |

Se o sistema usar uma estrutura ingênua (array com deslocamento) para manter um histórico de leituras, o processador consome ciclos **linearmente proporcionais ao tamanho do histórico** a cada nova inserção — fenômeno que gera **jitter** (instabilidade temporal entre amostras) e pode levar ao colapso do sistema por stack overflow ou latência excessiva.

---

## 2. As Duas Vertentes

### Vertente 1 — Array com Deslocamento (Anti-Padrão) — `O(n)`

Quando o buffer está cheio e chega um novo elemento, **todos os N elementos existentes são deslocados uma posição à esquerda** para liberar o último slot:

```
Buffer cheio: [A][B][C][D][E]
Nova inserção de F:
  Passo 1 — shift: [B][C][D][E][_]   ← N-1 movimentações de memória
  Passo 2 — insert: [B][C][D][E][F]
```

Custo: **proporcional a N**. Quanto maior o histórico, mais lento fica cada inserção.

### Vertente 2 — Ring Buffer / Buffer Circular — `O(1)`

Usa dois índices inteiros (`head` e `tail`) que circulam pelo array com aritmética modular. **Nenhum elemento é movido**:

```
Buffer cheio (N=5): [A][B][C][D][E]
                     ↑              ↑
                    head           tail

Nova inserção de F:
  buf[tail] = F  →  [A][B][C][D][F]
  tail = (tail+1) % N  →  tail aponta para posição 0
  head = (head+1) % N  →  head avança, descartando A

Resultado: [F][B][C][D] com head=1, tail=0
```

Custo: **constante** — sempre 1 escrita + 2 incrementos + 1 módulo, independente de N.

---

## 3. Implementação

### `ineff_buffer.h` — Vertente 1

```cpp
template <typename T, size_t N>
class IneffBuffer {
public:
  bool push(const T& item) {
    if (_count == N) {
      // GARGALO: desloca N-1 elementos → O(n)
      for (size_t i = 0; i < N - 1; i++)
        _buf[i] = _buf[i + 1];
      _count = N - 1;
    }
    _buf[_count++] = item;
    return true;
  }
  // ...
private:
  T      _buf[N];
  size_t _count;
};
```

**Características:**
- Inserção: **O(n)** — loop percorre toda a coleção
- Remoção: **O(n)** — mesmo problema no `pop()`
- Memória: estática, sem fragmentação de heap
- Problema real: em N=20.000, cada inserção bloqueia a CPU por ~490ms

---

### `ring_buffer.h` — Vertente 2

```cpp
template <typename T, size_t N>
class RingBuffer {
public:
  bool push(const T& item) {
    _buf[_tail] = item;
    _tail = (_tail + 1) % N;   // aritmética modular O(1)
    if (_count == N)
      _head = (_head + 1) % N; // descarta o mais antigo
    else
      _count++;
    return (_count == N) ? false : true;
  }
  // ...
private:
  T      _buf[N];   // array estático — sem heap, sem fragmentação
  size_t _head;
  size_t _tail;
  size_t _count;
};
```

**Características:**
- Inserção: **O(1)** — sempre 3 operações, independente de N
- Remoção: **O(1)**
- Memória: estática em BSS, heap permanece intocado
- Modelo: **Produtor-Consumidor** (taskSensor produz, taskMqtt consome)

---

## 4. Arquitetura com FreeRTOS

O firmware usa **3 tasks FreeRTOS** em dois núcleos do ESP32:

```
┌─────────────────────────────────────────────┐
│ Core 1                                      │
│  taskSensor (alta prioridade)               │
│  ├─ Lê sensores (80ms de ciclo)             │
│  ├─ Controla PWM da lâmpada                 │
│  ├─ push() → bufferIneficiente [V1, O(n)]   │
│  └─ push() → bufferCircular    [V2, O(1)] ──┼──┐
└─────────────────────────────────────────────┘  │ mutex
                                                  │
┌─────────────────────────────────────────────┐  │
│ Core 0                                      │  │
│  taskMqtt                                   │  │
│  ├─ Drena bufferCircular ←──────────────────┼──┘
│  └─ Publica lote via MQTT (reciluz/telemetria)  │
│                                             │
│  taskBenchmark (a cada 30s)                 │
│  └─ executarBenchmark() → publica resultados│
│     via MQTT (reciluz/benchmark)            │
└─────────────────────────────────────────────┘
```

**Por que isso importa:**

A `taskSensor` roda no Core 1 e **nunca é bloqueada pela latência de rede**. O `RingBuffer` atua como fila FIFO entre as duas tasks, absorvendo a diferença de velocidade. Se a rede cair, o sensor continua medindo — o buffer apenas sobrescreve os dados mais antigos.

**Mutex:** o `bufferCircular` é compartilhado entre os dois cores. Um `SemaphoreHandle_t` (mutex FreeRTOS) garante acesso exclusivo com timeout de 5ms:

```cpp
if (xSemaphoreTake(mutexBuffer, pdMS_TO_TICKS(5)) == pdTRUE) {
    bufferCircular.push(snap);
    xSemaphoreGive(mutexBuffer);
}
```

---

## 5. Benchmark de Escalabilidade

### Estratégia

Para demonstrar visualmente o crescimento O(n) vs O(1), o benchmark aloca dinamicamente um buffer de exatamente **N posições** para cada tamanho testado, e cronometra **100 inserções fixas** em um buffer já cheio:

```
Para cada N ∈ {100, 500, 1000, 5000, 20000}:

  1. malloc(N × 4 bytes)         ← aloca buffer de floats
  2. Pré-encher com N elementos  ← garante que buffer esteja CHEIO
  3. Cronometrar 100 inserções   ← mede o custo real por operação
  4. free(buffer)
  5. µs/inserção = tempo_total / 100
```

**Por que `float` em vez de `struct Leitura`?**

`sizeof(Leitura) = 32 bytes`. Para N=20.000:
- Com `Leitura`: 20.000 × 32 = **640 KB** → estoura o heap do ESP32 (320 KB RAM total)
- Com `float`: 20.000 × 4 = **80 KB** → cabe confortavelmente

O custo de `memmove` escala com `N × sizeof(elemento)`, portanto o comportamento O(n) é idêntico.

### Código do benchmark

```cpp
// V1 — memmove simula o shift O(n) do IneffBuffer
unsigned long t1 = micros();
for (int j = 0; j < BENCH_REPETICOES; j++) {
    memmove(bufV1, bufV1 + 1, (n - 1) * sizeof(float)); // shift N-1 elementos
    bufV1[n - 1] = sampleVal;
}
unsigned long durV1 = micros() - t1;

// V2 — aritmética modular simula o RingBuffer O(1)
unsigned long t2 = micros();
for (int j = 0; j < BENCH_REPETICOES; j++) {
    bufV2[tail] = sampleVal;
    tail = (tail + 1) % n;
    head = (head + 1) % n;
}
unsigned long durV2 = micros() - t2;
```

---

## 6. Resultados Empíricos

Medidos no ESP32-D0WD-V3 @ 240 MHz, SRAM interna:

| N | V1 µs/inserção | V2 µs/inserção | V1 é mais lento |
|---|---|---|---|
| 100 | 23,5 | 0,08 | **294×** |
| 500 | 177 | 0,04 | **4.426×** |
| 1.000 | 236 | 0,04 | **5.912×** |
| 5.000 | 1.225 | 0,04 | **30.632×** |
| 20.000 | 4.909 | 0,04 | **122.722×** |

### Verificação da linearidade O(n)

| Par de N | Razão esperada | Razão medida | Resultado |
|---|---|---|---|
| N=1.000 / N=100 | ×10 | 236/23,5 = **×10,0** | ✅ |
| N=5.000 / N=1.000 | ×5 | 1225/236 = **×5,2** | ✅ |
| N=20.000 / N=5.000 | ×4 | 4909/1225 = **×4,0** | ✅ |

O tempo de inserção do V1 **cresce proporcionalmente a N** — confirmação empírica de O(n).
O V2 permanece em ~0,04 µs para qualquer N — confirmação empírica de O(1).

### Diagnóstico de memória

```
Heap livre (V1 rodando): oscila entre 199.668 e 211.964 bytes (fragmentação por malloc/free)
Heap livre (V2 operacional): estável em ~211.340 bytes (array estático, sem heap)
```

---

## 7. Dashboard de Análise

Acesse **`http://localhost:8000/static/benchmark.html`** com o sistema rodando.

O dashboard recebe os dados via **MQTT** no tópico `reciluz/benchmark` e exibe em tempo real:

- **Cards superiores:** últimos valores de V1 e V2 para N=1.000, razão de velocidade e heap livre
- **Gráfico de latência:** curva vermelha (V1) subindo linearmente vs linha verde (V2) plana próxima de zero
- O benchmark roda automaticamente **a cada 30 segundos** após o boot do ESP32

**Tópicos MQTT publicados pelo firmware:**

| Tópico | Conteúdo | Frequência |
|---|---|---|
| `reciluz/benchmark` | `{"n":1000,"v1_us":23600,"v2_us":4,"v1_item":236.0,"v2_item":0.040,"heap":208072}` | A cada N testado (30s) |
| `reciluz/telemetria` | Leituras de sensor em lote | Contínuo |

---

## 8. Como Gravar o Firmware

### Pré-requisito

```bash
pip3 install platformio --break-system-packages
```

### Compilar e gravar

```bash
cd firmware
pio run --target upload
```

### Monitorar saída serial (115200 baud)

```bash
python3 - <<'EOF'
import serial
with serial.Serial("/dev/cu.usbserial-0001", 115200, timeout=1) as s:
    while True:
        line = s.readline().decode("utf-8", errors="replace").strip()
        if line: print(line)
EOF
```

Saída esperada durante o benchmark:
```
=== BENCHMARK AA (buffer variavel, 100 insercoes/teste) ===
N=  100 | V1=   2352 us (23.52/item) | V2=    8 us (0.080/item) | 294x mais lento | Heap=208072
N=  500 | V1=  17702 us (177.02/item) | V2=    4 us (0.040/item) | 4426x mais lento | Heap=207664
N= 1000 | V1=  23646 us (236.46/item) | V2=    4 us (0.040/item) | 5912x mais lento | Heap=208072
N= 5000 | V1= 122528 us (1225.28/item) | V2=    4 us (0.040/item) | 30632x mais lento | Heap=208284
N=20000 | V1= 490889 us (4908.89/item) | V2=    4 us (0.040/item) | 122722x mais lento | Heap=208280
=== FIM BENCHMARK ===
```

---

## 9. Estrutura dos Arquivos

```
firmware/
├── platformio.ini          # Configuração PlatformIO (board, framework, libs)
└── src/
    ├── main.cpp            # Firmware completo: sensores, FreeRTOS tasks, benchmark
    ├── ring_buffer.h       # Vertente 2 — RingBuffer<T,N> template O(1)
    └── ineff_buffer.h      # Vertente 1 — IneffBuffer<T,N> template O(n)
```

### Constantes principais (`main.cpp`)

| Constante | Valor | Descrição |
|---|---|---|
| `BUFFER_SIZE` | 100 | Tamanho do buffer operacional do sistema |
| `BENCH_REPETICOES` | 100 | Inserções cronometradas por teste de benchmark |
| `INTERVALO_BENCHMARK_MS` | 30.000 ms | Intervalo entre execuções do benchmark |
| `INTERVALO_ENVIO_MS` | 1.500 ms | Intervalo de envio de leituras ao backend |

---

**Desenvolvido para o projeto ReciLuz — CESAR School 2026**
