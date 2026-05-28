#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <math.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/semphr.h>
#include "ring_buffer.h"
#include "ineff_buffer.h"

const char* WIFI_SSID = "uaifai-tiradentes";
const char* WIFI_PASSWORD = "bemvindoaocesar";
const char* BACKEND_URL = "http://172.26.65.95:1880/leituras";
const char* MQTT_BROKER = "172.26.65.95";
const int MQTT_PORT = 1883;
const char* MQTT_CLIENT_ID = "reciluz-esp32-01";
const char* MQTT_COMMAND_TOPIC    = "reciluz/lampada/1/comando";
const char* MQTT_TELEMETRIA_TOPIC = "reciluz/telemetria";
const char* MQTT_BENCHMARK_TOPIC  = "reciluz/benchmark";

#define MOSFET_PIN 18
#define CURRENT_SENSOR_PIN 35
#define TRIG_PIN 33
#define ECHO_PIN 26
#define SOUND_SENSOR_PIN 34
#define DHT_PIN 23
#define DHT_TYPE DHT22

#define PWM_CHANNEL 0
#define PWM_FREQ 1000
#define PWM_RESOLUTION 8

#define ADC_MAX 4095.0
#define VREF 3.3
#define ACS712_SENSIBILIDADE 0.122
#define ACS712_RUIDO_MINIMO_A 0.05
#define TENSAO_LAMPADA 12.0
#define RUIDO_DB_MIN 35.0
#define RUIDO_DB_MAX 90.0
#define RUIDO_PICO_SILENCIO 20.0
#define RUIDO_PICO_ALTO 1800.0
#define RUIDO_LIMIAR_DETECCAO_DB 55.0

#define DISTANCIA_MIN_CM 5.0
#define DISTANCIA_MAX_CM 40.0
#define BRILHO_MINIMO 8
#define BRILHO_MAXIMO 255
#define BRILHO_SEM_PRESENCA 0

#define BUFFER_SIZE 100
#define BENCH_N_MAX 1000

const unsigned long INTERVALO_ENVIO_MS         = 1500;
const unsigned long INTERVALO_LEITURA_DHT_MS   = 2500;
const unsigned long INTERVALO_RECONEXAO_MQTT_MS = 5000;
const unsigned long INTERVALO_RECONEXAO_WIFI_MS = 10000;
const unsigned long ATRASO_LOOP_MS             = 80;
const unsigned long INTERVALO_BENCHMARK_MS     = 30000;

struct Leitura {
  float distancia;
  float corrente;
  float potencia;
  float temperatura;
  float umidade;
  float nivelRuidoDb;
  int   brilho;
  unsigned long timestamp;
};

// ─── FreeRTOS ────────────────────────────────────────────────────────────────
// Mutex que protege o bufferCircular compartilhado entre taskSensor e taskMqtt
SemaphoreHandle_t mutexBuffer;

// ─── Buffers ─────────────────────────────────────────────────────────────────
// Vertente 2 (O(1)): usado como fila Produtor-Consumidor entre as duas tasks
RingBuffer<Leitura, BUFFER_SIZE>  bufferCircular;

// Vertente 1 (O(n)): acesso exclusivo da taskSensor — apenas para medir latência
IneffBuffer<Leitura, BUFFER_SIZE> bufferIneficiente;

// ─── Estado global dos sensores (escrito por taskSensor, lido por taskMqtt) ──
static volatile float g_distancia       = -1;
static volatile bool  g_presenca        = false;
static volatile bool  g_somDetectado    = false;
static volatile float g_nivelRuidoDb    = 0;
static volatile int   g_brilho          = 0;
static volatile float g_corrente        = 0;
static volatile float g_potencia        = 0;
static volatile float g_consumo         = 0;
static volatile float g_temperatura     = NAN;
static volatile float g_umidade         = NAN;
static char           g_modo[32]        = "MODO NOITE";

// Último snapshot — compartilhado com a taskBenchmark (leitura não-crítica)
static Leitura g_lastSnap = {};

// ─── Estado de controle ───────────────────────────────────────────────────────
static volatile bool modoRemotoAtivo    = false;
static volatile bool lampadaRemotaLigada = false;

// ─── Drivers ─────────────────────────────────────────────────────────────────
WiFiClient   wifiClient;
PubSubClient mqttClient(wifiClient);
DHT          dht(DHT_PIN, DHT_TYPE);

static float offsetSensor = 0.0;

// ─── Timers de intervalo ──────────────────────────────────────────────────────
static unsigned long ultimaLeituraDht       = 0;
static unsigned long ultimaTentativaMqtt    = 0;
static unsigned long ultimaTentativaWiFi    = 0;
static unsigned long ultimoEnvio            = 0;

// =============================================================================
// Funções de sensor
// =============================================================================

float medirDistancia() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duracao = pulseIn(ECHO_PIN, HIGH, 25000);
  return duracao == 0 ? -1 : duracao * 0.034f / 2;
}

int calcularBrilhoAutomatico(float distancia) {
  if (distancia < 0 || distancia > DISTANCIA_MAX_CM) return BRILHO_SEM_PRESENCA;
  float d = constrain(distancia, DISTANCIA_MIN_CM, DISTANCIA_MAX_CM);
  int b = map((int)(d * 10), (int)(DISTANCIA_MAX_CM * 10), (int)(DISTANCIA_MIN_CM * 10),
              BRILHO_MINIMO, BRILHO_MAXIMO);
  return constrain(b, BRILHO_MINIMO, BRILHO_MAXIMO);
}

float lerTensaoSensor() {
  long soma = 0;
  for (int i = 0; i < 80; i++) {
    soma += analogRead(CURRENT_SENSOR_PIN);
    delayMicroseconds(500);
  }
  return (soma / 80.0f * VREF) / ADC_MAX;
}

void calibrarSensorCorrente() {
  ledcWrite(PWM_CHANNEL, 0);
  delay(1500);
  offsetSensor = lerTensaoSensor();
  Serial.printf("ACS712 calibrado. Offset: %.4f V\n", offsetSensor);
}

float medirCorrente() {
  float v = lerTensaoSensor();
  float c = abs((v - offsetSensor) / ACS712_SENSIBILIDADE);
  return c < ACS712_RUIDO_MINIMO_A ? 0 : c;
}

float medirNivelRuidoDb() {
  int mn = ADC_MAX, mx = 0;
  unsigned long t = millis();
  while (millis() - t < 50) {
    int r = analogRead(SOUND_SENSOR_PIN);
    if (r < mn) mn = r;
    if (r > mx) mx = r;
    delayMicroseconds(200);
  }
  float p = constrain((float)(mx - mn), RUIDO_PICO_SILENCIO, RUIDO_PICO_ALTO);
  float s = (log10(p) - log10(RUIDO_PICO_SILENCIO)) /
            (log10(RUIDO_PICO_ALTO) - log10(RUIDO_PICO_SILENCIO));
  return RUIDO_DB_MIN + s * (RUIDO_DB_MAX - RUIDO_DB_MIN);
}

void atualizarDht(bool forcar = false) {
  if (!forcar && millis() - ultimaLeituraDht < INTERVALO_LEITURA_DHT_MS) return;
  ultimaLeituraDht = millis();
  float u = dht.readHumidity();
  float t = dht.readTemperature();
  if (!isnan(u) && !isnan(t)) { g_umidade = u; g_temperatura = t; }
}

String valorJsonOuNull(float v, int dec) {
  return isnan(v) ? "null" : String(v, dec);
}

// =============================================================================
// Rede
// =============================================================================

void conectarWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  if (millis() - ultimaTentativaWiFi < INTERVALO_RECONEXAO_WIFI_MS) return;
  ultimaTentativaWiFi = millis();
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void receberComandoMqtt(char* topic, byte* payload, unsigned int length) {
  String msg = "";
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  msg.toLowerCase();

  if (msg.indexOf("auto") >= 0 || msg.indexOf("\"automatico\":true") >= 0) {
    modoRemotoAtivo = false;
  } else if ((msg.indexOf("\"ligada\"") >= 0 && msg.indexOf("true") >= 0)
             || msg == "true" || msg == "ligar") {
    modoRemotoAtivo = true; lampadaRemotaLigada = true;
  } else if ((msg.indexOf("\"ligada\"") >= 0 && msg.indexOf("false") >= 0)
             || msg == "false" || msg == "desligar") {
    modoRemotoAtivo = true; lampadaRemotaLigada = false;
  }
  Serial.printf("MQTT cmd: %s\n", msg.c_str());
}

void conectarMqtt() {
  if (WiFi.status() != WL_CONNECTED || mqttClient.connected()) return;
  if (millis() - ultimaTentativaMqtt < INTERVALO_RECONEXAO_MQTT_MS) return;
  ultimaTentativaMqtt = millis();
  if (mqttClient.connect(MQTT_CLIENT_ID)) {
    mqttClient.subscribe(MQTT_COMMAND_TOPIC);
    Serial.println("MQTT conectado");
  }
}

// =============================================================================
// Envio de dados (chamado pela taskMqtt)
// =============================================================================

void enviarLeitura() {
  if (WiFi.status() != WL_CONNECTED) return;

  float dist   = g_distancia;
  bool  pres   = g_presenca;
  bool  som    = g_somDetectado;
  float ruido  = g_nivelRuidoDb;
  int   brilho = g_brilho;
  float cor    = g_corrente;
  float pot    = g_potencia;
  float cons   = g_consumo;
  float temp   = g_temperatura;
  float umid   = g_umidade;
  String modo  = String(g_modo);

  String statusLampada = brilho > 0 ? "ligada" : "desligada";
  if (!modoRemotoAtivo && !pres && brilho > 0) statusLampada = "economica";

  String payload = "{";
  payload += "\"lampada_id\":1,";
  payload += "\"status_lampada\":\"" + statusLampada + "\",";
  payload += "\"intensidade_pwm\":" + String(brilho) + ",";
  payload += "\"distancia_cm\":" + (dist < 0 ? String("null") : String(dist, 2)) + ",";
  payload += "\"modo\":\"" + modo + "\",";
  payload += "\"modo_remoto\":" + String(modoRemotoAtivo ? "true" : "false") + ",";
  payload += "\"corrente\":" + String(cor, 3) + ",";
  payload += "\"potencia\":" + String(pot, 2) + ",";
  payload += "\"consumo_estimado\":" + String(cons, 8) + ",";
  payload += "\"presenca_detectada\":" + String(pres ? "true" : "false") + ",";
  payload += "\"som_detectado\":" + String(som ? "true" : "false") + ",";
  payload += "\"nivel_ruido_db\":" + String(ruido, 1) + ",";
  payload += "\"temperatura\":" + valorJsonOuNull(temp, 1) + ",";
  payload += "\"umidade\":" + valorJsonOuNull(umid, 1) + ",";
  payload += "\"qualidade_ar\":null}";

  HTTPClient http;
  http.begin(BACKEND_URL);
  http.setTimeout(1000);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(payload);
  Serial.printf("HTTP POST %d\n", code);
  http.end();
}

// Modelo Produtor-Consumidor (Vertente 2):
// Drena o bufferCircular e publica lote MQTT — sem bloquear a taskSensor.
// O mutex garante acesso exclusivo ao buffer compartilhado.
void publicarLoteCircular() {
  if (!mqttClient.connected()) return;

  const int MAX_LOTE = 10;
  String json = "{\"leituras\":[";
  int count = 0;

  // Seção crítica: acessa o buffer compartilhado com a taskSensor
  if (xSemaphoreTake(mutexBuffer, pdMS_TO_TICKS(20)) == pdTRUE) {
    while (!bufferCircular.isEmpty() && count < MAX_LOTE) {
      Leitura l;
      bufferCircular.pop(l);
      if (count > 0) json += ",";
      json += "{\"d\":" + String(l.distancia, 1) +
              ",\"c\":" + String(l.corrente, 3) +
              ",\"p\":" + String(l.potencia, 2) +
              ",\"b\":" + String(l.brilho) +
              ",\"t\":" + valorJsonOuNull(l.temperatura, 1) +
              ",\"u\":" + valorJsonOuNull(l.umidade, 1) +
              ",\"r\":" + String(l.nivelRuidoDb, 1) +
              ",\"ts\":" + String(l.timestamp) + "}";
      count++;
    }
    xSemaphoreGive(mutexBuffer);
  }

  if (count > 0) {
    json += "],\"n\":" + String(count) + "}";
    mqttClient.publish(MQTT_TELEMETRIA_TOPIC, json.c_str());
  }
}

// Benchmark comparativo entre as duas vertentes.
// Usa buffers estáticos locais para não interferir nos buffers operacionais.
void executarBenchmark(const Leitura& snap) {
  static RingBuffer<Leitura, BENCH_N_MAX + 1>  benchCircular;
  static IneffBuffer<Leitura, BENCH_N_MAX + 1> benchIneficiente;

  int valoresN[] = {10, 50, 100, 500, 1000};
  int qtd = sizeof(valoresN) / sizeof(valoresN[0]);

  Serial.println("=== BENCHMARK AA ===");

  for (int i = 0; i < qtd; i++) {
    int n = valoresN[i];
    benchCircular.clear();
    benchIneficiente.clear();

    unsigned long t1 = micros();
    for (int j = 0; j < n; j++) benchIneficiente.push(snap);
    unsigned long durV1 = micros() - t1;

    unsigned long t2 = micros();
    for (int j = 0; j < n; j++) benchCircular.push(snap);
    unsigned long durV2 = micros() - t2;

    float porItemV1 = (float)durV1 / n;
    float porItemV2 = (float)durV2 / n;
    uint32_t heap   = ESP.getFreeHeap();

    Serial.printf("N=%4d | V1=%6lu us | V2=%4lu us | V1/item=%.2f | V2/item=%.3f | Heap=%u\n",
                  n, durV1, durV2, porItemV1, porItemV2, heap);

    if (mqttClient.connected()) {
      String json = "{\"n\":" + String(n) +
                    ",\"v1_us\":" + String(durV1) +
                    ",\"v2_us\":" + String(durV2) +
                    ",\"v1_item\":" + String(porItemV1, 3) +
                    ",\"v2_item\":" + String(porItemV2, 3) +
                    ",\"heap\":" + String(heap) + "}";
      mqttClient.publish(MQTT_BENCHMARK_TOPIC, json.c_str());
    }

    vTaskDelay(pdMS_TO_TICKS(50));
  }

  Serial.println("=== FIM BENCHMARK ===");
}

// =============================================================================
// FreeRTOS Tasks
// =============================================================================

// Task Produtora — Core 1, prioridade alta
// Responsabilidade: captura de sensores em ritmo constante, sem bloqueios de rede.
// Publica no bufferCircular (Vertente 2) e no bufferIneficiente (Vertente 1) para comparação.
void taskSensor(void* param) {
  for (;;) {
    float distancia    = medirDistancia();
    bool  presenca     = distancia > 0 && distancia <= DISTANCIA_MAX_CM;
    float nivelRuidoDb = medirNivelRuidoDb();
    bool  somDetectado = nivelRuidoDb >= RUIDO_LIMIAR_DETECCAO_DB;

    int brilho = 0;
    const char* modo = "";
    if (modoRemotoAtivo) {
      brilho = lampadaRemotaLigada ? BRILHO_MAXIMO : 0;
      modo   = lampadaRemotaLigada ? "REMOTO LIGADO" : "REMOTO DESLIGADO";
    } else {
      brilho = calcularBrilhoAutomatico(distancia);
      modo   = brilho > 0 ? "MODO PRESENCA" : "MODO NOITE";
    }
    ledcWrite(PWM_CHANNEL, brilho);

    float corrente = medirCorrente();
    float potencia = corrente * TENSAO_LAMPADA;
    float consumo  = (potencia / 1000.0f) * (INTERVALO_ENVIO_MS / 3600000.0f);
    atualizarDht();

    // Atualizar estado global para a taskMqtt
    g_distancia    = distancia;
    g_presenca     = presenca;
    g_somDetectado = somDetectado;
    g_nivelRuidoDb = nivelRuidoDb;
    g_brilho       = brilho;
    g_corrente     = corrente;
    g_potencia     = potencia;
    g_consumo      = consumo;
    strncpy(g_modo, modo, sizeof(g_modo) - 1);

    Leitura snap = { distancia, corrente, potencia,
                     (float)g_temperatura, (float)g_umidade,
                     nivelRuidoDb, brilho, millis() };
    g_lastSnap = snap;

    // ── Instrumentação: medir latência de inserção (Vertente 1 vs Vertente 2) ──
    // Vertente 1: push O(n) — desloca todos os elementos quando o buffer está cheio
    unsigned long t1 = micros();
    bufferIneficiente.push(snap);
    unsigned long latV1 = micros() - t1;

    // Vertente 2: push O(1) — apenas incremento de índice, acesso protegido por mutex
    unsigned long t2 = micros();
    if (xSemaphoreTake(mutexBuffer, pdMS_TO_TICKS(5)) == pdTRUE) {
      bufferCircular.push(snap);
      xSemaphoreGive(mutexBuffer);
    }
    unsigned long latV2 = micros() - t2;
    // ─────────────────────────────────────────────────────────────────────────

    // Saída compatível com Serial Plotter do Arduino IDE
    Serial.printf("V1_us:%lu,V2_us:%lu,Heap:%u\n", latV1, latV2, ESP.getFreeHeap());

    Serial.printf("Dist:%.1fcm Brilho:%d Modo:%s Ruido:%.1fdB Cor:%.3fA Pot:%.2fW T:%.1fC U:%.1f%%\n",
                  distancia, brilho, modo, nivelRuidoDb, corrente, potencia,
                  (float)g_temperatura, (float)g_umidade);

    vTaskDelay(pdMS_TO_TICKS(ATRASO_LOOP_MS));
  }
}

// Task Consumidora — Core 0, prioridade normal
// Responsabilidade: rede (WiFi/MQTT/HTTP). Drena o bufferCircular via mutex.
// A taskSensor nunca espera pela rede — é o Produtor-Consumidor em ação.
void taskMqtt(void* param) {
  static bool wifiLogado = false;

  for (;;) {
    // Reconexão WiFi
    if (WiFi.status() == WL_CONNECTED) {
      if (!wifiLogado) {
        Serial.printf("WiFi conectado: %s\n", WiFi.localIP().toString().c_str());
        wifiLogado = true;
      }
    } else {
      wifiLogado = false;
      conectarWiFi();
    }

    // Manutenção MQTT
    conectarMqtt();
    mqttClient.loop();

    // Envio periódico: HTTP POST + lote MQTT
    if (millis() - ultimoEnvio >= INTERVALO_ENVIO_MS) {
      enviarLeitura();
      publicarLoteCircular();
      ultimoEnvio = millis();
    }

    vTaskDelay(pdMS_TO_TICKS(100));
  }
}

// Task de Benchmark — Core 0, prioridade baixa
// Aguarda 15s após o boot para dar tempo ao sistema conectar, depois roda a cada 30s.
void taskBenchmark(void* param) {
  vTaskDelay(pdMS_TO_TICKS(15000));
  for (;;) {
    executarBenchmark(g_lastSnap);
    vTaskDelay(pdMS_TO_TICKS(INTERVALO_BENCHMARK_MS));
  }
}

// =============================================================================
// Setup & loop
// =============================================================================

void setup() {
  Serial.begin(115200);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(CURRENT_SENSOR_PIN, INPUT);
  pinMode(SOUND_SENSOR_PIN, INPUT);

  analogReadResolution(12);
  analogSetPinAttenuation(CURRENT_SENSOR_PIN, ADC_11db);
  analogSetPinAttenuation(SOUND_SENSOR_PIN, ADC_11db);

  ledcSetup(PWM_CHANNEL, PWM_FREQ, PWM_RESOLUTION);
  ledcAttachPin(MOSFET_PIN, PWM_CHANNEL);
  ledcWrite(PWM_CHANNEL, 0);
  dht.begin();

  calibrarSensorCorrente();
  atualizarDht(true);

  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(receberComandoMqtt);
  mqttClient.setBufferSize(2048);

  // Mutex do buffer compartilhado entre taskSensor e taskMqtt
  mutexBuffer = xSemaphoreCreateMutex();

  // taskSensor no Core 1 (dedicado a I/O de sensores, separado do Core 0 que roda WiFi/MQTT)
  xTaskCreatePinnedToCore(taskSensor,    "sensor",    8192, NULL, 2, NULL, 1);
  // taskMqtt e taskBenchmark no Core 0 (mesmo core do stack TCP/IP do ESP32)
  xTaskCreatePinnedToCore(taskMqtt,      "mqtt",      8192, NULL, 1, NULL, 0);
  xTaskCreatePinnedToCore(taskBenchmark, "benchmark", 8192, NULL, 1, NULL, 0);

  Serial.println("ReciLuz FreeRTOS iniciado — 3 tasks ativas");
}

// loop() não é mais usado — o trabalho está nas tasks FreeRTOS
void loop() {
  vTaskDelete(NULL);
}
