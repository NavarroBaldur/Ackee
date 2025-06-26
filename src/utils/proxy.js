const fetch = require('node-fetch'); // Asegúrate de que node-fetch esté instalado si usas Node.js 16 o anterior. Node.js 18+ ya tiene fetch nativo.
const UAParser = require('ua-parser-js');

// Considera mover estas claves a variables de entorno en Render para mayor seguridad.
// Por ejemplo, en Render:
// SUPABASE_URL=https://ehtwuxuwinsoyrsusuyu.supabase.co
// SUPABASE_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ehtwuxuwinsoyrsusuyu.supabase.co';
const SUPABASE_API_KEY = process.env.SUPABASE_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVodHd1eHV3aW5zb3lyc3VzdXl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDczNDI4MzksImV4cCI6MjA2MjkxODgzOX0.Kc7LC8JvLmR503o4XIYUhMf-OET2EAy70a5tEWb5H80'; // Esto es tu 'anon public' key

const sendToSupabase = async ({ req, domain, body }) => {
  try {
    // Asegúrate de que req y req.headers existan antes de intentar acceder a ellos
    const userAgentHeader = req?.headers?.['user-agent'] || '';
    const referrerHeader = req?.headers?.referer || '';

    const parser = new UAParser(userAgentHeader);
    const uaResult = parser.getResult();

    // Intenta obtener la geolocalización, pero maneja errores y valores vacíos
    let geo = {};
    try {
      const geoResponse = await fetch('https://ipapi.co/json');
      if (geoResponse.ok) {
        geo = await geoResponse.json();
      }
    } catch (geoError) {
      console.warn('Advertencia al obtener geolocalización:', geoError.message);
      // No es un error fatal si la geolocalización falla
    }

    const data = {
      domain_id: domain._id,
      referrer: referrerHeader,
      user_agent: userAgentHeader,
      screen_width: body.screenWidth || null,
      screen_height: body.screenHeight || null,
      language: body.language || '',
      pathname: body.pathname || '',
      duration: body.duration || 0,
      // Asegúrate de que estas propiedades existan antes de acceder a ellas, usando || '' para seguridad
      device_type: uaResult.device?.type || 'desktop', // 'desktop' es un buen valor por defecto
      browser: uaResult.browser?.name || '',
      os: uaResult.os?.name || '',
      country: geo.country_name || '',
      region: geo.region || ''
    };

    const supabaseResponse = await fetch(`${SUPABASE_URL}/rest/v1/visitas`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_API_KEY,
        'Authorization': `Bearer ${SUPABASE_API_KEY}`, // 'Bearer' + tu clave pública
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates' // Esto podría no ser necesario para inserciones simples
      },
      body: JSON.stringify(data)
    });

    if (!supabaseResponse.ok) {
      const errorText = await supabaseResponse.text();
      console.error(`Error de Supabase (HTTP ${supabaseResponse.status}):`, errorText);
    } else {
      console.log('Datos enviados a Supabase con éxito.');
    }

  } catch (error) {
    console.error('Error general en sendToSupabase:', error.message);
  }
};

module.exports = { sendToSupabase };