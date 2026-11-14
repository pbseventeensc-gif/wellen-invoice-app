import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const React = require('react');
const babel = require('next/dist/compiled/babel/bundle');
const source = readFileSync(new URL('../src/components/import/ExcelUploadCard.jsx', import.meta.url), 'utf8');
const { code } = babel.core().transformSync(source, {
  configFile: false, babelrc: false,
  presets: [[babel.presetReact(), { runtime: 'classic' }]],
  plugins: [babel.pluginTransformModulesCommonjs()],
});
const componentModule = { exports: {} };
const hooks = { ...React, useId: () => 'upload-test', useRef: (value) => ({ current: value }), useState: (value) => [value, () => {}] };
new Function('require', 'module', 'exports', `const React = require('react');\n${code}`)(
  (name) => name === 'react' ? hooks : require(name), componentModule, componentModule.exports
);
const UploadCard = componentModule.exports.default;
const find = (node, type) => {
  if (!node?.props) return undefined;
  if (node.type === type) return node;
  for (const child of React.Children.toArray(node.props.children)) {
    const found = find(child, type);
    if (found) return found;
  }
};

test('dropping a file forwards it to the importer; empty drops are ignored', () => {
  const selected = [];
  const tree = UploadCard({ onFileSelect: (file) => selected.push(file) });
  const file = { name: 'recap.xlsx' };
  const drop = (files) => find(tree, 'section').props.onDrop({ preventDefault() {}, dataTransfer: { files } });
  drop([file]);
  drop([]);
  assert.deepEqual(selected, [file]);
});

test('file input allows choosing the same file again', () => {
  const selected = [];
  const tree = UploadCard({ onFileSelect: (file) => selected.push(file) });
  const file = { name: 'recap.xls' };
  const target = { files: [file], value: 'recap.xls' };
  find(tree, 'input').props.onChange({ target });
  assert.equal(target.value, '');
  assert.deepEqual(selected, [file]);
});

test('reading or saving blocks file replacement through both picker and drop', () => {
  for (const state of [{ isReading: true }, { disabled: true }]) {
    const tree = UploadCard({ ...state, onFileSelect: () => assert.fail('A busy importer must not accept another file') });
    assert.equal(find(tree, 'button').props.disabled, true);
    assert.equal(find(tree, 'input').props.disabled, true);
    find(tree, 'section').props.onDrop({ preventDefault() {}, dataTransfer: { files: [{ name: 'other.xlsx' }] } });
  }
});
