#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <PubSubClient.h>

const char* WIFI_SSID = "uaifai-brum";
const char* WIFI_PASSWORD = "bemvindoaocesar";
const char* BACKEND_URL = "http://172.26.116.115:1880/leituras";
const char* MQTT_BROKER = "172.26.116.115";
const int MQTT_PORT = 1883;
const char* MQTT_CLIENT_ID = "reciluz-esp32-01";
const char* MQTT_COMMAND_TOPIC = "reciluz/lampada/1/comando";

#define LED_PIN 4        // LED no GPIO 4
#define BUTTON_PIN 19    // Botão no GPIO 19

#define TRIG_PIN 25      // Trig do sensor ultrassônico
#define ECHO_PIN 26      // Echo do sensor ultrassônico

#define PWM_CHANNEL 0
#define PWM_FREQ 1000
#define PWM_RESOLUTION 8 // brilho de 0 a 255

const unsigned long INTERVALO_ENVIO_MS = 5000;
const unsigned long INTERVALO_RECONEXAO_MQTT_MS = 5000;
const unsigned long INTERVALO_RECONEXAO_WIFI_MS = 10000;
const unsigned long ATRASO_LOOP_MS = 30;
unsigned long ultimoEnvio = 0;
unsigned long ultimaTentativaMqtt = 0;
unsigned long ultimaTentativaWiFi = 0;

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

bool modoRemotoAtivo = false;
bool lampadaRemotaLigada = false;

float medirDistancia() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);

  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duracao = pulseIn(ECHO_PIN, HIGH, 15000);

  if (duracao == 0) {
    return -1;
  }

  float distancia = duracao * 0.034 / 2;
  return distancia;
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
    Serial.println("MQTT: voltando para modo automatico por sensor");
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

void enviarLeitura(float distancia, bool presencaDetectada, int brilho, const String& modo) {
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
  payload += "\"distancia_cm\":" + String(distancia, 2) + ",";
  payload += "\"modo\":\"" + modo + "\",";
  payload += "\"modo_remoto\":";
  payload += modoRemotoAtivo ? "true" : "false";
  payload += ",";
  payload += "\"corrente\":null,";
  payload += "\"potencia\":null,";
  payload += "\"consumo_estimado\":null,";
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

  ledcSetup(PWM_CHANNEL, PWM_FREQ, PWM_RESOLUTION);
  ledcAttachPin(LED_PIN, PWM_CHANNEL);

  ledcWrite(PWM_CHANNEL, 0);
  delay(300);
  ledcWrite(PWM_CHANNEL, 255);
  delay(300);
  ledcWrite(PWM_CHANNEL, 0);

  Serial.println("ReciLuz iniciado...");
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
  bool presencaDetectada = distancia > 0 && distancia <= 40;

  int brilho = 0;
  String modo = "";

  if (modoRemotoAtivo) {
    brilho = lampadaRemotaLigada ? 255 : 0;
    modo = lampadaRemotaLigada ? "REMOTO LIGADO" : "REMOTO DESLIGADO";
  }
  else if (botaoPressionado) {
    brilho = 255;
    modo = "MODO MANUAL";
  } 
  else if (presencaDetectada) {

    brilho = map(distancia, 40, 5, 10, 255);
    brilho = constrain(brilho, 10, 255);

    brilho = brilho * brilho / 255;

    modo = "MODO PRESENCA";
  } 
  else {
    brilho = 5; 
    modo = "MODO NOITE";
  }

  ledcWrite(PWM_CHANNEL, brilho);

  Serial.println("-------------------------");
  Serial.print("Distancia: ");
  Serial.print(distancia);
  Serial.println(" cm");

  Serial.print("Botao: ");
  Serial.println(botaoPressionado ? "pressionado" : "solto");

  Serial.print("Brilho: ");
  Serial.print(brilho);
  Serial.println(" / 255");

  Serial.print("Modo: ");
  Serial.println(modo);

  if (millis() - ultimoEnvio >= INTERVALO_ENVIO_MS) {
    enviarLeitura(distancia, presencaDetectada, brilho, modo);
    ultimoEnvio = millis();
  }

  delay(ATRASO_LOOP_MS);
}
