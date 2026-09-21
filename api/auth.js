/**
 * Vercel Serverless Function Proxy for Mubarokah Authentication & Backend API
 * Eliminates browser CORS, 302 redirect blocking, and multi-account Google cookie issues.
 * Supports both POST (auth/mutations) and GET (kabar/banners with edge caching).
 */

const DEFAULT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwhaT3ODh9d95YkEUOM5IwKYMcnOQWe63nCXzJRdEpWV414N62jscxO1VeT7vvetZzFlQ/exec";

async function forwardToGoogleAppsScript(scriptUrl, bodyPayload) {
    const res = await fetch(scriptUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain;charset=utf-8'
        },
        body: typeof bodyPayload === 'string' ? bodyPayload : JSON.stringify(bodyPayload),
        redirect: 'manual'
    });

    if (res.status >= 300 && res.status < 400) {
        const redirectUrl = res.headers.get('location');
        if (redirectUrl) {
            const res2 = await fetch(redirectUrl, {
                method: 'GET',
                redirect: 'manual'
            });
            const text2 = await res2.text();
            return { status: res2.status, text: text2 };
        }
    }

    const text = await res.text();
    return { status: res.status, text: text };
}

async function forwardGetToGoogleAppsScript(scriptUrl, queryParams) {
    const url = new URL(scriptUrl);
    if (queryParams) {
        Object.entries(queryParams).forEach(([k, v]) => {
            if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
        });
    }

    const res = await fetch(url.toString(), {
        method: 'GET',
        redirect: 'manual'
    });

    if (res.status >= 300 && res.status < 400) {
        const redirectUrl = res.headers.get('location');
        if (redirectUrl) {
            const res2 = await fetch(redirectUrl, {
                method: 'GET',
                redirect: 'manual'
            });
            const text2 = await res2.text();
            return { status: res2.status, text: text2 };
        }
    }

    const text = await res.text();
    return { status: res.status, text: text };
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
            result = await forwardGetToGoogleAppsScript(scriptUrl, req.query);
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

            result = await forwardToGoogleAppsScript(scriptUrl, payload);
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
