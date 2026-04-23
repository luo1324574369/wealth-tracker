const currencySymbolMap = {
  CNY: '¥',
  USD: '$',
  HKD: 'HK$',
  BTC: '₿',
  EUR: '€',
  JPY: '¥',
  KRW: '₩',
  GBP: '£',
  SGD: 'S$',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'CHF',
}

const getAdviceCurrencySymbol = (currencyCode, customCurrencies = []) => {
  if (currencySymbolMap[currencyCode]) {
    return currencySymbolMap[currencyCode]
  }

  const customCurrency = customCurrencies.find((currency) => currency.code === currencyCode)
  if (customCurrency) {
    return customCurrency.symbol
  }

  return currencyCode
}

const convertAdviceCurrency = (amount, fromCurrency, toCurrency, rates) => {
  if (!rates || !rates[fromCurrency] || !rates[toCurrency]) {
    return amount
  }

  const baseAmount = amount / rates[fromCurrency]
  return Number((baseAmount * rates[toCurrency]).toFixed(2))
}

const formatAdviceAmount = (amount, currency, targetCurrency, rates, customCurrencies) => {
  const shouldConvert =
    currency !== targetCurrency && rates?.[currency] && rates?.[targetCurrency]
  const displayCurrency = shouldConvert ? targetCurrency : currency
  const displayAmount = shouldConvert
    ? convertAdviceCurrency(amount, currency, targetCurrency, rates)
    : amount
  const currencySymbol = getAdviceCurrencySymbol(displayCurrency || 'CNY', customCurrencies)

  return `${currencySymbol}${Number(displayAmount).toLocaleString('en-US')}`
}

const getAdviceConvertedAmount = (amount, currency, targetCurrency, exchangeRates) => {
  if (currency === targetCurrency) {
    return amount
  }

  if (!exchangeRates?.[currency] || !exchangeRates?.[targetCurrency]) {
    return 0
  }

  return convertAdviceCurrency(amount, currency, targetCurrency, exchangeRates)
}

const needsAdviceExchangeRates = (rawAssetsArr, targetCurrency, exchangeRates) => {
  return rawAssetsArr.some((item) => {
    return (
      item.currency !== targetCurrency &&
      (!exchangeRates?.[item.currency] || !exchangeRates?.[targetCurrency])
    )
  })
}

export const buildAdviceAssetsInfo = (
  rawAssetsArr,
  targetCurrency,
  exchangeRates,
  customCurrencies,
) => {
  return rawAssetsArr
    .map((item) => {
      const { alias, amount, liquidity, risk, tags, currency } = item
      const formattedAmount = formatAdviceAmount(
        amount,
        currency,
        targetCurrency,
        exchangeRates,
        customCurrencies,
      )
      const tagsInfo = tags && tags.trim() ? `, Tags: ${tags}` : ''
      return `- Account name: ${alias}, Amount: ${formattedAmount}, Liquidity: ${liquidity.toLowerCase()}, Risk: ${risk.toLowerCase()}${tagsInfo}`
    })
    .join('\n  ')
}

export const buildAdvicePromptData = async ({
  rawAssetsArr,
  targetCurrency,
  exchangeRates,
  customCurrencies,
  fetchExchangeRates,
}) => {
  let resolvedExchangeRates = exchangeRates

  if (needsAdviceExchangeRates(rawAssetsArr, targetCurrency, exchangeRates) && fetchExchangeRates) {
    resolvedExchangeRates = (await fetchExchangeRates()) || exchangeRates
  }

  const assetsInfo = buildAdviceAssetsInfo(
    rawAssetsArr,
    targetCurrency,
    resolvedExchangeRates,
    customCurrencies,
  )

  const convertedTotalAssets = rawAssetsArr.reduce((sum, item) => {
    return (
      sum +
      getAdviceConvertedAmount(item.amount, item.currency, targetCurrency, resolvedExchangeRates)
    )
  }, 0)

  const targetSymbol = getAdviceCurrencySymbol(targetCurrency, customCurrencies)

  return {
    assetsInfo,
    formattedTotal: `${targetSymbol}${convertedTotalAssets.toLocaleString('en-US')}`,
  }
}
