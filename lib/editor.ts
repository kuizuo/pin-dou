export function setCell(
  cells: Array<string | null>,
  index: number,
  color: string | null,
) {
  if (index < 0 || index >= cells.length || cells[index] === color)
    return { cells, changed: 0 };
  const next = [...cells];
  next[index] = color;
  return { cells: next, changed: 1 };
}

export function replaceAllColor(
  cells: Array<string | null>,
  source: string,
  target: string,
) {
  if (source === target) return { cells, changed: 0 };
  let changed = 0;
  const next = cells.map((cell) => {
    if (cell !== source) return cell;
    changed += 1;
    return target;
  });
  return { cells: changed ? next : cells, changed };
}

export function replaceConnectedRegion(
  cells: Array<string | null>,
  width: number,
  start: number,
  target: string | null,
) {
  const source = cells[start];
  if (start < 0 || start >= cells.length || source === target)
    return { cells, changed: 0 };
  const height = Math.ceil(cells.length / width);
  const visited = new Uint8Array(cells.length);
  const queue = [start];
  const region: number[] = [];
  visited[start] = 1;

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor];
    if (cells[index] !== source) continue;
    region.push(index);
    const x = index % width;
    const y = Math.floor(index / width);
    const neighbors = [
      x > 0 ? index - 1 : -1,
      x < width - 1 ? index + 1 : -1,
      y > 0 ? index - width : -1,
      y < height - 1 ? index + width : -1,
    ];
    for (const neighbor of neighbors) {
      if (neighbor >= 0 && neighbor < cells.length && !visited[neighbor]) {
        visited[neighbor] = 1;
        if (cells[neighbor] === source) queue.push(neighbor);
      }
    }
  }

  if (!region.length) return { cells, changed: 0 };
  const next = [...cells];
  for (const index of region) next[index] = target;
  return { cells: next, changed: region.length };
}
