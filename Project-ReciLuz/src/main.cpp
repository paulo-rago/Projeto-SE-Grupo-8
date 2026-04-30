#include <Arduino.h>

#define LED_PIN 5      // D5
#define BUTTON_PIN 4   // D4

void setup() {
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  digitalWrite(LED_PIN, LOW); // LED começa apagado
}

void loop() {
  int estadoBotao = digitalRead(BUTTON_PIN);

  if (estadoBotao == LOW) {
    // botão pressionado
    digitalWrite(LED_PIN, HIGH);
  } else {
    // botão solto
    digitalWrite(LED_PIN, LOW);
  }
}