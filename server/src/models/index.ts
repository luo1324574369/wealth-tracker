import { Sequelize } from 'sequelize'
import { getSqliteDbPath } from '../helper/constant'

// Use Sequelize to connect to SQLite database
export const sequelize = new Sequelize({
  dialect: 'sqlite',
  // Set SQLite database file
  storage: getSqliteDbPath(),
})
