const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

// Node's built-in TS transform; no test framework or browser dependencies.
function load(file, overrides = {}, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const names = [];
  const transformed = stripTypeScriptTypes(source, { mode: 'transform' });
  const code = transformed.replace(/import \{([^}]+)\} from ["']([^"']+)["'];/g, (_, symbols, id) => `const {${symbols}} = require('${id}');`)
    .replace(/export (async )?(function|class|const) (\w+)/g, (_, asyncPart = '', kind, name) => { names.push(name); return `${asyncPart}${kind} ${name}`; })
    + `\nObject.assign(exports, {${names.join(',')}});`;
  const exports = {};
  const localRequire = id => id in overrides ? overrides[id] : id.startsWith('@/') ? load(id === '@/types' ? 'types/index.ts' : id.slice(2) + '.ts', overrides, globals) : require(id);
  vm.runInNewContext(code, { exports, require: localRequire, Buffer, Response, Request, Uint8Array, process: { env: {} }, ...globals }, { filename: file });
  return exports;
}

test('clean trace rejects empty, single-point and disconnected-only input', () => {
  const { exportTrace } = load('lib/trace.ts');
  assert.equal(exportTrace([]), null);
  assert.equal(exportTrace([{ x: 1, y: 1 }]), null);
  assert.equal(exportTrace([{ x: 1, y: 1 }, { x: 10, y: 20, breakBefore: true }]), null);
});

test('trace export centers a vertical drawing on a white 768px PNG, with no camera draw', () => {
  const calls = [];
  const ctx = Object.fromEntries(['fillRect', 'beginPath', 'moveTo', 'quadraticCurveTo', 'lineTo', 'stroke'].map(name => [name, (...args) => calls.push([name, ...args])]));
  const canvas = { getContext: () => ctx, toDataURL: mime => { assert.equal(mime, 'image/png'); return 'png'; } };
  const { exportTrace } = load('lib/trace.ts', {}, { document: { createElement: () => canvas } });
  assert.equal(exportTrace([{ x: 20, y: 10 }, { x: 20, y: 110 }]), 'png');
  assert.equal(canvas.width, 768); assert.equal(canvas.height, 768);
  assert.equal(ctx.fillStyle, '#ffffff'); assert.equal(ctx.strokeStyle, '#171717');
  assert.deepEqual(calls.find(c => c[0] === 'moveTo'), ['moveTo', 384, 64]);
  assert.deepEqual(calls.find(c => c[0] === 'lineTo'), ['lineTo', 384, 704]);
});

test('reacquiring a hand starts a new stroke instead of joining the gap', () => {
  const moves = [];
  const ctx = { beginPath() {}, stroke() {}, quadraticCurveTo() {}, lineTo() {}, moveTo: (x, y) => moves.push([x, y]) };
  load('lib/trace.ts').drawTrace(ctx, [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 100, y: 100, breakBefore: true }, { x: 110, y: 110 }]);
  assert.deepEqual(moves, [[0, 0], [100, 100]]);
});

const valid = { object: 'coffee mug', confidence: 'medium', description: 'A cup with a curved handle.' };

test('MediaPipe initialization notice stays informational on first inference; real errors remain visible', async () => {
  const infos = [], errors = [];
  const logger = { info: (...args) => infos.push(args), error: (...args) => errors.push(args) };
  const originalError = logger.error;
  const notice = 'INFO: Created TensorFlow Lite XNNPACK delegate for CPU.';
  const failure = new Error('Inference failed');
  const vision = {
    FilesetResolver: { forVisionTasks: async () => ({}) },
    HandLandmarker: { createFromOptions: async () => {
      // Match the WASM runtime: capture the logger now, use it on first detection.
      const printErr = logger.error.bind(logger);
      return { detectForVideo() {
        printErr(notice);
        printErr('Graph execution failed', failure);
        printErr(notice, failure);
        throw failure;
      } };
    } },
  };
  const { createHandLandmarker } = load('lib/mediapipe.ts', { '@mediapipe/tasks-vision': vision }, { console: logger });
  const tracker = await createHandLandmarker();
  assert.equal(logger.error, originalError);
  assert.throws(() => tracker.detectForVideo(), error => error === failure);
  assert.deepEqual(infos, [[notice]]);
  assert.deepEqual(errors, [['Graph execution failed', failure], [notice, failure]]);
});

test('overlapping MediaPipe initialization restores console logging even when one load fails', async () => {
  const logger = { info() {}, error() {} };
  const originalError = logger.error;
  const pending = [];
  const vision = {
    FilesetResolver: { forVisionTasks: async () => ({}) },
    HandLandmarker: { createFromOptions: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) },
  };
  const { createHandLandmarker } = load('lib/mediapipe.ts', { '@mediapipe/tasks-vision': vision }, { console: logger });
  const first = createHandLandmarker(), second = createHandLandmarker();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(pending.length, 2);
  assert.notEqual(logger.error, originalError);
  pending[0].resolve({});
  await first;
  assert.notEqual(logger.error, originalError);
  pending[1].reject(new Error('Could not load model'));
  await assert.rejects(second, /Could not load model/);
  assert.equal(logger.error, originalError);
});

test('model output validation rejects markdown, bad confidence and descriptions of 20 words', () => {
  const { parseInterpretation } = load('lib/gemma.ts');
  assert.equal(parseInterpretation(JSON.stringify(valid)).object, valid.object);
  for (const value of [undefined, '```json\n{}\n```', '{}', JSON.stringify({ ...valid, confidence: 'certain' }), JSON.stringify({ ...valid, description: Array(20).fill('word').join(' ') })]) {
    assert.throws(() => parseInterpretation(value), /unreadable/);
  }
});

test('one interpretation sends one image, no history, and disables SDK retries', async () => {
  let calls = 0, options, request;
  class FakeAI {
    constructor(config) { options = config; }
    models = { generateContent: async input => { calls++; request = input; return { text: JSON.stringify(valid) }; } };
  }
  const gemma = load('lib/gemma.ts', { '@google/genai': { GoogleGenAI: FakeAI, ThinkingLevel: { MINIMAL: 'minimal' } } }, { process: { env: { GEMINI_API_KEY: 'test-only' } } });
  assert.equal((await gemma.interpret('trace', 'image-data', 'image/png')).object, 'coffee mug');
  assert.equal(calls, 1); assert.equal(options.httpOptions.retryOptions.attempts, 1);
  assert.equal(request.model, gemma.GEMMA_MODEL); assert.equal(request.contents.length, 1);
  assert.equal(request.contents[0].parts[1].inlineData.data, 'image-data');
  assert.match(request.contents[0].parts[0].text, /air-drawn/);
});

test('missing key makes zero SDK requests; quota error makes one and returns understandable error', async () => {
  let calls = 0;
  class FakeAI { models = { generateContent: async () => { calls++; throw { status: 429 }; } }; }
  const overrides = { '@google/genai': { GoogleGenAI: FakeAI, ThinkingLevel: { MINIMAL: 'minimal' } } };
  await assert.rejects(load('lib/gemma.ts', overrides).interpret('object', 'image', 'image/jpeg'), /GEMINI_API_KEY/);
  assert.equal(calls, 0);
  const gemma = load('lib/gemma.ts', overrides, { process: { env: { GEMINI_API_KEY: 'test-only' } } });
  await assert.rejects(gemma.interpret('object', 'image', 'image/jpeg'), /free-tier limit/);
  assert.equal(calls, 1);
});

test('route rejects malformed requests before invoking Gemma, and accepts PNG in both modes', async () => {
  let calls = 0;
  const gemma = { InterpretError: class extends Error {}, interpret: async () => { calls++; return valid; } };
  const { POST } = load('app/api/interpret/route.ts', { '@/lib/gemma': gemma });
  const send = (body, contentType = 'application/json') => POST(new Request('http://localhost/api/interpret', { method: 'POST', headers: { 'content-type': contentType }, body }));
  assert.equal((await send('{}', 'text/plain')).status, 415);
  assert.equal((await send('{')).status, 400);
  assert.equal((await send('null')).status, 400);
  assert.equal((await send(JSON.stringify({ mode: 'trace', image: 'bad!' }))).status, 400);
  assert.equal((await send('x'.repeat(3 * 1024 * 1024 + 1))).status, 413);
  assert.equal(calls, 0);
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jV5kAAAAASUVORK5CYII=';
  for (const mode of ['trace', 'object']) {
    const response = await send(JSON.stringify({ mode, image: png }));
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), valid);
  }
  assert.equal(calls, 2);
});
