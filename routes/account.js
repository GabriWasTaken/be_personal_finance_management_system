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

  fastify.get('/accounts', async (req, reply) => {
    let rowsNumber = 0;
    let result;

    const client = await fastify.pg.connect()
    const { rows } = await client.query('SELECT COUNT(*) AS total_rows FROM accounts');
    
    rowsNumber = rows[0].total_rows;

    result = await client.query(
      'SELECT * FROM accounts OFFSET $1 LIMIT $2', [Number(req.query.page) * Number(req.query.limit), Number(req.query.limit)],
    )
    
    client.release()
    return {rows:result.rows, rowCount: rowsNumber}
  })

  fastify.get('/dashboard', (req, reply) => {
    fastify.pg.query(
      'SELECT * FROM accounts',
      function onResult (err, result) {
        reply.send({result:"Dashboard", rowCount: 1});
      }
    )
  })

  fastify.get('/financials', async (req, reply) => {

    let rowsNumber = 0;
    let result;

    const client = await fastify.pg.connect()
    const { rows } = await client.query(
      'SELECT COUNT(*) AS total_rows FROM financials' + (req.query.id_account ? ' WHERE id_account=$1' : ''),
      req.query.id_account ? [req.query.id_account] : []
    )
    
    rowsNumber = rows[0].total_rows;

    if(!req.query.id_account){
      result =await client.query(
        'SELECT financials.*, accounts.name as account_name FROM financials JOIN accounts ON financials.id_account = accounts.id OFFSET $1 LIMIT $2', [Number(req.query.page) * Number(req.query.limit), Number(req.query.limit)],
      )
    } else {
      result = await client.query(
        'SELECT financials.*, accounts.name as account_name FROM financials JOIN accounts ON financials.id_account = accounts.id WHERE id_account=$1 OFFSET $2 LIMIT $3', [req.query.id_account, Number(req.query.page) * Number(req.query.limit), Number(req.query.limit)],
      )
    }

    client.release()
    return {rows:result.rows, rowCount: rowsNumber}
  })

}

export default routes;