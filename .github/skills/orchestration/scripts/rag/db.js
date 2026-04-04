'use strict';

function createClient(ragConfig) {
  const { Client } = require('pg');
  return new Client({
    host: ragConfig.db_host,
    port: ragConfig.db_port,
    database: ragConfig.db_name,
    user: ragConfig.db_user,
    password: ragConfig.db_password,
  });
}

async function insertContextChunks(client, rows) {
  const query = `
    INSERT INTO context_chunks (project_name, phase, doc_path, section_title, content, doc_type, embedding)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `;
  for (const row of rows) {
    await client.query(query, [
      row.project_name,
      row.phase,
      row.doc_path,
      row.section_title,
      row.content,
      row.doc_type,
      JSON.stringify(row.embedding),
    ]);
  }
}

async function insertKnowledgeChunks(client, rows) {
  const query = `
    INSERT INTO project_knowledge (project_name, category, title, content, source_doc, embedding)
    VALUES ($1, $2, $3, $4, $5, $6)
  `;
  for (const row of rows) {
    await client.query(query, [
      row.project_name,
      row.category,
      row.title,
      row.content,
      row.source_doc,
      JSON.stringify(row.embedding),
    ]);
  }
}

async function queryContext(client, queryEmbedding, filters) {
  const params = [JSON.stringify(queryEmbedding), filters.project_name];
  let where = 'WHERE project_name = $2';
  let paramIndex = 3;

  if (filters.doc_types && filters.doc_types.length > 0) {
    where += ` AND doc_type = ANY($${paramIndex})`;
    params.push(filters.doc_types);
    paramIndex++;
  }
  if (filters.phase != null) {
    where += ` AND phase = $${paramIndex}`;
    params.push(filters.phase);
    paramIndex++;
  }

  const limit = filters.limit || 5;
  params.push(limit);

  const sql = `
    SELECT source_doc, section_title, content,
           1 - (embedding <=> $1::vector) AS similarity
    FROM context_chunks
    ${where}
    ORDER BY embedding <=> $1::vector
    LIMIT $${paramIndex}
  `;

  const result = await client.query(sql, params);
  return result.rows;
}

async function queryKnowledge(client, queryEmbedding, filters) {
  const params = [JSON.stringify(queryEmbedding)];
  let where = '';
  let paramIndex = 2;

  if (filters.category) {
    where = `WHERE category = $${paramIndex}`;
    params.push(filters.category);
    paramIndex++;
  }

  const limit = filters.limit || 10;
  params.push(limit);

  const sql = `
    SELECT project_name, category, title, content, source_doc,
           1 - (embedding <=> $1::vector) AS similarity
    FROM project_knowledge
    ${where}
    ORDER BY embedding <=> $1::vector
    LIMIT $${paramIndex}
  `;

  const result = await client.query(sql, params);
  return result.rows;
}

module.exports = {
  createClient,
  insertContextChunks,
  insertKnowledgeChunks,
  queryContext,
  queryKnowledge,
};
