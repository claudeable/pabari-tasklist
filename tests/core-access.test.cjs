const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const source = ts.transpileModule(fs.readFileSync(require.resolve('../lib/core-access.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText
const context = { exports: {} }
vm.runInNewContext(source, context)
const { canAccessCore, canAccessTaskPortal, hasKenyaCoreEmail } = context.exports

test('both Kenya company domains can enter Core for every role', () => {
  for (const domain of ['usm.co.ke', 'kwale-group.com']) {
    for (const role of ['staff', 'manager', 'director', 'ceo', 'admin']) {
      assert.equal(canAccessCore({ email: `person@${domain}`, role, portals: ['smartops'] }, 'kenya'), true)
    }
  }
})

test('domain comparison handles case and rejects lookalikes', () => {
  assert.equal(hasKenyaCoreEmail(' Person@USM.CO.KE '), true)
  for (const email of ['person@usm.co.ke.attacker.com', 'person@evilkwale-group.com', '@usm.co.ke', 'a@@usm.co.ke', 'person@example.com']) {
    assert.equal(hasKenyaCoreEmail(email), false)
  }
})

test('new domain access is Kenya-only and existing admin access remains', () => {
  assert.equal(canAccessCore({ email: 'person@usm.co.ke', role: 'staff' }, 'india'), false)
  assert.equal(canAccessCore({ email: 'admin@example.com', role: 'admin' }, 'kenya'), true)
  assert.equal(canAccessCore({ email: 'person@example.com', role: 'staff' }, 'kenya'), false)
})

test('company users can open Tasks even when only Smart Ops is assigned', () => {
  assert.equal(canAccessTaskPortal({ email: 'person@usm.co.ke', role: 'staff', portals: ['smartops'] }, 'kenya'), true)
  assert.equal(canAccessTaskPortal({ email: 'person@example.com', role: 'staff', portals: ['smartops'] }, 'kenya'), false)
  assert.equal(canAccessTaskPortal({ email: 'person@example.com', role: 'staff', portals: ['tasks'] }, 'kenya'), true)
})
