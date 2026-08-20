import express from 'express';
import { getFromCache, setInCache } from '../db.js';

const router = express.Router();

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';
const CACHE_TTL_MS = 15 * 60 * 1000;

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 400; // 400ms delay between successive calls

async function waitRateLimit() {
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < MIN_REQUEST_INTERVAL_MS) {
    const delay = MIN_REQUEST_INTERVAL_MS - timeSinceLast;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  lastRequestTime = Date.now();
}

async function fetchJikanWithCache(endpoint, params = {}) {
  const query = new URLSearchParams(params).toString();
  const cleanEndpoint = endpoint.replace(/^\//, '');
  const url = `${JIKAN_BASE_URL}/${cleanEndpoint}${query ? '?' + query : ''}`;
  const cacheKey = `jikan:${url}`;

  const cached = getFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  await waitRateLimit();

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'SpaceFlix/1.0'
    }
  });

  if (!response.ok) {
    if (response.status === 429) {
      await new Promise(res => setTimeout(res, 1200));
      const retryResponse = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'SpaceFlix/1.0' }
      });
      if (retryResponse.ok) {
        const retryData = await retryResponse.json();
        setInCache(cacheKey, retryData, CACHE_TTL_MS);
        return retryData;
      }
    }
    throw new Error(`Jikan API Error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  setInCache(cacheKey, data, CACHE_TTL_MS);
  return data;
}

// 1. Search Anime
router.get('/anime', async (req, res, next) => {
  try {
    const { q, page = 1, limit = 24, order_by, sort, sfw = true, type, status } = req.query;
    const params = { page, limit, sfw };
    if (q) params.q = q;
    if (order_by) params.order_by = order_by;
    if (sort) params.sort = sort;
    if (type) params.type = type;
    if (status) params.status = status;

    const data = await fetchJikanWithCache('/anime', params);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// 2. Anime Details by MAL ID
router.get('/anime/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { full } = req.query;
    const endpoint = full === 'true' ? `/anime/${id}/full` : `/anime/${id}`;
    const data = await fetchJikanWithCache(endpoint);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// 3. Top Animes
router.get('/top/anime', async (req, res, next) => {
  try {
    const { page = 1, limit = 24, type, filter } = req.query;
    const params = { page, limit };
    if (type) params.type = type;
    if (filter) params.filter = filter;

    const data = await fetchJikanWithCache('/top/anime', params);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

export default router;
