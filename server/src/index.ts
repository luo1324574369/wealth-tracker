import fs from 'fs/promises'
import path from 'path'
import Fastify, { FastifyInstance } from 'fastify'
import fastifyStatic from '@fastify/static'
// Fix Bug: [fetch is not defined](Ubuntu16 Cannot Upgrade Node to v18.*)
import 'isomorphic-fetch'
import { Sequelize } from 'sequelize'
import { applyRuntimeOptions, getRuntimeOptions, ServerRuntimeOptions } from './helper/runtime'

let fastify: FastifyInstance | null = null
let sequelize: Sequelize | null = null
let serverAddress = ''
let appPromise: Promise<FastifyInstance> | null = null

const ensureDatabaseDirectory = async (dbPath: string) => {
  await fs.mkdir(path.dirname(dbPath), { recursive: true })
}

const addTagsColumnToAssetsIfNotExists = async () => {
  if (!sequelize) {
    return
  }

  try {
    const [results] = await sequelize.query('PRAGMA table_info(assets)')
    const hasTagsColumn = results.some((row: any) => row.name === 'tags')

    if (!hasTagsColumn) {
      console.log('Adding tags column to assets table...')
      await sequelize.query("ALTER TABLE assets ADD COLUMN tags TEXT DEFAULT ''")
      console.log('✅ Tags column added successfully!')
    }
  } catch (err) {
    console.error('Error adding tags column:', err)
  }
}

const addTagsColumnToRecordIfNotExists = async () => {
  if (!sequelize) {
    return
  }

  try {
    const [results] = await sequelize.query('PRAGMA table_info(record)')
    const hasTagsColumn = results.some((row: any) => row.name === 'tags')

    if (!hasTagsColumn) {
      console.log('Adding tags column to record table...')
      await sequelize.query("ALTER TABLE record ADD COLUMN tags TEXT DEFAULT ''")
      console.log('✅ Tags column added to record table successfully!')
    }
  } catch (err) {
    console.error('Error adding tags column to record table:', err)
  }
}

const connectToSqlite = async () => {
  if (!sequelize) {
    throw new Error('Sequelize has not been initialized.')
  }

  try {
    await ensureDatabaseDirectory(getRuntimeOptions().dbPath)
    await sequelize.sync()
    await addTagsColumnToAssetsIfNotExists()
    await addTagsColumnToRecordIfNotExists()
    console.log('🎊 Database synced!')
  } catch (err) {
    console.error('Failed to sync database:', err)
    throw err
  }
}

const setupStaticFiles = (app: FastifyInstance, publicDir: string) => {
  app.register(fastifyStatic, {
    root: publicDir,
    prefix: '',
  })
}

const setupNotFoundHandler = (app: FastifyInstance, publicDir: string) => {
  app.setNotFoundHandler(async (request, reply) => {
    if (!request.url.includes('/api/')) {
      const indexHtmlContent = await fs.readFile(path.join(publicDir, 'index.html'), 'utf-8')
      reply.type('text/html').send(indexHtmlContent)
    } else {
      reply.code(404).send({ error: 'Oops , Page Not Found.' })
    }
  })
}

const loadServerModules = async () => {
  const [
    registerModule,
    routesModule,
    modelsModule,
  ] = await Promise.all([
    import('./register'),
    import('./routes'),
    import('./models'),
    import('./models/customCurrency'),
    import('./models/userSettings'),
    import('./models/assets'),
    import('./models/records'),
    import('./models/insights'),
    import('./models/password'),
    import('./models/session'),
  ])

  sequelize = modelsModule.sequelize

  return {
    registerPlugins: registerModule.default,
    routes: routesModule.default,
  }
}

export const createApp = async (options: ServerRuntimeOptions = {}) => {
  if (fastify) {
    return fastify
  }

  if (appPromise) {
    return appPromise
  }

  appPromise = (async () => {
    const runtimeOptions = applyRuntimeOptions(options)
    const app = Fastify({ logger: true })
    const { registerPlugins, routes } = await loadServerModules()

    await connectToSqlite()
    await registerPlugins(app)
    routes.forEach((route: any) => app.route(route))
    setupStaticFiles(app, runtimeOptions.publicDir)
    setupNotFoundHandler(app, runtimeOptions.publicDir)

    fastify = app
    return app
  })()

  try {
    return await appPromise
  } catch (error) {
    appPromise = null
    throw error
  }
}

export const startServer = async (options: ServerRuntimeOptions = {}) => {
  const app = await createApp(options)
  const runtimeOptions = getRuntimeOptions()

  if (!app.server.listening) {
    serverAddress = await app.listen({
      host: runtimeOptions.host,
      port: runtimeOptions.port,
    })
    app.log.info(`server listening on ${serverAddress}`)
  }

  return {
    address: serverAddress,
    app,
    options: runtimeOptions,
  }
}

export const stopServer = async () => {
  if (fastify) {
    await fastify.close()
  }

  if (sequelize) {
    await sequelize.close()
  }

  fastify = null
  sequelize = null
  serverAddress = ''
  appPromise = null
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
