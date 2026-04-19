<script>
  import { createEventDispatcher } from 'svelte'
  import dayjs from 'dayjs'
  import {
    Button,
    Card,
    Table,
    TableBody,
    TableBodyCell,
    TableHead,
    TableHeadCell,
  } from 'flowbite-svelte'
  import { _ } from 'svelte-i18n'
  import Caption from '../Caption.svelte'
  import confetti from 'canvas-confetti'
  import { SUPPORTED_CURRENCIES } from './../../helper/constant'
  import { moveAssetItem } from './../../helper/assetOrder'
  import { randomInRange, convertCurrency, getCurrencySymbol } from './../../helper/utils'
  import {
    exchangeRates,
    language,
    targetCurrencyCode,
    targetCurrencyName,
    isResettable,
    totalAssetValue,
    customCurrencies,
  } from '../../stores'

  $: if ($targetCurrencyCode || $language) {
    targetCurrencyName.set($_(`currencys.${$targetCurrencyCode}`) || $targetCurrencyCode)
  }

  const getCurrencyName = (code) => {
    const currency = SUPPORTED_CURRENCIES.find((item) => item.value === code)
    return currency ? $_(`currencys.${currency.value}`, { locale: $language }) : code
  }

  export let options = []
  let typeSortOrder = 'none'
  let sortedOptions = []
  let draggingType = ''
  let dragOverType = ''
  const tableRowClass = 'border-b last:border-b-0 bg-white odd:bg-white even:bg-gray-50'

  const getTypeLabel = (item) => (item.alias || item.type || '').trim()
  const getSortBucket = (label) => {
    if (!label) return 3
    const firstChar = label[0]
    if (/\d/.test(firstChar) || /[^\p{L}\p{N}]/u.test(firstChar)) return 0
    if (/\p{Script=Latin}/u.test(firstChar)) return 1
    if (/[\u3400-\u9FFF]/.test(firstChar)) return 2
    return 3
  }

  const baseSortOptions = { numeric: true, sensitivity: 'base' }
  const defaultCollator = new Intl.Collator('en', baseSortOptions)
  const pinyinCollator = new Intl.Collator('zh-u-co-pinyin', baseSortOptions)
  const compareByTypeLabel = (left, right) => {
    const leftLabel = getTypeLabel(left)
    const rightLabel = getTypeLabel(right)
    const bucketDiff = getSortBucket(leftLabel) - getSortBucket(rightLabel)
    if (bucketDiff !== 0) return bucketDiff
    if (getSortBucket(leftLabel) === 2) return pinyinCollator.compare(leftLabel, rightLabel)
    return defaultCollator.compare(leftLabel, rightLabel)
  }

  $: {
    if (typeSortOrder === 'asc') {
      sortedOptions = [...options].sort(compareByTypeLabel)
    } else if (typeSortOrder === 'desc') {
      sortedOptions = [...options].sort((left, right) => compareByTypeLabel(right, left))
    } else {
      sortedOptions = options
    }
  }

  // 计算转换后的总资产并更新到 store
  $: {
    const calculatedTotal = options.reduce((sum, item) => {
      const convertedAmount = convertCurrency(
        item.amount,
        item.currency,
        $targetCurrencyCode,
        $exchangeRates,
      )
      return sum + convertedAmount
    }, 0)
    totalAssetValue.set(Number(calculatedTotal.toFixed(2)))
  }

  const dispatch = createEventDispatcher()

  const fireConfetti = (opts) => {
    const scalar = randomInRange(1.1, 2)
    const dollar = confetti.shapeFromText({ text: '💸', scalar })
    const money = confetti.shapeFromText({ text: '💰', scalar })
    const defaults = {
      angle: randomInRange(81, 99),
      shapes: ['circle', 'circle', 'square', dollar, money],
      spread: randomInRange(66, 99),
      particleCount: randomInRange(39, 269),
      startVelocity: randomInRange(39, 69),
      drift: randomInRange(-0.1, 0.1),
      ticks: randomInRange(180, 220),
      origin: { x: randomInRange(0.49, 0.51), y: 0.6 },
      scalar,
    }
    confetti({
      ...defaults,
      ...opts,
    })
  }

  const onUpdateClick = (elem) => {
    dispatch('update', elem)
  }

  const onDestroyClick = (elem) => {
    dispatch('destroy', elem)
  }

  const canDragReorder = () => typeSortOrder === 'none'

  const resetDragState = () => {
    draggingType = ''
    dragOverType = ''
  }

  const onDragStart = (event, item) => {
    if (!canDragReorder()) {
      event.preventDefault()
      return
    }

    draggingType = item.type
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', item.type)
  }

  const onDragEnter = (item) => {
    if (!canDragReorder() || draggingType === item.type) {
      return
    }

    dragOverType = item.type
  }

  const onDragOver = (event, item) => {
    if (!canDragReorder() || draggingType === item.type) {
      return
    }

    event.preventDefault()
    dragOverType = item.type
  }

  const onDrop = (item) => {
    if (!canDragReorder()) {
      resetDragState()
      return
    }

    const reorderedAssets = moveAssetItem(options, draggingType, item.type)
    resetDragState()

    if (reorderedAssets !== options) {
      dispatch('reorder', reorderedAssets)
    }
  }

  const onPersistClick = () => {
    fireConfetti({ spread: 30, startVelocity: 60, decay: 0.9 })
    fireConfetti({ spread: 60, startVelocity: 30, decay: 0.91 })
    fireConfetti({ spread: 120, startVelocity: 50, decay: 0.92 })
    fireConfetti({ spread: 120, startVelocity: 10, decay: 0.93 })
  }

  const onResetClick = () => {
    dispatch('reset')
  }

  const onTypeSortToggle = () => {
    if (typeSortOrder === 'none') {
      typeSortOrder = 'asc'
    } else if (typeSortOrder === 'asc') {
      typeSortOrder = 'desc'
    } else {
      typeSortOrder = 'none'
    }
  }

  const getLatestUpdatedTime = (item) => {
    const latestTime = item.updated || item.created || item.datetime
    return latestTime ? dayjs(latestTime).format('YYYY-MM-DD HH:mm') : '--'
  }
</script>

<Card
  size="xl"
  class="hide-scrollbar w-full  max-w-none overflow-x-scroll shadow-none md:p-4 2xl:col-span-2">
  <div class="mb-4 flex flex-row gap-3 sm:flex-row sm:items-start sm:justify-between">
    <Caption title={$_('recordAssets')}></Caption>
    <a href="/detail" class="regular-btn focus-visible-ring !min-w-fit">{$_('viewDetails')}</a>
  </div>
  <Table hoverable={true} striped={true} class="divide-y last:border-b-0">
    <TableHead class="text-sm">
      <TableHeadCell class="w-12">
        <span class="sr-only">reorder</span>
      </TableHeadCell>
      <TableHeadCell>
        <button
          type="button"
          class="hover:text-brand inline-flex items-center gap-2 focus:outline-none"
          on:click={onTypeSortToggle}>
          <span>{$_('type')}</span>
          {#if typeSortOrder === 'asc'}
            <span class="text-xs">A-Z</span>
          {:else if typeSortOrder === 'desc'}
            <span class="text-xs">Z-A</span>
          {/if}
        </button>
      </TableHeadCell>
      <TableHeadCell>{$_('amount')}</TableHeadCell>
      <TableHeadCell>{$_('currency')}</TableHeadCell>
      <TableHeadCell>{$_('latestUpdatedTime')}</TableHeadCell>
      <TableBodyCell><span class="px-4 py-2">{$_('action')}</span></TableBodyCell>
      <TableBodyCell><span class="px-4 py-2">{$_('action')}</span></TableBodyCell>
    </TableHead>
    <TableBody tableBodyClass="py-4">
      {#each sortedOptions as item (item.type)}
        <tr
          draggable={canDragReorder()}
          class={`${tableRowClass} ${draggingType === item.type ? 'opacity-60' : ''} ${
            dragOverType === item.type ? 'bg-yellow-50' : ''
          }`}
          on:dragstart={(event) => onDragStart(event, item)}
          on:dragenter={() => onDragEnter(item)}
          on:dragover={(event) => onDragOver(event, item)}
          on:drop={() => onDrop(item)}
          on:dragend={resetDragState}>
          <TableBodyCell>
            <span
              class={`inline-flex select-none items-center text-lg leading-none ${
                canDragReorder() ? 'cursor-grab text-slate-400' : 'cursor-not-allowed text-slate-300'
              }`}>
              ::
            </span>
          </TableBodyCell>
          <TableBodyCell>{item.alias || item.type}</TableBodyCell>
          <TableBodyCell>
            <span
              class="text-brand border-brand me-1 inline-flex items-center rounded-sm border bg-yellow-50 px-1 py-0.5 text-xs font-medium">
              {getCurrencySymbol(item.currency, $customCurrencies)}
            </span>
            {item.amount}
          </TableBodyCell>
          <TableBodyCell>{getCurrencyName(item.currency) + ($language ? '' : '')}</TableBodyCell>
          <TableBodyCell>{getLatestUpdatedTime(item)}</TableBodyCell>
          <TableBodyCell>
            <Button
              size="sm"
              outline
              class="border-none focus:ring-0"
              on:click={() => {
                onUpdateClick(item)
              }}>
              <span class="hover:text-brand text-mark">{$_('update')}</span>
            </Button>
          </TableBodyCell>
          <TableBodyCell>
            <Button
              size="sm"
              outline
              class="border-none focus:ring-0"
              on:click={() => {
                onDestroyClick(item)
              }}>
              <span class="hover:text-brand text-mark">{$_('destroy')}</span>
            </Button>
          </TableBodyCell>
        </tr>
      {/each}
      <tr class={tableRowClass}>
        <TableBodyCell>--</TableBodyCell>
        <TableBodyCell>
          <strong>{$_('total')}</strong>
        </TableBodyCell>
        <TableBodyCell>
          <strong class="text-brand font-bold">
            <span
              class="text-brand border-brand me-1 inline-flex items-center rounded-sm border bg-yellow-50 px-1 py-0.5 text-xs font-medium">
              {getCurrencySymbol($targetCurrencyCode, $customCurrencies)}
            </span>
            {$totalAssetValue}
          </strong>
        </TableBodyCell>
        <TableBodyCell>
          <strong class="text-brand font-bold">
            {$targetCurrencyName}
          </strong>
        </TableBodyCell>
        <TableBodyCell>--</TableBodyCell>
        <TableBodyCell>
          <Button size="sm" outline class="border-none focus:ring-0" on:click={onPersistClick}>
            <span class="text-mark hover:text-brand font-bold">{$_('persist')}</span>
          </Button>
        </TableBodyCell>
        <TableBodyCell>
          <Button
            size="sm"
            outline
            disabled={!$isResettable}
            class="border-none focus:ring-0"
            on:click={onResetClick}>
            <span class="text-mark hover:text-brand font-bold">{$_('reset')}</span>
          </Button>
        </TableBodyCell>
      </tr>
    </TableBody>
  </Table>
</Card>
