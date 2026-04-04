'use strict';

/**
 * Embed text using Amazon Bedrock Cohere Embed V4.
 *
 * @param {string[]} texts - Array of texts to embed
 * @param {Object} config - RAG config from orchestration.yml
 * @param {string} config.bedrock_region
 * @param {string} config.bedrock_model
 * @param {string} [config.input_type] - 'search_document' for indexing, 'search_query' for querying
 * @returns {Promise<number[][]>} Array of embedding vectors
 */
async function embedTexts(texts, config) {
  const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

  const client = new BedrockRuntimeClient({ region: config.bedrock_region });

  const body = JSON.stringify({
    texts,
    input_type: config.input_type || 'search_document',
    embedding_types: ['float'],
  });

  const command = new InvokeModelCommand({
    modelId: config.bedrock_model,
    contentType: 'application/json',
    accept: 'application/json',
    body,
  });

  const response = await client.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.body));
  return result.embeddings.float;
}

module.exports = { embedTexts };
