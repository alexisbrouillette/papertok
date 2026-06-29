// Test collision resolution logic in GraphExplorer
const activeNode = {
  id: 'paper_0',
  isPaperNode: true,
  x: 250,
  y: 250,
  vx: 0,
  vy: 0
};

const targetNode = {
  id: 'concept_0',
  isPaperNode: false,
  x: 260,
  y: 260,
  vx: 2,
  vy: 2
};

const nextNodes = {
  'paper_0': { ...activeNode },
  'concept_0': { ...targetNode }
};

const activeId = 'paper_0';
const isPaper = activeNode.isPaperNode;
const w = isPaper ? 140 : 110;
const h = isPaper ? 105 : 80;

const nodesList = Object.values(nextNodes);

nodesList.forEach(n => {
  if (n.id === activeId) return;
  const targetNode = nextNodes[n.id];
  if (!targetNode) return;

  const rn = n.isTopicHub ? 30 : n.isPaperNode ? 24 : 20;
  const W = w + rn;
  const H = h + rn;

  const dx = targetNode.x - activeNode.x;
  const dy = targetNode.y - activeNode.y;
  const overlapX = W - Math.abs(dx);
  const overlapY = H - Math.abs(dy);

  console.log(`Node: ${n.id}`);
  console.log(`dx: ${dx}, dy: ${dy}`);
  console.log(`W: ${W}, H: ${H}`);
  console.log(`overlapX: ${overlapX}, overlapY: ${overlapY}`);

  if (overlapX > 0 && overlapY > 0) {
    console.log('Overlap detected!');
    const resolved = { ...targetNode };
    if (overlapX < overlapY) {
      resolved.x = activeNode.x + (dx >= 0 ? W : -W);
      resolved.vx = 0; // stop velocity along X
      console.log(`Pushed horizontally to x: ${resolved.x}`);
    } else {
      resolved.y = activeNode.y + (dy >= 0 ? H : -H);
      resolved.vy = 0; // stop velocity along Y
      console.log(`Pushed vertically to y: ${resolved.y}`);
    }
    resolved.x = Math.max(20, Math.min(480, resolved.x));
    resolved.y = Math.max(20, Math.min(480, resolved.y));
    nextNodes[n.id] = resolved;
  }
});

console.log('Final positions:', nextNodes);
