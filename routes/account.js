/**
 * Encapsulates the routes
 * @param {FastifyInstance} fastify  Encapsulated Fastify Instance
 * @param {Object} options plugin options, refer to https://fastify.dev/docs/latest/Reference/Plugins/#plugin-options
 */
async function routes (fastify, options) {

  fastify.post('/accounts', { }, async (request, reply) => {
    const { name } = request.body;
    const result = await fastify.pg.query(
      'INSERT INTO accounts (name, user_id) VALUES ($1, $2) RETURNING *',
      [name, request.user.id],
    )
    return result
  })

  fastify.get('/accounts', async (req, reply) => {
    let rowsNumber = 0;
    let result;

    const client = await fastify.pg.connect()
    const { rows } = await client.query('SELECT COUNT(*) AS total_rows FROM accounts WHERE user_id=$1', [req.user.id]);
    
    rowsNumber = rows[0].total_rows;

    result = await client.query(
      'SELECT * FROM accounts WHERE user_id=$1 OFFSET $2 LIMIT $3', [req.user.id, Number(req.query.page) * Number(req.query.limit), Number(req.query.limit)],
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
      'SELECT COUNT(*) AS total_rows FROM financials WHERE user_id=$1' + (req.query.id_account ? ' AND id_account=$2' : ''),
      req.query.id_account ? [req.user.id, req.query.id_account] : [req.user.id]
    )
    
    rowsNumber = rows[0].total_rows;

    if(!req.query.id_account){
      result =await client.query(
        'SELECT financials.*, accounts.name as account_name FROM financials JOIN accounts ON financials.id_account = accounts.id WHERE financials.user_id=$1 OFFSET $2 LIMIT $3', [req.user.id, Number(req.query.page) * Number(req.query.limit), Number(req.query.limit)],
      )
    } else {
      result = await client.query(
        'SELECT financials.*, accounts.name as account_name FROM financials JOIN accounts ON financials.id_account = accounts.id WHERE financials.user_id=$1 AND id_account=$2 OFFSET $3 LIMIT $4', [req.user.id, req.query.id_account, Number(req.query.page) * Number(req.query.limit), Number(req.query.limit)],
      )
    }

    client.release()
    return {rows:result.rows, rowCount: rowsNumber}
  })


  fastify.post('/financials', async (req, reply) => {
    const { amount, name, id_account, id_category, id_subcategory, transactionDate} = req.body;
    const result = await fastify.pg.query(
      'INSERT INTO financials (name, amount, id_account, user_id, category_id, subcategory_id, transaction_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [name, amount, id_account, req.user.id, id_category, id_subcategory, transactionDate],
    )
    return result
  })


  fastify.get('/categories', async (req, reply) => {
    let rowsNumber = 0;
    let result;

    const client = await fastify.pg.connect()
    const { rows } = await client.query('SELECT COUNT(*) AS total_rows FROM categories WHERE user_id=$1', [req.user.id]);
    
    rowsNumber = rows[0].total_rows;

    result = await client.query(
      'SELECT * FROM categories WHERE user_id=$1 OFFSET $2 LIMIT $3', [req.user.id, Number(req.query.page) * Number(req.query.limit), Number(req.query.limit)],
    )
    
    client.release()
    return {rows:result.rows, rowCount: rowsNumber}
  })

  fastify.post('/categories', async (req, reply) => {
    const { category } = req.body;
    const result = await fastify.pg.query(
      'INSERT INTO categories (name, user_id) VALUES ($1, $2) RETURNING *',
      [category, req.user.id],
    )
    return result
  })

  fastify.get('/subcategories', async (req, reply) => {
    let rowsNumber = 0;
    let result;

    const client = await fastify.pg.connect()
    const { rows } = await client.query('SELECT COUNT(*) AS total_rows FROM subcategories WHERE user_id=$1 AND category_id=$2', [req.user.id, req.query.id_category]);
    
    rowsNumber = rows[0].total_rows;

    result = await client.query(
      'SELECT * FROM subcategories WHERE user_id=$1 AND category_id=$2 OFFSET $3 LIMIT $4', [req.user.id, req.query.id_category, Number(req.query.page) * Number(req.query.limit), Number(req.query.limit)],
    )
    
    client.release()
    return {rows:result.rows, rowCount: rowsNumber}
  })

  fastify.post('/subcategories', async (req, reply) => {
    const { subcategory, categoryId } = req.body;
    const result = await fastify.pg.query(
      'INSERT INTO subcategories (name, category_id, user_id) VALUES ($1, $2, $3) RETURNING *',
      [subcategory, categoryId, req.user.id],
    )
    return result
  })

}

export default routes;