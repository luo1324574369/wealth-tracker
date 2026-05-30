<script lang="ts">
  import { onMount } from 'svelte'
  import dayjs from 'dayjs'
  import { Card, Table, TableBody, TableBodyCell, TableHead, TableHeadCell } from 'flowbite-svelte'
  import { _ } from 'svelte-i18n'
  import Caption from './../Caption.svelte'
  import Change from './../Change.svelte'
  import CustomSelect from './../Select.svelte'
  import {
    fillMissingAssetsArr,
    generateDatesArray,
    groupArrayByType,
    sortByDatetime,
    fineTuningArrayLen,
    computeChangePercent,
    getCurrencySymbol,
  } from './../../helper/utils'
  import { DATE_EXTENT_ARR } from './../../helper/constant'
  import { extent, language, targetCurrencyCode, customCurrencies } from '../../stores'

  export let sources = []

  let DATE_ACTIVE: number = 0
  let stageChangePercent: number = 0
  let tableData: any[] = []
  let assetTypes: any[] = []
  let categories: string[] = []
  let allSeriesData: any[] = []

  $: dateExtentArr = DATE_EXTENT_ARR.map((item) => ({
    lang: $language,
    name: $_(item.key, { values: { count: item.days } }),
    value: item.value,
  }))

  $: if (sources || $extent) {
    updateTable()
  }

  onMount(() => {
    extent.set(DATE_EXTENT_ARR[DATE_ACTIVE])
  })

  const genChartSeries = (params) => {
    const series = []
    params.forEach((items) => {
      const completeAssetsArr = fillMissingAssetsArr(items.array, $extent.value)
      const targetExtentArr = completeAssetsArr.filter((item) => {
        if (dayjs(item.datetime) >= dayjs($extent.value)) {
          return item
        }
      })
      const fineTunedArr = fineTuningArrayLen(targetExtentArr)
      const { alias, type } = items.array.at(-1)
      series.push({
        name: alias || type,
        data: fineTunedArr.map((item) => item.amount || 0),
      })
    })
    return series
  }

  const updateTable = () => {
    const sortedAssetsArr = sortByDatetime(sources)
    const splitAssetsArr = groupArrayByType(sortedAssetsArr)
    allSeriesData = genChartSeries(splitAssetsArr)
    categories = fineTuningArrayLen(generateDatesArray($extent.value))

    assetTypes = allSeriesData.map((series) => ({
      name: series.name
    }))

    const allRows = categories.map((date, dateIndex) => {
      const row: any = { date }
      
      allSeriesData.forEach((series) => {
        const value = series.data[dateIndex] || 0
        const prevValue = dateIndex > 0 ? series.data[dateIndex - 1] : null
        
        let change = null
        let changePercent = null
        
        if (prevValue !== null && prevValue !== 0) {
          change = value - prevValue
          changePercent = ((change / prevValue) * 100).toFixed(2)
        } else if (prevValue !== null && prevValue === 0 && value !== 0) {
          change = value
          changePercent = '100.00'
        }
        
        row[series.name] = {
          value,
          change,
          changePercent
        }
      })
      
      return row
    })

    tableData = allRows.filter((row, index) => {
      if (index === 0) return true
      
      const hasAnyChange = assetTypes.some(asset => {
        const data = row[asset.name]
        return data.change !== null && data.change !== 0
      })
      
      return hasAnyChange
    })

    stageChangePercent = computeChangePercent(allSeriesData)
  }

  const formatAmount = (value) => {
    return `${getCurrencySymbol($targetCurrencyCode, $customCurrencies)}${Number(value).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`
  }

  const getChangeColor = (change) => {
    if (change === null || change === 0) return 'text-gray-600'
    return change > 0 ? 'text-green-600' : 'text-red-600'
  }

  const getChangeSign = (change) => {
    if (change === null) return ''
    return change > 0 ? '+' : ''
  }

  const onHandleSelect = (event: CustomEvent) => {
    extent.set(event.detail)
  }
</script>

<Card size="xl" class="hide-scrollbar w-full max-w-none overflow-x-scroll shadow-none md:p-4 2xl:col-span-2">
  <Caption title={$_('assetChanges')} subtitle={$_('assetChangeInsights')}>
    <div class="inline-flex items-center space-x-4 md:flex">
      <CustomSelect
        options={dateExtentArr}
        active={DATE_ACTIVE}
        listboxClass="w-40"
        on:selected={onHandleSelect} />
      <Change value={stageChangePercent} since="" class="justify-end font-medium" />
    </div>
  </Caption>
  
  <Table hoverable={true} striped={true} class="divide-y">
    <TableHead class="text-sm">
      <TableHeadCell class="min-w-[120px]">{$_('date')}</TableHeadCell>
      {#each assetTypes as asset}
        <TableHeadCell class="min-w-[160px]">{asset.name}</TableHeadCell>
      {/each}
    </TableHead>
    <TableBody tableBodyClass="py-4">
      {#each tableData as row}
        <tr class="border-b last:border-b-0 bg-white odd:bg-white even:bg-gray-50">
          <TableBodyCell class="font-medium">
            {dayjs(row.date).format('MM-DD')}
          </TableBodyCell>
          {#each assetTypes as asset}
            {@const data = row[asset.name]}
            <TableBodyCell>
              <div class="space-y-1">
                <div class="font-semibold">{formatAmount(data.value)}</div>
                {#if data.change !== null && data.changePercent !== null}
                  <div class={getChangeColor(data.change)}>
                    <span class="text-sm">
                      {getChangeSign(data.change)}{formatAmount(Math.abs(data.change))}
                    </span>
                    <span class="text-xs ml-1">
                      ({getChangeSign(data.change)}{data.changePercent}%)
                    </span>
                  </div>
                {/if}
              </div>
            </TableBodyCell>
          {/each}
        </tr>
      {/each}
    </TableBody>
  </Table>
</Card>
