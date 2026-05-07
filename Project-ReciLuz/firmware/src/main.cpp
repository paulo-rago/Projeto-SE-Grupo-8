#include <Arduino.h>

#define LED_PIN 4        // LED no GPIO 4
#define BUTTON_PIN 19    // Botão no GPIO 19

#define TRIG_PIN 25      // Trig do sensor ultrassônico
#define ECHO_PIN 26      // Echo do sensor ultrassônico

#define PWM_CHANNEL 0
#define PWM_FREQ 1000
#define PWM_RESOLUTION 8 // brilho de 0 a 255

float medirDistancia() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);

  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duracao = pulseIn(ECHO_PIN, HIGH, 30000);

  if (duracao == 0) {
    return -1;
  }

  float distancia = duracao * 0.034 / 2;
  return distancia;
}

void setup() {
  Serial.begin(115200);

  pinMode(BUTTON_PIN, INPUT_PULLUP);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  ledcSetup(PWM_CHANNEL, PWM_FREQ, PWM_RESOLUTION);
  ledcAttachPin(LED_PIN, PWM_CHANNEL);

  ledcWrite(PWM_CHANNEL, 0);

  Serial.println("ReciLuz iniciado...");
}

void loop() {
  float distancia = medirDistancia();
  bool botaoPressionado = digitalRead(BUTTON_PIN) == LOW;

  int brilho = 0;
  String modo = "";

  if (botaoPressionado) {
    brilho = 255;
    modo = "MODO MANUAL";
  } 
  else if (distancia > 0 && distancia <= 40) {

    brilho = map(distancia, 40, 5, 10, 255);
    brilho = constrain(brilho, 10, 255);

    brilho = brilho * brilho / 255;

    modo = "NOITE ATIVO / PRESENCA DETECTADA";
  } 
  else {
    brilho = 5; 
    modo = "NOITE ECONOMICO / SEM PRESENCA";
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

  delay(300);
}
