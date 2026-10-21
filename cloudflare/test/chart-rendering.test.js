import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDistancePlot, renderWeeklyActivity } from '../public/trends-plot.js';

// Small DOM surface for verifying SVG semantics; browser QA checks actual layout.
class Node {
  constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.dataset = {}; }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren() { this.children = []; }
  addEventListener() {}
}

test('weekly bars, scale, table and accessible description exclude range updates even when updates dominate', () => {
  globalThis.document = { createElementNS: (_, tag) => new Node(tag), createElement: tag => new Node(tag) };
  try {
    const svg = new Node('svg'), table = new Node('tbody');
    renderWeeklyActivity(svg, table, [
      { start: 100000, end: 186400, lightning: 1, range_change: 9000, nearest: 17 },
      { start: 186400, end: 272800, lightning: 0, range_change: 8000, nearest: null }
    ]);
    const bars = svg.children.filter(node => node.tag === 'rect');
    assert.equal(bars.length, 1);
    assert.equal(Number(bars[0].attrs.height), 150);
    assert.match(bars[0].attrs['aria-label'], /1 recorded lightning observations/);
    assert.equal(table.children[0].children.length, 3);
    assert.equal(table.children[1].children[1].textContent, 0);
    assert.match(svg.children.find(node => node.tag === 'desc').textContent, /Range updates are excluded/);
    assert.doesNotMatch(JSON.stringify(svg), /9000|8000/);
  } finally { delete globalThis.document; }
});

test('distance chart hides diagnostic markers by default and includes them only on explicit request', () => {
  globalThis.document = { createElementNS: (_, tag) => new Node(tag), createElement: tag => new Node(tag) };
  try {
    const svg = new Node('svg'), note = new Node('p');
    const trends = { now: 200000, bucket_seconds: 300, untimed: 0, ranges: [
      { type: 'range_change', distance_raw: 20, first_at: 199000, last_at: 199000, count: 12 }
    ] };
    renderDistancePlot(svg, note, trends);
    assert.equal(svg.children.filter(node => node.attrs.class === 'plot-update').length, 0);
    assert.match(note.textContent, /0 recorded lightning observations/);
    renderDistancePlot(svg, note, trends, 24, true);
    assert.equal(svg.children.filter(node => node.attrs.class === 'plot-update').length, 1);
    assert.match(note.textContent, /12 diagnostic range updates/);
  } finally { delete globalThis.document; }
});
