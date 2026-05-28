#pragma once
#include <stddef.h>
#include <string.h>

// Vertente 1 (Ineficiente / Anti-Padrao): Array com deslocamento de elementos
// Complexidade: push O(n), pop O(n)
// A cada nova insercao quando cheio, todos os N elementos sao deslocados,
// consumindo ciclos de CPU proporcionais ao tamanho do buffer.
template <typename T, size_t N>
class IneffBuffer {
public:
  IneffBuffer() : _count(0) {}

  // Insere item no final. Se cheio, desloca todos os elementos à esquerda
  // (descarta o mais antigo) antes de inserir.
  // Complexidade: O(n) — o loop de deslocamento percorre toda a colecao
  bool push(const T& item) {
    if (_count == N) {
      // Deslocamento: move cada elemento uma posicao para a esquerda
      // Este loop e o gargalo que demonstra O(n)
      for (size_t i = 0; i < N - 1; i++) {
        _buf[i] = _buf[i + 1];
      }
      _count = N - 1;
    }
    _buf[_count] = item;
    _count++;
    return true;
  }

  // Remove o elemento mais antigo (posicao 0), desloca todos os restantes.
  // Complexidade: O(n)
  bool pop(T& item) {
    if (_count == 0) return false;
    item = _buf[0];
    for (size_t i = 0; i < _count - 1; i++) {
      _buf[i] = _buf[i + 1];
    }
    _count--;
    return true;
  }

  bool isEmpty() const { return _count == 0; }
  bool isFull()  const { return _count == N; }
  size_t count() const { return _count; }
  size_t capacity() const { return N; }

  void clear() { _count = 0; }

private:
  T      _buf[N];
  size_t _count;
};
