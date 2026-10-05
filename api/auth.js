/**
 * Vercel Serverless Function Proxy for Mubarokah Authentication & Backend API
 * Eliminates browser CORS, 302 redirect blocking, and multi-account Google cookie issues.
 * Supports both POST (auth/mutations) and GET (kabar/banners with edge caching).
 */

const https = require('https');

const DEFAULT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz4To49WTzqN2r3M8M3H4_YyAbeMjfTWRgxLrz6-YXuf7oFAVZZ6okh14LTIkZdMj9qGg/exec";

function requestGoogleAppsScript(targetUrl, method, payload) {
    return new Promise((resolve, reject) => {
        function execute(currentUrl, currentMethod, currentPayload, redirectsRemaining) {
            if (redirectsRemaining <= 0) {
                return reject(new Error('Terlalu banyak redirect dari Google Apps Script'));
            }

            const parsedUrl = new URL(currentUrl);
            const isPost = currentMethod === 'POST';
            let bodyData = null;
            if (isPost && currentPayload) {
                bodyData = typeof currentPayload === 'string' ? currentPayload : JSON.stringify(currentPayload);
            }

            const reqOptions = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || 443,
                path: parsedUrl.pathname + parsedUrl.search,
                method: currentMethod,
                agent: new https.Agent({ keepAlive: false }),
                headers: {
                    'Accept': 'application/json, text/plain, */*'
                }
            };

            if (isPost && bodyData) {
                reqOptions.headers['Content-Type'] = 'text/plain;charset=utf-8';
                reqOptions.headers['Content-Length'] = Buffer.byteLength(bodyData);
            }

            const req = https.request(reqOptions, (res) => {
                // Saat Google Apps Script mengembalikan 302/303 redirect:
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    // Sesuai standar Apps Script, ikuti redirect dengan GET ke URL target (macros/echo)
                    return execute(res.headers.location, 'GET', null, redirectsRemaining - 1);
                }

                let responseData = '';
                res.on('data', chunk => responseData += chunk);
                res.on('end', () => {
                    resolve({ status: res.statusCode, text: responseData });
                });
            });

            req.on('error', reject);

            if (isPost && bodyData) {
                req.write(bodyData);
            }
            req.end();
        }

        execute(targetUrl, method, payload, 5);
    });
}

module.exports = async function handler(req, res) {
    // CORS headers for maximum interoperability
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const scriptUrl = process.env.MUBAROKAH_APPS_SCRIPT_URL || DEFAULT_SCRIPT_URL;

    try {
        let result;

        if (req.method === 'GET') {
            const action = req.query && req.query.action;
            // Add edge caching for public read data (getKabar, getBanner, getGaleri, etc.)
            if (action === 'getKabar' || action === 'getBanner' || action === 'getGaleri' || action === 'getUnitKegiatan' || action === 'getNotifikasi') {
                res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
            }
            const getUrl = new URL(scriptUrl);
            if (req.query) {
                Object.entries(req.query).forEach(([k, v]) => {
                    if (v !== undefined && v !== null) getUrl.searchParams.set(k, String(v));
                });
            }
            result = await requestGoogleAppsScript(getUrl.toString(), 'GET', null);
        } else {
            let payload = req.body;
            if (typeof payload === 'string') {
                try {
                    payload = JSON.parse(payload);
                } catch (e) {
                    // keep as string
                }
            } else if (!payload && req.query) {
                payload = { ...req.query };
            }

            if (!payload) {
                payload = {};
            }

            result = await requestGoogleAppsScript(scriptUrl, 'POST', payload);
        }

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        try {
            const json = JSON.parse(result.text);
            return res.status(200).json(json);
        } catch (parseErr) {
            return res.status(result.status || 200).send(result.text);
        }
    } catch (error) {
        console.error('[API/AUTH Proxy Error]:', error);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.status(500).json({
            success: false,
            message: 'Gagal terhubung ke server autentikasi melalui server proxy.',
            error: error.message
        });
    }
};

module.exports.config = {
    maxDuration: 60
};

