// src/greet.js — satisfies T2 in isolation but assumes objects with a `.name` field.
// When run against makeColors() (which returns strings), every `n.name` evaluates
// to undefined, producing 'Hello, undefined, Hello, undefined, Hello, undefined'.
// The cross-task shape mismatch is the seed that the phase review catches.
export function greet(names) {
  return names.map(n => `Hello, ${n.name}`).join(', ');
}
