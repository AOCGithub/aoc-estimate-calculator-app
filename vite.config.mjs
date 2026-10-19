import { createRequire } from 'node:module';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const require = createRequire(import.meta.url);
const journeyContract = require('./public/journey-contract.js');
const journeyCalculation = require('./public/journey-calculation.js');

function sendJson(response, status, data) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json;charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(data));
}

function readBody(request, limit = 50000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('request_too_large'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

function localAnalysisApi({ enabled, apiKey, model }) {
  return {
    name: 'aoc-local-analysis-api',
    configureServer(server) {
      server.middlewares.use('/api/journey/analyze', async (request, response, next) => {
        if (request.method !== 'POST') {
          next();
          return;
        }
        if (!enabled || !apiKey) {
          sendJson(response, 200, {
            localFallback: true,
            mode: 'local',
          });
          return;
        }

        let body;
        try {
          body = JSON.parse(await readBody(request));
        } catch (error) {
          sendJson(response, error.message === 'request_too_large' ? 413 : 400, {
            error: error.message === 'request_too_large'
              ? 'Please shorten the description.'
              : 'Could not read the request.',
          });
          return;
        }

        if (
          typeof body.area !== 'string'
          || typeof body.text !== 'string'
          || body.text.trim().length < 30
          || body.text.length > 18000
        ) {
          sendJson(response, 400, {
            error: 'Choose an area and describe the process in 30-18,000 characters.',
          });
          return;
        }

        try {
          const provider = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              store: false,
              instructions: journeyContract.prompt(body.area),
              input: body.text,
              max_output_tokens: 9000,
              text: {
                format: {
                  type: 'json_schema',
                  name: 'aoc_journey_scope',
                  strict: true,
                  schema: journeyContract.schema(body.area),
                },
              },
            }),
            signal: AbortSignal.timeout(55000),
          });
          const payload = await provider.json();
          if (!provider.ok || payload.status !== 'completed') {
            sendJson(response, provider.status === 429 ? 429 : 502, {
              error: 'AI could not complete this request. Your text is preserved; use editable fields or retry.',
            });
            return;
          }
          const output = (payload.output || [])
            .flatMap((item) => item.content || [])
            .filter((item) => item.type === 'output_text')
            .map((item) => item.text)
            .join('');
          sendJson(response, 200, {
            analysis: journeyContract.validate(JSON.parse(output), body.text, body.area),
            model: payload.model,
          });
        } catch {
          sendJson(response, 502, {
            error: 'Analysis could not be validated or timed out. Your description is preserved; continue with editable fields.',
          });
        }
      });
    },
  };
}

function localCalculationApi() {
  return {
    name: 'aoc-local-calculation-api',
    configureServer(server) {
      server.middlewares.use('/api/journey/calculate', async (request, response, next) => {
        if (request.method !== 'POST') {
          next();
          return;
        }
        if (!request.headers['content-type']?.startsWith('application/json')) {
          sendJson(response, 415, { error: 'JSON required.' });
          return;
        }
        try {
          const body = JSON.parse(await readBody(request, 100000));
          const calculation = journeyCalculation.calculate(body);
          sendJson(response, 200, { ...calculation, source: 'server' });
        } catch (error) {
          sendJson(response, error.message === 'request_too_large' ? 413 : 400, {
            error: error.message === 'request_too_large'
              ? 'The calculation request is too large.'
              : error.message,
          });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '');
  const apiKey = process.env.OPENAI_API_KEY || environment.OPENAI_API_KEY;
  const model = process.env.AOC_INTAKE_MODEL || environment.AOC_INTAKE_MODEL || 'gpt-5.4';
  const enabled = String(
    process.env.AOC_AI_ORGANIZER_ENABLED || environment.AOC_AI_ORGANIZER_ENABLED || 'false',
  ).toLowerCase() === 'true';

  return {
    plugins: [react(), localCalculationApi(), localAnalysisApi({ enabled, apiKey, model })],
    build: {
      outDir: 'dist/client',
      emptyOutDir: true,
    },
  };
});
