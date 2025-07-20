/**
 * Encapsulates the routes
 * @param {FastifyInstance} fastify  Encapsulated Fastify Instance
 * @param {Object} options plugin options, refer to https://fastify.dev/docs/latest/Reference/Plugins/#plugin-options
 */

import fs from 'fs'; // Aggiungi questa riga all'inizio del file

async function routes(fastify, options) {

  fastify.post('/accounts', {}, async (request, reply) => {
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
      `SELECT a.name, a.id, 
        COALESCE(
          SUM(
            CASE
              WHEN f.type = 'income' THEN f.amount
              WHEN f.type = 'expense' THEN -f.amount
              ELSE 0
            END
          ),0
        ) AS net_total
      FROM accounts AS a
      LEFT JOIN financials AS f ON a.id = f.id_account
      WHERE a.user_id = $1
      ${req.query.search ? 'AND a.name ILIKE \'%\' || $4 || \'%\'' : ''}
      GROUP BY a.id, a.name
      OFFSET $2 LIMIT $3;`, req.query.search ? [req.user.id, Number(req.query.page) * Number(req.query.limit), Number(req.query.limit), req.query.search] : [req.user.id, Number(req.query.page) * Number(req.query.limit), Number(req.query.limit)],
    )

    client.release()
    return { rows: result.rows, rowCount: rowsNumber }
  })

  fastify.get('/dashboard', async (req, reply) => {
    const client = await fastify.pg.connect()
    const allTimeResults = await client.query(
      `SELECT
       SUM(CASE 
               WHEN financials.type = 'income' THEN financials.amount
               ELSE 0
           END) AS total_income,
       SUM(CASE 
               WHEN financials.type = 'expense' THEN financials.amount
               ELSE 0
           END) AS total_expense
      FROM financials 
      WHERE financials.user_id=$1`,
      [req.user.id],
    )

    const today = new Date();
    const year = today.getFullYear();

    const prevYearResults = await client.query(
      `SELECT
      SUM(CASE 
            WHEN financials.type = 'income' THEN financials.amount
            ELSE 0
            END) AS total_income,
      SUM(CASE 
            WHEN financials.type = 'expense' THEN financials.amount
            ELSE 0
            END) AS total_expense
      FROM financials 
      WHERE financials.user_id = $1
      AND financials.transaction_date >= '${year - 1}-01-01'
      AND financials.transaction_date < '${year}-01-01';`,
      [req.user.id],
    );

    const YTDResults = await client.query(
      `SELECT
      SUM(CASE 
            WHEN financials.type = 'income' THEN financials.amount
            ELSE 0
            END) AS total_income,
      SUM(CASE 
            WHEN financials.type = 'expense' THEN financials.amount
            ELSE 0
            END) AS total_expense
      FROM financials 
      WHERE financials.user_id = $1
      AND financials.transaction_date >= '${year}-01-01'
      AND financials.transaction_date < CURRENT_DATE;`,
      [req.user.id],
    );

    const expensesByCategory = await client.query(
      `SELECT
      financials.category_id, categories.name as category_name,
      SUM(CASE 
            WHEN financials.type = 'expense' THEN financials.amount
            ELSE 0
            END) AS total_expense
      FROM financials
      JOIN categories ON financials.category_id = categories.id
      WHERE financials.user_id = $1
      GROUP BY financials.category_id, categories.name
      HAVING SUM(CASE 
             WHEN financials.type = 'expense' THEN financials.amount
             ELSE 0
           END) > 0
      ORDER BY total_expense DESC`,
      [req.user.id],
    )

    client.release();

    return {
      expensesByCategory: expensesByCategory.rows,
      allTime: {
        total_expense: allTimeResults.rows[0].total_expense,
        total_income: allTimeResults.rows[0].total_income
      },
      prevYear: {
        total_expense: prevYearResults.rows[0].total_expense,
        total_income: prevYearResults.rows[0].total_income
      },
      YTD: {
        total_expense: YTDResults.rows[0].total_expense,
        total_income: YTDResults.rows[0].total_income
      }
    }
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

    const sortKey = req.query?.sort_key || 'transaction_date';
    const sortDirection = req.query.sort_direction?.toUpperCase() || 'DESC';

    if (!req.query.id_account) {
      result = await client.query(
        `SELECT financials.*, accounts.name as account_name, categories.name as category_name, subcategories.name as subcategory_name
        FROM financials 
        JOIN accounts ON financials.id_account = accounts.id 
        JOIN categories ON financials.category_id = categories.id 
        LEFT JOIN subcategories ON financials.subcategory_id = subcategories.id 
        WHERE financials.user_id=$1 
        ORDER BY ${sortKey} ${sortDirection}
        OFFSET $2 LIMIT $3`,
        [req.user.id, Number(req.query.page) * Number(req.query.limit), Number(req.query.limit)],
      )
    } else {
      result = await client.query(
        `SELECT financials.*, accounts.name as account_name, categories.name as category_name, subcategories.name as subcategory_name
        FROM financials 
        JOIN accounts ON financials.id_account = accounts.id
        JOIN categories ON financials.category_id = categories.id
        LEFT JOIN subcategories ON financials.subcategory_id = subcategories.id 
        WHERE financials.user_id=$1 AND id_account=$2
        ORDER BY ${sortKey} ${sortDirection}
        OFFSET $3 LIMIT $4`,
        [req.user.id, req.query.id_account, Number(req.query.page) * Number(req.query.limit), Number(req.query.limit)],
      )
    }

    client.release()
    return { rows: result.rows, rowCount: rowsNumber }
  })


  fastify.post('/financials', async (req, reply) => {
    const { amount, name, id_account, id_category, id_subcategory, transactionDate, type, id_account_to } = req.body;
    let result;
    if (type !== "transfer") {
      result = await fastify.pg.query(
        'INSERT INTO financials (name, amount, id_account, user_id, category_id, subcategory_id, transaction_date, type, is_transfer) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
        [name, amount, id_account, req.user.id, id_category, id_subcategory, transactionDate, type, false],
      )
    } else {
      await fastify.pg.query(
        'INSERT INTO financials (name, amount, id_account, user_id, category_id, subcategory_id, transaction_date, type, is_transfer) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
        [name, amount, id_account, req.user.id, id_category, id_subcategory, transactionDate, "expense", true],
      )
      result = await fastify.pg.query(
        'INSERT INTO financials (name, amount, id_account, user_id, category_id, subcategory_id, transaction_date, type, is_transfer) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
        [name, amount, id_account_to, req.user.id, id_category, id_subcategory, transactionDate, "income", true],
      )
    }
    return result
  })

  fastify.delete('/financials', async (req, reply) => {
    console.log("delete", req.id)
    const result = await fastify.pg.query(
      'DELETE FROM financials WHERE id=$1',
      [Number(req.query.id)],
    )
    return result
  })

  fastify.delete('/accounts', async (req, reply) => {
    console.log("delete", req.id)
    const result = await fastify.pg.query(
      'DELETE FROM accounts WHERE id=$1',
      [Number(req.query.id)],
    )
    return result
  })

  fastify.delete('/categories', async (req, reply) => {
    console.log("delete", req.id);
    try {
      await fastify.pg.query(
        'DELETE FROM subcategories WHERE category_id=$1',
        [Number(req.query.id)],
      );
  
      const result = await fastify.pg.query(
        'DELETE FROM categories WHERE id=$1',
        [Number(req.query.id)],
      )
      return result
    } catch (e) {
      if (e.code === '23503') {
        throw new Error("Please remove all financials using this category before deleting it");
      } else {
        throw new Error(e.detail);
      }
    }

  })


  fastify.delete('/subcategories', async (req, reply) => {
    console.log("delete", req.id);
    try {
      const result = await fastify.pg.query(
        'DELETE FROM subcategories WHERE id=$1',
        [Number(req.query.id)],
      );
      return result;
    } catch (e) {
      if (e.code === '23503') {
        throw new Error("Please remove all financials using this subcategory before deleting it");
      } else {
        throw new Error(e.detail);
      }
    }
  })


  fastify.get('/categories', async (req, reply) => {
    let rowsNumber = 0;
    let result;

    const client = await fastify.pg.connect()
    const { rows } = await client.query('SELECT COUNT(*) AS total_rows FROM categories WHERE user_id=$1', [req.user.id]);

    rowsNumber = rows[0].total_rows;

    result = await client.query(
      `SELECT * FROM categories WHERE user_id=$1 ${req.query.search ? 'AND name ILIKE \'%\' || $4 || \'%\'' : ''} OFFSET $2 LIMIT $3`, req.query.search ? [req.user.id, Number(req.query.page) * Number(req.query.limit), Number(req.query.limit), req.query.search] : [req.user.id, Number(req.query.page) * Number(req.query.limit), Number(req.query.limit)],
    )

    client.release()
    return { rows: result.rows, rowCount: rowsNumber }
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
      `SELECT * FROM subcategories WHERE user_id=$1 AND category_id=$2 ${req.query.search ? 'AND name ILIKE \'%\' || $5 || \'%\'' : ''} OFFSET $3 LIMIT $4`, req.query.search ? [req.user.id, req.query.id_category, Number(req.query.page) * Number(req.query.limit), Number(req.query.limit), req.query.search] : [req.user.id, req.query.id_category, Number(req.query.page) * Number(req.query.limit), Number(req.query.limit)],
    )

    client.release()
    return { rows: result.rows, rowCount: rowsNumber }
  })

  fastify.post('/subcategories', async (req, reply) => {
    const { subcategory, categoryId } = req.body;
    const result = await fastify.pg.query(
      'INSERT INTO subcategories (name, category_id, user_id) VALUES ($1, $2, $3) RETURNING *',
      [subcategory, categoryId, req.user.id],
    )
    return result
  })

  fastify.get('/export', async (req, reply) => {
    let result;

    const client = await fastify.pg.connect()

    const sortKey = 'transaction_date';
    const sortDirection = 'DESC';

    result = await client.query(
      `SELECT financials.*, accounts.name as account_name, categories.name as category_name, subcategories.name as subcategory_name
      FROM financials 
      JOIN accounts ON financials.id_account = accounts.id 
      JOIN categories ON financials.category_id = categories.id 
      LEFT JOIN subcategories ON financials.subcategory_id = subcategories.id 
      WHERE financials.user_id=$1 
      ORDER BY ${sortKey} ${sortDirection}`,
      [req.user.id],
    )

    const csvContent = result.rows.map(row => Object.values(row).join(',')).join('\n');
    const csvHeaders = Object.keys(result.rows[0]).join(',');
    const fullCsv = csvHeaders + '\n' + csvContent;

    console.log("\n csvContent: ", csvContent)
    console.log("\n csvHeaders: ", csvHeaders)
    console.log("\n fullCsv: ", fullCsv)

    client.release();

    fs.writeFile('./export.csv', fullCsv, 'utf8', function (err) {
      if (err) {
        console.log('Si è verificato un errore - file non salvato o corrotto.: ', err);
        reply.code(500).send({ error: 'Errore durante il salvataggio del file.' });
      } else {
        console.log('File CSV salvato con successo!');
        reply.send({ message: 'Esportazione CSV completata con successo.' });
      }
    });

  })

}

export default routes;