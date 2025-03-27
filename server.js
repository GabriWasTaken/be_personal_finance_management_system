// ESM
import Fastify from 'fastify'
import account from './routes/account.js'
import dbConnector from './db-connector.js'
import fastifyCors from '@fastify/cors'
import fjwt from '@fastify/jwt'
import buildGetJwks from 'get-jwks'

/**
 * @type {import('fastify').FastifyInstance} Instance of Fastify
*/

const fastify = Fastify({
  logger: true
})

/*
  * TODO:
  * introduce typescript
*/

const getJwks = buildGetJwks({ jwksPath: "/jwks" });

fastify.register(fjwt, {
  decode: { complete: true },
  secret: (request, token) => {
    return getJwks.getPublicKey({
      domain: process.env.JWT_ISSUER,
      alg: 'ES384',
      kid: 'LCPrW7v2KI9_mdQCLAdymkJvjDBV07Z_KUndcLPPlUE',
    })
  }
})

fastify.register(fastifyCors, { origin: process.env.FE_ORIGIN })
fastify.register(dbConnector)

fastify.addHook('preHandler', (request, reply, done) => {
  request.jwtVerify().then(() => {
    console.log("token verified")
  }).catch((err) => {
    reply.send(err)
  })

  done()
})

fastify.register(account)

fastify.listen({ port: 3001 }, function (err, address) {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
})