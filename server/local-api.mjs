import { Readable } from 'node:stream';
import { handleClientProfile, handleProfileCleanup } from './profiles/client-profiles.mjs';
import {
  handleAccessStatus, handleAccessVerification, handleAccessLogout, handleAccessRedemption,
  handleJourneyCalculation, handleJourneyAnalysis, handleLiveVoice, handleDescriptionCorrection, json,
} from './api-handlers.mjs';

const routes = {
  '/api/access/status': handleAccessStatus,
  '/api/access/verify': handleAccessVerification,
  '/api/access/logout': handleAccessLogout,
  '/api/access/redeem': handleAccessRedemption,
  '/api/journey/calculate': handleJourneyCalculation,
  '/api/journey/analyze': handleJourneyAnalysis,
  '/api/voice/session': handleLiveVoice,
  '/api/journey/correct': handleDescriptionCorrection,
  '/api/client-profile': handleClientProfile,
  '/api/client-profile/status': handleClientProfile,
  '/api/client-profile/cleanup': handleProfileCleanup,
};

// Adapt Vite's Node request to the same handlers used in Vercel. Business rules,
// validation, sessions and provider calls live there, not in the build config.
export function localApi(environment) {
  let profileStore;
  return {
    name: 'aoc-local-api',
    configureServer(server) {
      server.httpServer?.once('close', () => { profileStore?.then(store => store.close()); });
      server.middlewares.use(async (request, response, next) => {
        const pathname = request.url.split('?')[0];
        let handler = routes[pathname];
        if (!environment.VERCEL && environment.AOC_LOCAL_CLIENT_PROFILES_ENABLED === 'true' && ['/api/client-profile', '/api/client-profile/status'].includes(pathname)) {
          handler = async webRequest => {
            const moduleUrl = new URL('./profiles/local-client-profiles.mjs', import.meta.url).href;
            profileStore ||= import(moduleUrl).then(module => module.createLocalClientProfiles(undefined, { environment }));
            return (await profileStore).handle(webRequest);
          };
        }
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
