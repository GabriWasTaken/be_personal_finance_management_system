// ESM
import fastifyPlugin from 'fastify-plugin'
import fastifyPostgres from '@fastify/postgres'

/**
 * @param {FastifyInstance} fastify
 * @param {Object} options
 */
async function dbConnector (fastify, options) {
  fastify.register(fastifyPostgres, {
    connectionString: `postgres://${process.env.DB_USERNAME}:${process.env.DB_PSW}@localhost:5432/finance`,
  })
}

// Wrapping a plugin function with fastify-plugin exposes the decorators
// and hooks, declared inside the plugin to the parent scope.
export default fastifyPlugin(dbConnector)
