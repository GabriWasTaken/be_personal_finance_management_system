// our-first-route.js

/**
 * Encapsulates the routes
 * @param {FastifyInstance} fastify  Encapsulated Fastify Instance
 * @param {Object} options plugin options, refer to https://fastify.dev/docs/latest/Reference/Plugins/#plugin-options
 */
async function routes (fastify, options) {
  fastify.get('/', async (request, reply) => {

    const client = await fastify.pg.connect()
    try {
      const { rows } = await client.query(
        'SELECT * FROM accounts',
      )
      // Note: avoid doing expensive computation here, this will block releasing the client
      return rows
    } 
    catch(err) {
      console.error(err)
    } 
    finally {
      // Release the client immediately after query resolves, or upon error
      client.release()
    }


    return { hello: 'world' }
  });

  const accountBodyJsonSchema = {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string' },
    },
  }

  const schema = {
    body: accountBodyJsonSchema,
  }

  fastify.post('/accounts', { schema }, async (request, reply) => {
    // we can use the `request.body` object to get the data sent by the client
    const { name } = request.body
    const result = await fastify.pg.query(
      'INSERT INTO accounts (name) VALUES ($1) RETURNING *',
      [name],
    )
    return result.rows
  })

  fastify.get('/accounts', (req, reply) => {
    fastify.pg.query(
      'SELECT * FROM accounts',
      function onResult (err, result) {
        reply.send(err || result.rows);
      }
    )
  })

}

export default routes;