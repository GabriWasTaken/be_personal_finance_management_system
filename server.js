// ESM
import Fastify from 'fastify'
import account from './routes/account.js'
import dbConnector from './db-connector.js'
import fastifyCors from '@fastify/cors'

/**
 * @type {import('fastify').FastifyInstance} Instance of Fastify
*/

const fastify = Fastify({
  logger: true
})

/*
  * TODO:
  * introduce typescript
  * check for JWT validation
  * handle pagination
*/

fastify.register(fastifyCors, { origin: process.env.FE_ORIGIN })
fastify.register(dbConnector)

fastify.addHook('preHandler', (request, reply, done) => {
  console.log("prehandler")
  // request.headers check for jwt token and valite through logto
  done()
})

fastify.register(account)

fastify.listen({ port: 3001 }, function (err, address) {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
})