import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSingleItemLayout } from '../src/utils/printFormatting.js';

test('single item reference layout includes an explicit printing-service row', () => {
  for (const description of ['JASA CETAK', 'Printing Service']) {
    assert.equal(isSingleItemLayout({ items: [{ item_description: 'Store A' }, { item_description: description }] }, false), true);
  }
  assert.equal(isSingleItemLayout({ items: [{ store_name: 'Store A' }], total_jasa_cetak: 1000 }, false), true);
});

test('internal totals and multiple primary items keep their existing layout', () => {
  assert.equal(isSingleItemLayout({ items: [{ item_description: 'Store A' }] }, true), false);
  assert.equal(isSingleItemLayout({ items: [{ item_description: 'Store A' }, { item_description: 'Store B' }] }, false), false);
  assert.equal(isSingleItemLayout({ items: [] }, false), false);
});
