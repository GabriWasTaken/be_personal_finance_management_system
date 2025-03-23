// ESM
import Fastify from 'fastify'
import account from './routes/account.js'
import dbConnector from './db-connector.js'

/**
 * @type {import('fastify').FastifyInstance} Instance of Fastify
 */
const fastify = Fastify({
  logger: true
})

fastify.register(dbConnector)
fastify.register(account)

fastify.listen({ port: 3001 }, function (err, address) {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
  // Server is now listening on ${address}
})