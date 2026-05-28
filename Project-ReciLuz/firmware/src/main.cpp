#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <math.h>

const char* WIFI_SSID = "uaifai-tiradentes";
const char* WIFI_PASSWORD = "bemvindoaocesar";
const char* BACKEND_URL = "http://172.26.65.95:1880/leituras";
const char* MQTT_BROKER = "172.26.65.95";
const int MQTT_PORT = 1883;
const char* MQTT_CLIENT_ID = "reciluz-esp32-01";
const char* MQTT_COMMAND_TOPIC = "reciluz/lampada/1/comando";

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

const unsigned long INTERVALO_ENVIO_MS = 1500;
const unsigned long INTERVALO_LEITURA_DHT_MS = 2500;
const unsigned long INTERVALO_RECONEXAO_MQTT_MS = 5000;
const unsigned long INTERVALO_RECONEXAO_WIFI_MS = 10000;
const unsigned long ATRASO_LOOP_MS = 80;

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);
DHT dht(DHT_PIN, DHT_TYPE);

unsigned long ultimoEnvio = 0;
unsigned long ultimaLeituraDht = 0;
unsigned long ultimaTentativaMqtt = 0;
unsigned long ultimaTentativaWiFi = 0;

float offsetSensor = 0.0;
float temperaturaAtual = NAN;
float umidadeAtual = NAN;
bool modoRemotoAtivo = false;
bool lampadaRemotaLigada = false;

float medirDistancia() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);

  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duracao = pulseIn(ECHO_PIN, HIGH, 25000);

  if (duracao == 0) {
    return -1;
  }

  return duracao * 0.034 / 2;
}

int calcularBrilhoAutomatico(float distancia) {
  if (distancia < 0 || distancia > DISTANCIA_MAX_CM) {
    return BRILHO_SEM_PRESENCA;
  }

  float distanciaLimitada = constrain(distancia, DISTANCIA_MIN_CM, DISTANCIA_MAX_CM);
  int brilho = map(
    (int)(distanciaLimitada * 10),
    (int)(DISTANCIA_MAX_CM * 10),
    (int)(DISTANCIA_MIN_CM * 10),
    BRILHO_MINIMO,
    BRILHO_MAXIMO
  );

  return constrain(brilho, BRILHO_MINIMO, BRILHO_MAXIMO);
}

float lerTensaoSensor() {
  long soma = 0;

  for (int i = 0; i < 80; i++) {
    soma += analogRead(CURRENT_SENSOR_PIN);
    delayMicroseconds(500);
  }

  float media = soma / 80.0;
  return (media * VREF) / ADC_MAX;
}

void calibrarSensorCorrente() {
  ledcWrite(PWM_CHANNEL, 0);
  delay(1500);

  offsetSensor = lerTensaoSensor();

  Serial.print("ACS712 calibrado. Offset: ");
  Serial.print(offsetSensor, 4);
  Serial.println(" V");
}

float medirCorrente() {
  float tensaoSensor = lerTensaoSensor();
  float corrente = abs((tensaoSensor - offsetSensor) / ACS712_SENSIBILIDADE);

  if (corrente < ACS712_RUIDO_MINIMO_A) {
    return 0;
  }

  return corrente;
}

float medirNivelRuidoDb() {
  int leituraMinima = ADC_MAX;
  int leituraMaxima = 0;
  unsigned long inicio = millis();

  while (millis() - inicio < 50) {
    int leitura = analogRead(SOUND_SENSOR_PIN);

    if (leitura < leituraMinima) {
      leituraMinima = leitura;
    }

    if (leitura > leituraMaxima) {
      leituraMaxima = leitura;
    }

    delayMicroseconds(200);
  }

  float picoAPico = leituraMaxima - leituraMinima;

  if (picoAPico < RUIDO_PICO_SILENCIO) {
    picoAPico = RUIDO_PICO_SILENCIO;
  }

  if (picoAPico > RUIDO_PICO_ALTO) {
    picoAPico = RUIDO_PICO_ALTO;
  }

  float escalaLog = (log10(picoAPico) - log10(RUIDO_PICO_SILENCIO)) / (log10(RUIDO_PICO_ALTO) - log10(RUIDO_PICO_SILENCIO));
  return RUIDO_DB_MIN + (escalaLog * (RUIDO_DB_MAX - RUIDO_DB_MIN));
}

void atualizarDht(bool forcarLeitura = false) {
  if (!forcarLeitura && millis() - ultimaLeituraDht < INTERVALO_LEITURA_DHT_MS) {
    return;
  }
  ultimaLeituraDht = millis();

  float novaUmidade = dht.readHumidity();
  float novaTemperatura = dht.readTemperature();

  if (isnan(novaUmidade) || isnan(novaTemperatura)) {
    Serial.println("AM2302/DHT22: falha na leitura");
    return;
  }

  umidadeAtual = novaUmidade;
  temperaturaAtual = novaTemperatura;
}

String valorJsonOuNull(float valor, int casasDecimais) {
  if (isnan(valor)) {
    return "null";
  }

  return String(valor, casasDecimais);
}

bool conectarWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

  if (millis() - ultimaTentativaWiFi < INTERVALO_RECONEXAO_WIFI_MS) {
    return false;
  }
  ultimaTentativaWiFi = millis();

  Serial.println("Tentando conectar ao Wi-Fi em segundo plano...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  return false;
}

void receberComandoMqtt(char* topic, byte* payload, unsigned int length) {
  String mensagem = "";
  for (unsigned int i = 0; i < length; i++) {
    mensagem += (char)payload[i];
  }

  Serial.print("MQTT recebido em ");
  Serial.print(topic);
  Serial.print(": ");
  Serial.println(mensagem);

  mensagem.toLowerCase();

  if (mensagem.indexOf("auto") >= 0 || mensagem.indexOf("\"automatico\":true") >= 0) {
    modoRemotoAtivo = false;
    Serial.println("MQTT: modo automatico por sensor");
    return;
  }

  if ((mensagem.indexOf("\"ligada\"") >= 0 && mensagem.indexOf("true") >= 0) || mensagem == "true" || mensagem == "ligar") {
    modoRemotoAtivo = true;
    lampadaRemotaLigada = true;
    Serial.println("MQTT: comando remoto para ligar");
    return;
  }

  if ((mensagem.indexOf("\"ligada\"") >= 0 && mensagem.indexOf("false") >= 0) || mensagem == "false" || mensagem == "desligar") {
    modoRemotoAtivo = true;
    lampadaRemotaLigada = false;
    Serial.println("MQTT: comando remoto para desligar");
    return;
  }

  Serial.println("MQTT: comando ignorado");
}

void conectarMqtt() {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  if (mqttClient.connected()) {
    return;
  }

  if (millis() - ultimaTentativaMqtt < INTERVALO_RECONEXAO_MQTT_MS) {
    return;
  }
  ultimaTentativaMqtt = millis();

  Serial.print("Conectando ao MQTT em ");
  Serial.print(MQTT_BROKER);
  Serial.print(":");
  Serial.println(MQTT_PORT);

  if (mqttClient.connect(MQTT_CLIENT_ID)) {
    Serial.println("MQTT conectado");
    mqttClient.subscribe(MQTT_COMMAND_TOPIC);
    Serial.print("Inscrito no topico: ");
    Serial.println(MQTT_COMMAND_TOPIC);
  } else {
    Serial.print("Falha MQTT, rc=");
    Serial.println(mqttClient.state());
  }
}

void enviarLeitura(float distancia, bool presencaDetectada, bool somDetectado, float nivelRuidoDb, int brilho, const String& modo, float corrente, float potencia, float consumoEstimado, float temperatura, float umidade) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi desconectado. Leitura nao enviada agora.");
    return;
  }

  String statusLampada = brilho > 0 ? "ligada" : "desligada";
  if (!modoRemotoAtivo && !presencaDetectada && brilho > 0) {
    statusLampada = "economica";
  }

  String payload = "{";
  payload += "\"lampada_id\":1,";
  payload += "\"status_lampada\":\"" + statusLampada + "\",";
  payload += "\"intensidade_pwm\":" + String(brilho) + ",";
  payload += "\"distancia_cm\":";
  payload += distancia < 0 ? "null" : String(distancia, 2);
  payload += ",";
  payload += "\"modo\":\"" + modo + "\",";
  payload += "\"modo_remoto\":";
  payload += modoRemotoAtivo ? "true" : "false";
  payload += ",";
  payload += "\"corrente\":" + String(corrente, 3) + ",";
  payload += "\"potencia\":" + String(potencia, 2) + ",";
  payload += "\"consumo_estimado\":" + String(consumoEstimado, 8) + ",";
  payload += "\"presenca_detectada\":";
  payload += presencaDetectada ? "true" : "false";
  payload += ",";
  payload += "\"som_detectado\":";
  payload += somDetectado ? "true" : "false";
  payload += ",";
  payload += "\"nivel_ruido_db\":" + String(nivelRuidoDb, 1) + ",";
  payload += "\"temperatura\":" + valorJsonOuNull(temperatura, 1) + ",";
  payload += "\"umidade\":" + valorJsonOuNull(umidade, 1) + ",";
  payload += "\"qualidade_ar\":null";
  payload += "}";

  HTTPClient http;

  Serial.print("Enviando leitura para: ");
  Serial.println(BACKEND_URL);
  Serial.print("Payload: ");
  Serial.println(payload);

  http.begin(BACKEND_URL);
  http.setTimeout(1000);
  http.addHeader("Content-Type", "application/json");

  int codigoResposta = http.POST(payload);

  Serial.print("Envio HTTP: ");
  Serial.println(codigoResposta);

  if (codigoResposta > 0) {
    Serial.print("Resposta backend: ");
    Serial.println(http.getString());
  } else {
    Serial.print("Erro HTTP: ");
    Serial.println(http.errorToString(codigoResposta));
  }

  http.end();
}

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

  Serial.println("ReciLuz iniciado com lampada MOSFET + ultrassonico + AM2302 + sensor de ruido");
  calibrarSensorCorrente();
  atualizarDht(true);

  conectarWiFi();
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(receberComandoMqtt);
  conectarMqtt();
}

void loop() {
  static bool wifiConectadoAnteriormente = false;

  if (WiFi.status() == WL_CONNECTED) {
    if (!wifiConectadoAnteriormente) {
      Serial.print("Wi-Fi conectado. IP do ESP32: ");
      Serial.println(WiFi.localIP());
      wifiConectadoAnteriormente = true;
    }
  } else {
    wifiConectadoAnteriormente = false;
    conectarWiFi();
  }

  conectarMqtt();
  mqttClient.loop();

  float distancia = medirDistancia();
  bool presencaDetectada = distancia > 0 && distancia <= DISTANCIA_MAX_CM;
  float nivelRuidoDb = medirNivelRuidoDb();
  bool somDetectado = nivelRuidoDb >= RUIDO_LIMIAR_DETECCAO_DB;

  int brilho = 0;
  String modo = "";

  if (modoRemotoAtivo) {
    brilho = lampadaRemotaLigada ? BRILHO_MAXIMO : 0;
    modo = lampadaRemotaLigada ? "REMOTO LIGADO" : "REMOTO DESLIGADO";
  } else {
    brilho = calcularBrilhoAutomatico(distancia);
    modo = brilho > 0 ? "MODO PRESENCA" : "MODO NOITE";
  }

  ledcWrite(PWM_CHANNEL, brilho);

  float corrente = medirCorrente();
  float potencia = corrente * TENSAO_LAMPADA;
  float consumoEstimado = (potencia / 1000.0) * (INTERVALO_ENVIO_MS / 3600000.0);
  atualizarDht();

  Serial.println("-------------------------");
  Serial.print("Distancia: ");
  if (distancia < 0) {
    Serial.println("sem leitura");
  } else {
    Serial.print(distancia, 2);
    Serial.println(" cm");
  }

  Serial.print("Brilho PWM: ");
  Serial.print(brilho);
  Serial.println(" / 255");

  Serial.print("Modo: ");
  Serial.println(modo);

  Serial.print("Nivel de ruido: ");
  Serial.print(nivelRuidoDb, 1);
  Serial.println(" dB estimado");

  Serial.print("Ruido acima do limite: ");
  Serial.println(somDetectado ? "sim" : "nao");

  Serial.print("Corrente: ");
  Serial.print(corrente, 3);
  Serial.println(" A");

  Serial.print("Potencia: ");
  Serial.print(potencia, 2);
  Serial.println(" W");

  Serial.print("Temperatura: ");
  if (isnan(temperaturaAtual)) {
    Serial.println("sem leitura");
  } else {
    Serial.print(temperaturaAtual, 1);
    Serial.println(" C");
  }

  Serial.print("Umidade: ");
  if (isnan(umidadeAtual)) {
    Serial.println("sem leitura");
  } else {
    Serial.print(umidadeAtual, 1);
    Serial.println(" %");
  }

  if (millis() - ultimoEnvio >= INTERVALO_ENVIO_MS) {
    enviarLeitura(distancia, presencaDetectada, somDetectado, nivelRuidoDb, brilho, modo, corrente, potencia, consumoEstimado, temperaturaAtual, umidadeAtual);
    ultimoEnvio = millis();
  }

  delay(ATRASO_LOOP_MS);
}
