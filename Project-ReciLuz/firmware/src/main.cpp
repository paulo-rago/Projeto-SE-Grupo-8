#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <PubSubClient.h>

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
#define BUTTON_PIN 19

#define PWM_CHANNEL 0
#define PWM_FREQ 1000
#define PWM_RESOLUTION 8

#define ADC_MAX 4095.0
#define VREF 3.3
#define ACS712_SENSIBILIDADE 0.122
#define ACS712_RUIDO_MINIMO_A 0.05
#define TENSAO_LAMPADA 12.0

#define DISTANCIA_MIN_CM 5.0
#define DISTANCIA_MAX_CM 40.0
#define BRILHO_MINIMO 8
#define BRILHO_MAXIMO 255
#define BRILHO_SEM_PRESENCA 0

const unsigned long INTERVALO_ENVIO_MS = 1500;
const unsigned long INTERVALO_RECONEXAO_MQTT_MS = 5000;
const unsigned long INTERVALO_RECONEXAO_WIFI_MS = 10000;
const unsigned long ATRASO_LOOP_MS = 80;

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

unsigned long ultimoEnvio = 0;
unsigned long ultimaTentativaMqtt = 0;
unsigned long ultimaTentativaWiFi = 0;

float offsetSensor = 0.0;
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

void enviarLeitura(float distancia, bool presencaDetectada, int brilho, const String& modo, float corrente, float potencia, float consumoEstimado) {
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
  payload += "\"temperatura\":null,";
  payload += "\"umidade\":null,";
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

  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(CURRENT_SENSOR_PIN, INPUT);

  analogReadResolution(12);
  analogSetPinAttenuation(CURRENT_SENSOR_PIN, ADC_11db);

  ledcSetup(PWM_CHANNEL, PWM_FREQ, PWM_RESOLUTION);
  ledcAttachPin(MOSFET_PIN, PWM_CHANNEL);
  ledcWrite(PWM_CHANNEL, 0);

  Serial.println("ReciLuz iniciado com lampada MOSFET + ultrassonico");
  calibrarSensorCorrente();

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
  bool botaoPressionado = digitalRead(BUTTON_PIN) == LOW;
  bool presencaDetectada = distancia > 0 && distancia <= DISTANCIA_MAX_CM;

  int brilho = 0;
  String modo = "";

  if (modoRemotoAtivo) {
    brilho = lampadaRemotaLigada ? BRILHO_MAXIMO : 0;
    modo = lampadaRemotaLigada ? "REMOTO LIGADO" : "REMOTO DESLIGADO";
  } else if (botaoPressionado) {
    brilho = BRILHO_MAXIMO;
    modo = "MODO MANUAL";
  } else {
    brilho = calcularBrilhoAutomatico(distancia);
    modo = brilho > 0 ? "MODO PRESENCA" : "MODO NOITE";
  }

  ledcWrite(PWM_CHANNEL, brilho);

  float corrente = medirCorrente();
  float potencia = corrente * TENSAO_LAMPADA;
  float consumoEstimado = (potencia / 1000.0) * (INTERVALO_ENVIO_MS / 3600000.0);

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

  Serial.print("Corrente: ");
  Serial.print(corrente, 3);
  Serial.println(" A");

  Serial.print("Potencia: ");
  Serial.print(potencia, 2);
  Serial.println(" W");

  if (millis() - ultimoEnvio >= INTERVALO_ENVIO_MS) {
    enviarLeitura(distancia, presencaDetectada, brilho, modo, corrente, potencia, consumoEstimado);
    ultimoEnvio = millis();
  }

  delay(ATRASO_LOOP_MS);
}
