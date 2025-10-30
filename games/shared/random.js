export function randRange(min, max) {
  return Math.random() * (max - min) + min;
}

export function randInt(min, max) {
  return Math.floor(randRange(min, max + 1));
}

export function choose(array) {
  return array[Math.floor(Math.random() * array.length)];
}
