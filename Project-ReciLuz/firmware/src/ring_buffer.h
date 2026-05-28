#pragma once
#include <stddef.h>

// Vertente 2 (Eficiente): Buffer Circular com indices Head/Tail
// Complexidade: push O(1), pop O(1)
// Memoria estatica fixa: nao fragmenta o heap
template <typename T, size_t N>
class RingBuffer {
public:
  RingBuffer() : _head(0), _tail(0), _count(0) {}

  // Insere item. Se cheio, sobrescreve o elemento mais antigo.
  // Complexidade: O(1) — apenas incremento de indice com modulo
  bool push(const T& item) {
    _buf[_tail] = item;
    _tail = (_tail + 1) % N;
    if (_count == N) {
      // buffer cheio: avanca head para descartar o mais antigo
      _head = (_head + 1) % N;
      return false; // indicador de sobrescrita
    }
    _count++;
    return true;
  }

  // Remove e retorna o elemento mais antigo (FIFO).
  // Complexidade: O(1)
  bool pop(T& item) {
    if (_count == 0) return false;
    item = _buf[_head];
    _head = (_head + 1) % N;
    _count--;
    return true;
  }

  bool isEmpty() const { return _count == 0; }
  bool isFull()  const { return _count == N; }
  size_t count() const { return _count; }
  size_t capacity() const { return N; }

  void clear() { _head = 0; _tail = 0; _count = 0; }

private:
  T      _buf[N];
  size_t _head;
  size_t _tail;
  size_t _count;
};
