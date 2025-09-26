const fetch = require('node-fetch');

const API_BASE_URL = 'https://sandboxapi.deere.com/platform/';

exports.handler = async (event) => {
    const endpoint = event.queryStringParameters.endpoint;
    const accessToken = event.headers['x-jd-access-token'];

    if (!accessToken) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Access token is missing.' }) };
    }
    if (!endpoint) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Endpoint is missing.' }) };
    }

    try {
        const apiUrl = new URL(endpoint, API_BASE_URL).toString();
        console.log(`[PROXY] Calling API: ${apiUrl}`);

        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.deere.axiom.v3+json',
                // --- CAMBIO CLAVE #1: Desactivar la paginación ---
                'No_paging': 'True'
            },
        });

        // --- CAMBIO CLAVE #2: Manejo de errores más robusto ---
        // Leemos el cuerpo de la respuesta SIN IMPORTAR si fue exitosa o no.
        const responseBodyText = await response.text();

        // Si la respuesta no fue exitosa (ej: 403, 401, 500), la reenviamos tal cual al frontend.
        if (!response.ok) {
            console.error(`Error from John Deere API for endpoint ${endpoint}:`, responseBodyText);
            // Reenviamos el status original y el cuerpo del error.
            // El frontend se encargará de parsearlo como JSON.
            return {
                statusCode: response.status,
                body: responseBodyText 
            };
        }
        
        // Si la respuesta fue exitosa, devolvemos los datos.
        return {
            statusCode: 200,
            body: responseBodyText,
        };

    } catch (error) {
        console.error('Proxy function error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'An internal error occurred in the proxy function.' }),
        };
    }
};