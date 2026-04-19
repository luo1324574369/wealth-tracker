import { Assets } from './../models/assets'
import { Record } from './../models/records'
import { buildReorderUpdates, getNextSortOrder } from '../helper/assetsOrder'

export const create = async (request, reply) => {
  const params = request?.body
  try {
    const existingAssets = await Assets.findAll({
      attributes: ['sortOrder'],
      raw: true,
    })
    const options = {
      type: params.type,
      alias: params.alias || params.type,
      amount: params.amount,
      currency: params.currency,
      note: params.note,
      datetime: params.datetime,
      risk: params.risk,
      liquidity: params.liquidity,
      tags: params.tags || '',
      sortOrder: getNextSortOrder(existingAssets as Array<{ sortOrder?: number | null }>),
      updated: new Date(),
    }
    const assets = await Assets.create(options)
    await Record.create(assets.dataValues)
    return reply.send(assets)
  } catch (error: any) {
    return reply.code(400).send({
      statusCode: 400,
      message: error.message,
    })
  }
}

export const get = async (_, reply) => {
  try {
    const data = await Assets.findAll({
      order: [
        ['sortOrder', 'ASC'],
        ['created', 'ASC'],
        ['datetime', 'ASC'],
      ],
    })
    return reply.send(data)
  } catch (error: any) {
    return reply.code(400).send({
      statusCode: 400,
      message: error.message,
    })
  }
}

export const reorder = async (request, reply) => {
  const items = request?.body?.items

  if (!Array.isArray(items) || items.length === 0) {
    return reply.code(400).send({
      statusCode: 400,
      message: 'Invalid reorder payload.',
    })
  }

  const orderedTypes = items
    .map((item) => item?.type)
    .filter((type): type is string => typeof type === 'string' && Boolean(type))

  if (orderedTypes.length !== items.length || new Set(orderedTypes).size !== orderedTypes.length) {
    return reply.code(400).send({
      statusCode: 400,
      message: 'Invalid reorder payload.',
    })
  }

  const sequelize = Assets.sequelize

  if (!sequelize) {
    return reply.code(500).send({
      statusCode: 500,
      message: 'Database unavailable.',
    })
  }

  try {
    await sequelize.transaction(async (transaction) => {
      const updates = buildReorderUpdates(orderedTypes)

      for (const updateItem of updates) {
        const [updatedRows] = await Assets.update(
          { sortOrder: updateItem.sortOrder },
          {
            where: { type: updateItem.type },
            transaction,
          },
        )

        if (updatedRows !== 1) {
          throw new Error(`Asset not found: ${updateItem.type}`)
        }
      }
    })

    return reply.send({ result: true })
  } catch (error: any) {
    return reply.code(400).send({
      statusCode: 400,
      message: error.message,
    })
  }
}

export const update = async (request, reply) => {
  const params = request?.body
  const now = new Date()
  try {
    const options = {
      type: params.type,
      alias: params.alias,
      amount: params.amount,
      currency: params.currency,
      note: params.note,
      datetime: params.datetime,
      created: params.created,
      risk: params.risk,
      liquidity: params.liquidity,
      tags: params.tags || '',
      updated: now,
    }
    const data = await Assets.update(options, {
      where: { type: params.type },
    })
    await Record.create({
      ...options,
      created: now,
    })
    return reply.send(data)
  } catch (error: any) {
    return reply.code(400).send({
      statusCode: 400,
      message: error.message,
    })
  }
}

export const destroy = async (request, reply) => {
  const { type = '' } = request?.body
  try {
    await Assets.destroy({ where: { type } })
    await Record.destroy({ where: { type } })
    return reply.send({ result: true })
  } catch (error: any) {
    return reply.code(400).send({
      statusCode: 400,
      message: error.message,
    })
  }
}
