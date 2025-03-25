// our-first-route.js

/**
 * Encapsulates the routes
 * @param {FastifyInstance} fastify  Encapsulated Fastify Instance
 * @param {Object} options plugin options, refer to https://fastify.dev/docs/latest/Reference/Plugins/#plugin-options
 */
async function routes (fastify, options) {

  const accountBodyJsonSchema = {
    type: 'string',
    required: ['name'],
  }

  const schema = {
    body: accountBodyJsonSchema,
  }

  fastify.post('/accounts', { schema }, async (request, reply) => {
    // we can use the `request.body` object to get the data sent by the client
    const body = JSON.parse(request.body);
    const { name } = body;
    const result = await fastify.pg.query(
      'INSERT INTO accounts (name) VALUES ($1) RETURNING *',
      [name],
    )
    return result
  })

  fastify.get('/accounts', (req, reply) => {
    fastify.pg.query(
      'SELECT * FROM accounts',
      function onResult (err, result) {
        reply.send(err || {rows:result.rows, rowCount: result.rowCount});
      }
    )
  })

  fastify.get('/dashboard', (req, reply) => {
    fastify.pg.query(
      'SELECT * FROM accounts',
      function onResult (err, result) {
        reply.send({result:"Dashboard", rowCount: 1});
      }
    )
  })

  fastify.get('/financials', (req, reply) => {
    if(!req.query.id_account){
      fastify.pg.query(
        'SELECT financials.*, accounts.name as account_name FROM financials JOIN accounts ON financials.id_account = accounts.id',
        function onResult (err, result) {
          reply.send(err || {rows:result.rows, rowCount: result.rowCount});
        }
      )
    } else {
      fastify.pg.query(
        'SELECT financials.*, accounts.name as account_name FROM financials JOIN accounts ON financials.id_account = accounts.id WHERE id_account=$1', [req.query.id_account],
        function onResult (err, result) {
          reply.send(err || {rows:result.rows, rowCount: result.rowCount});
        }
      )
    }
  })

}

export default routes;