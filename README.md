# Projeto-SE-Grupo-8

 # ReciLuz

 > Acesse nosso Drive do projeto: [Google Drive - ReciLuz](https://drive.google.com/drive/folders/1JRUVSHJhsAoAntvT7IyG7CY1mx4hIjT3?usp=sharing)

## Descrição

O **ReciLuz** é um projeto de IoT voltado para iluminação pública inteligente, inspirado no contexto urbano do Recife. A proposta é desenvolver um protótipo em escala reduzida de um poste inteligente capaz de controlar a iluminação de forma automática, detectar presença ou aproximação, estimar consumo elétrico e enviar informações para um painel de monitoramento.

O projeto busca demonstrar como tecnologias de Internet das Coisas podem ser aplicadas à eficiência energética, à segurança urbana e à manutenção preventiva da iluminação pública.

## Problema

A iluminação pública tradicional costuma operar de forma pouco eficiente, mantendo luminárias ligadas em intensidade fixa durante longos períodos, mesmo em locais e horários de baixa circulação.

Esse modelo pode gerar:

- consumo desnecessário de energia;
- dificuldade de monitoramento em tempo real;
- manutenção reativa, dependente de reclamações ou inspeções manuais;
- menor capacidade de planejamento por parte do poder público.

## Solução Proposta

O ReciLuz propõe um sistema inteligente de iluminação pública baseado em ESP32, sensores e comunicação IoT.

O protótipo simula um poste inteligente utilizando uma lâmpada ou LED de 12V. O sistema poderá operar em dois modos:

### Modo Econômico

Quando não há presença detectada, a iluminação permanece apagada ou em baixa intensidade, reduzindo o consumo de energia.

### Modo Ativo

Quando uma pessoa, veículo ou objeto é detectado, a iluminação aumenta de intensidade ou acende completamente.

Além disso, o sistema poderá medir ou estimar o consumo elétrico e enviar os dados para um dashboard de monitoramento.

## Objetivo Geral

Desenvolver um protótipo IoT de iluminação pública inteligente capaz de controlar automaticamente a iluminação com base em presença e luminosidade, estimar consumo elétrico e permitir o monitoramento remoto dos dados.

## Objetivos Específicos

- Implementar o controle automático da iluminação utilizando ESP32.
- Detectar presença ou aproximação por meio de sensores.
- Simular condições de luminosidade ambiente.
- Medir ou estimar corrente, potência e consumo elétrico.
- Enviar dados do sistema para um dashboard.
- Comparar o consumo entre o modo tradicional e o modo inteligente.
- Simular alertas de falha ou funcionamento irregular.

## Tecnologias e Ferramentas

- ESP32
- Arduino Framework
- PlatformIO
- MQTT
- Node-RED
- Sensores de presença ou distância
- Sensor de corrente
- Dashboard para visualização dos dados

## Componentes Previstos

| Categoria | Componentes |
|---|---|
| Controle | ESP32 |
| Iluminação | Lâmpada LED 12V ou fita LED 12V |
| Alimentação | Fonte 12V compatível |
| Acionamento | Módulo MOSFET ou relé |
| Medição elétrica | ACS712 ou INA219 |
| Detecção | Sensor PIR, infravermelho ou ultrassônico HC-SR04 |
| Luminosidade | LDR ou potenciômetro |
| Sinalização | LEDs comuns, LED RGB e resistores |
| Montagem | Protoboard, jumpers, conectores e base da maquete |
| Dashboard | Node-RED, MQTT ou página web simples |
| Desenvolvimento | PlatformIO ou Arduino IDE |

## Funcionamento Esperado

O funcionamento do sistema ocorre em etapas:

1. O sistema verifica a condição de luminosidade do ambiente.
2. Caso esteja em condição de baixa luminosidade, o sistema passa a monitorar presença ou aproximação.
3. Se não houver presença, a iluminação permanece apagada ou em baixa intensidade.
4. Se houver presença, a iluminação é acionada em maior intensidade.
5. O sistema mede ou estima o consumo elétrico.
6. Os dados são enviados para um dashboard.
7. O painel exibe informações como status da lâmpada, presença detectada, corrente, potência, tempo de funcionamento e economia estimada.

## Indicadores do Projeto

| Indicador | Forma de Medição |
|---|---|
| Redução de consumo | Comparação entre modo tradicional e modo inteligente |
| Presença detectada | Leitura do sensor de presença ou distância |
| Tempo de funcionamento | Tempo em que a lâmpada permaneceu ligada |
| Corrente elétrica | Leitura do sensor ACS712 ou INA219 |
| Potência estimada | Cálculo com base na tensão e corrente |
| Economia estimada | Diferença entre consumo contínuo e consumo automatizado |
| Alerta de falha | Simulação de funcionamento irregular no dashboard |

## Arquitetura do Sistema


