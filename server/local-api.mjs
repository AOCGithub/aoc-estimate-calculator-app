import { Readable } from 'node:stream';
import {
  handleAccessStatus, handleAccessVerification, handleAccessLogout, handleAccessRedemption,
  handleJourneyCalculation, handleJourneyAnalysis, json,
} from './api-handlers.mjs';

const routes = {
  '/api/access/status': handleAccessStatus,
  '/api/access/verify': handleAccessVerification,
  '/api/access/logout': handleAccessLogout,
  '/api/access/redeem': handleAccessRedemption,
  '/api/journey/calculate': handleJourneyCalculation,
  '/api/journey/analyze': handleJourneyAnalysis,
};

// Adapt Vite's Node request to the same handlers used in Vercel. Business rules,
// validation, sessions and provider calls live there, not in the build config.
export function localApi(environment) {
  return {
    name: 'aoc-local-api',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const handler = routes[request.url.split('?')[0]];
        if (!handler) return next();
        let result;
        try {
          const webRequest = new Request('http://' + request.headers.host + request.url, {
            method: request.method,
            headers: request.headers,
            ...(!['GET', 'HEAD'].includes(request.method)
              ? { body: Readable.toWeb(request), duplex: 'half' } : {}),
          });
          result = await handler(webRequest, environment);
        } catch {
          result = json({ error: 'Could not read the request.' }, 400);
        }
        response.statusCode = result.status;
        for (const [name, value] of result.headers) response.setHeader(name, value);
        response.end(await result.text());
      });
    },
  };
}
