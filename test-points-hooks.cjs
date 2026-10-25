const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const receiverSource = fs.readFileSync(path.join(__dirname, '../pixel-pwa-backend/pb_hooks/test_order_points.pb.js'), 'utf8');
let route;
let balance = 100;
let history = [];
const fields = { notes: {}, type: { options: { values: ['compra', 'canje'] } } };
const dao = {
  findCollectionByNameOrId: () => ({ schema: { getFieldByName: name => fields[name] } }),
  findRecordsByFilter: (_collection, _filter, _sort, _limit, _offset, params) => history.filter(x => x.client === params.client && x.notes === params.marker),
  findRecordById: () => ({ getString: () => 'admin@example.com', getInt: () => balance, set: (_field, value) => { balance = value; } }),
  saveRecord: record => { if (record.values) history.push(record.values); },
  runInTransaction: fn => {
    const before = { balance, history: [...history] };
    try { fn(dao); } catch (error) { balance = before.balance; history = before.history; throw error; }
  },
};
vm.runInNewContext(receiverSource, {
  routerAdd: (_method, _path, handler) => { route = handler; },
  $os: { getenv: key => key === 'POINTS_BRIDGE_SECRET' ? 'secret' : 'admin@example.com' },
  $apis: { requestInfo: c => ({ data: c.data }) },
  $app: { dao: () => dao }, console,
  Record: function () { this.values = {}; this.set = (key, value) => { this.values[key] = value; }; },
});
const call = (key = 'secret', points = 50) => route({
  request: () => ({ header: { get: () => key } }),
  data: { orderId: '1234567890abcde', clientId: 'abcde1234567890', points },
  json: (status, body) => ({ status, body }),
});
assert.equal(call('wrong').status, 403);
assert.equal(call('secret', -1).status, 400);
assert.equal(call().status, 200);
assert.equal(balance, 150);
assert.equal(history[0].type, 'compra');
assert.equal(call().body.alreadyClaimed, true);
assert.equal(balance, 150);
assert.equal(history.length, 1);
history = []; balance = 100;
const originalSave = dao.saveRecord;
dao.saveRecord = record => { if (!record.values) throw new Error('simulated balance failure'); originalSave(record); };
assert.equal(call().status, 500);
assert.equal(balance, 100);
assert.equal(history.length, 0);
console.log('OK: auth, validation, schema, duplicate prevention and rollback (mock DAO).');

const senderSource = fs.readFileSync(path.join(__dirname, 'pb_hooks/test_order_points.js'), 'utf8');
let sends = 0;
let claimed = false;
let responseStatus = 200;
const senderContext = {
  module: { exports: {} },
  $os: { getenv: key => key === 'POINTS_BRIDGE_SECRET' ? 'secret' : 'https://pwa.example.com' },
  $http: { send: () => { sends++; return { statusCode: responseStatus, json: { success: true } }; } },
  $app: { dao: () => ({ findRecordById: () => ({ set: (_field, value) => { claimed = value; } }), saveRecord: () => {} }) },
};
vm.runInNewContext(senderSource, senderContext);
const values = { source: 'app', progress: 'preparing', clientCreatedAt: 'test:abcde1234567890:123', points: 50 };
const order = { id: '1234567890abcde', getString: key => values[key] || '', getInt: key => values[key], getBool: () => false };
senderContext.module.exports.credit(order);
assert.equal(sends, 0);
values.progress = 'delivered';
responseStatus = 500;
assert.throws(() => senderContext.module.exports.credit(order));
assert.equal(claimed, false);
responseStatus = 200;
senderContext.module.exports.credit(order);
assert.equal(claimed, true);
console.log('OK: sender ignores unfinished orders, preserves pending on HTTP failure, marks claimed on success.');
