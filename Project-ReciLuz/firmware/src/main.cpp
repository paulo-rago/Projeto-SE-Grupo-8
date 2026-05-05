#include <Arduino.h>

#define LED_PIN 4        
#define BUTTON_PIN 19    

#define TRIG_PIN 25      
#define ECHO_PIN 26      

#define PWM_CHANNEL 0
#define PWM_FREQ 5000
#define PWM_RESOLUTION 8 

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
}

void loop() {
  int estadoBotao = digitalRead(BUTTON_PIN);
  float distancia = medirDistancia();

  bool botaoPressionado = estadoBotao == LOW;

  int brilho = 0;

  if (distancia > 0 && distancia <= 40) {
    
    brilho = map(distancia, 40, 5, 5, 255);
    brilho = constrain(brilho, 5, 255);

    brilho = brilho * brilho / 255;
  } else {
    brilho = 0;
  }

  if (botaoPressionado) {
    brilho = 255;
  }

  ledcWrite(PWM_CHANNEL, brilho);

  Serial.print("Distancia: ");
  Serial.print(distancia);
  Serial.print(" cm | Brilho: ");
  Serial.println(brilho);

  delay(80);
}
