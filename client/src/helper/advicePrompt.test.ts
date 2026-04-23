import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAdviceAssetsInfo, buildAdvicePromptData } from './advicePrompt.js'

test('buildAdviceAssetsInfo converts asset amounts into the selected currency when rates exist', () => {
  const assetsInfo = buildAdviceAssetsInfo(
    [
      {
        alias: '中银银行',
        amount: 128,
        liquidity: 'High',
        risk: 'Low',
        tags: 'cash',
        currency: 'HKD',
      },
    ],
    'CNY',
    { HKD: 1, CNY: 0.9 },
    [],
  )

  assert.match(assetsInfo, /Amount: ¥115\.2/)
  assert.doesNotMatch(assetsInfo, /HK\$/)
})

test('buildAdvicePromptData fetches missing exchange rates before formatting advice amounts', async () => {
  const result = await buildAdvicePromptData({
    rawAssetsArr: [
      {
        alias: '中银银行',
        amount: 132,
        liquidity: 'Good',
        risk: 'Low',
        tags: '现金或备用',
        currency: 'HKD',
      },
    ],
    targetCurrency: 'CNY',
    exchangeRates: {},
    customCurrencies: [],
    fetchExchangeRates: async () => ({ HKD: 1, CNY: 0.9 }),
  })

  assert.equal(result.formattedTotal, '¥118.8')
  assert.match(result.assetsInfo, /Amount: ¥118\.8/)
  assert.doesNotMatch(result.assetsInfo, /HK\$132/)
})
