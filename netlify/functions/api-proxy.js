const fetch = require('node-fetch');

// La URL base de la API de Sandbox de John Deere
const API_BASE_URL = 'https://sandboxapi.deere.com/platform/';

exports.handler = async (event) => {
    // Obtenemos el endpoint que el frontend quiere consultar (ej: "organizations")
    // y el token de acceso que el frontend nos pasa en el header.
    const endpoint = event.queryStringParameters.endpoint;
    const accessToken = event.headers['x-jd-access-token'];

    if (!accessToken) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Access token is missing.' }) };
    }
    if (!endpoint) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Endpoint is missing.' }) };
    }

    try {
        const apiUrl = `${API_BASE_URL}${endpoint}`;

        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.deere.axiom.v3+json',
                // Pasamos cualquier otro header que el frontend envíe, si es necesario
            },
        });

        const data = await response.json();

        if (!response.ok) {
            // Si la API de John Deere devuelve un error, lo pasamos al frontend
            console.error(`Error from John Deere API for endpoint ${endpoint}:`, data);
            return { statusCode: response.status, body: JSON.stringify(data) };
        }

        // Si todo va bien, devolvemos los datos al frontend
        return {
            statusCode: 200,
            body: JSON.stringify(data),
        };

    } catch (error) {
        console.error('Proxy function error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'An internal error occurred in the proxy function.' }),
        };
    }
};