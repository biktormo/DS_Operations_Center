// Usamos 'node-fetch' para hacer peticiones HTTP en el entorno de Node.js de Netlify.
// Asegúrate de añadir `node-fetch` a tus dependencias si tu proyecto usa `package.json`.
// Para un proyecto simple, Netlify puede manejarlo automáticamente.
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    // Solo permitimos peticiones POST a esta función
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { code } = JSON.parse(event.body);
        if (!code) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Authorization code is missing.' }) };
        }

        // Recuperamos las credenciales de las variables de entorno de Netlify
        const CLIENT_ID = process.env.JOHN_DEERE_CLIENT_ID;
        const CLIENT_SECRET = process.env.JOHN_DEERE_CLIENT_SECRET;

        // La Redirect URI debe coincidir con la que se usó para obtener el código.
        // Usamos un pequeño truco para saber si la petición vino de desarrollo o producción.
        const origin = event.headers.referer;
        let redirectUri = '';
        if(origin && origin.includes('stackblitz')){
            redirectUri = 'URL_DE_TU_APP_EN_STACKBLITZ'; // Asegúrate que coincida con script.js
        } else {
            redirectUri = 'URL_DE_TU_APP_EN_NETLIFY'; // Asegúrate que coincida con script.js
        }
        
        const tokenUrl = 'https://signin.johndeere.com/oauth2/aus78tnlaysMraFhC1t7/v1/token';
        
        // El cuerpo de la petición debe estar en formato `x-www-form-urlencoded`
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('redirect_uri', redirectUri);

        // Para la autenticación Basic, codificamos las credenciales en Base64
        const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${basicAuth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: params,
        });

        const data = await response.json();

        if (!response.ok) {
            // Si John Deere devuelve un error, lo pasamos al frontend
            console.error('Error from John Deere API:', data);
            return { statusCode: response.status, body: JSON.stringify({ error: data.error_description || 'Failed to fetch token.' }) };
        }

        // Si todo sale bien, devolvemos la respuesta al frontend
        return {
            statusCode: 200,
            body: JSON.stringify(data),
        };

    } catch (error) {
        console.error('Error in Netlify function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'An internal server error occurred.' }),
        };
    }
};