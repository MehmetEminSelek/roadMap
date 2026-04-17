const axios = require('axios');
const cheerio = require('cheerio');
async function test() {
  try {
    const res = await axios.get('https://www.petrolofisi.com.tr/akaryakit-fiyatlari');
    const $ = cheerio.load(res.data);
    const table = $('table').first();
    const rows = table.find('tbody tr');
    console.log(`Found ${rows.length} rows`);
  } catch (e) {
    console.error(e.message);
  }
}
test();
