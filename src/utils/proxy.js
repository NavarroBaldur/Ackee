const fetch = require('node-fetch');
const UAParser = require('ua-parser-js');

const sendToSupabase = async ({ req, domain, body }) => {
  try {
    const parser = new UAParser(req.headers['user-agent']);
    const uaResult = parser.getResult();

    const geo = await fetch('https://ipapi.co/json')
      .then(res => (res.ok ? res.json() : {}))
      .catch(() => ({}));

    const data = {
      domain_id: domain._id,
      referrer: req.headers.referer || '',
      user_agent: req.headers['user-agent'] || '',
      screen_width: body.screenWidth || null,
      screen_height: body.screenHeight || null,
      language: body.language || '',
      pathname: body.pathname || '',
      duration: body.duration || 0,
      device_type: uaResult.device.type || 'desktop',
      browser: uaResult.browser.name || '',
      os: uaResult.os.name || '',
      country: geo.country_name || '',
      region: geo.region || ''
    };

    await fetch('https://ehtwuxuwinsoyrsusuyu.supabase.co/rest/v1/visitas', {
      method: 'POST',
      headers: {
        apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVodHd1eHV3aW5zb3lyc3VzdXl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDczNDI4MzksImV4cCI6MjA2MjkxODgzOX0.Kc7LC8JvLmR503o4XIYUhMf-OET2EAy70a5tEWb5H80',
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVodHd1eHV3aW5zb3lyc3VzdXl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDczNDI4MzksImV4cCI6MjA2MjkxODgzOX0.Kc7LC8JvLmR503o4XIYUhMf-OET2EAy70a5tEWb5H80',
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify(data)
    });
  } catch (error) {
    console.error('Error enviando a Supabase:', error.message);
  }
};

module.exports = { sendToSupabase };
