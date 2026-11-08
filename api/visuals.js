// GET /api/visuals?kind=pic|vid&q=whale&ratio=v|w|s|""
const ratioOk = (w, h, r) => {
  if (!r) return true;
  const x = w / h;
  return r === 'v' ? x < 0.8 : r === 's' ? x >= 0.8 && x <= 1.25 : x > 1.25;
};
const safe = async (p) => { try { return await p; } catch (e) { return null; } };

module.exports = async (req, res) => {
  const { kind = 'pic', q = '', ratio = '' } = req.query;
  if (!q.trim()) return res.status(400).json({ error: 'Missing search text' });
  const { PEXELS_KEY, PIXABAY_KEY } = process.env;
  const qs = encodeURIComponent(q.slice(0, 80));
  const items = [];
  const orient = { v: 'portrait', w: 'landscape', s: 'square' }[ratio] || '';

  if (kind === 'pic') {
    const jobs = [];
    if (PEXELS_KEY) jobs.push(safe(fetch(`https://api.pexels.com/v1/search?query=${qs}&per_page=20${orient ? '&orientation=' + orient : ''}`, { headers: { Authorization: PEXELS_KEY } }).then(r => r.json())));
    if (PIXABAY_KEY) jobs.push(safe(fetch(`https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${qs}&image_type=photo&per_page=20`).then(r => r.json())));
    const [pex, pix] = await Promise.all(jobs.length === 2 ? jobs : [jobs[0] || null, null]);
    (pex?.photos || []).forEach(p => ratioOk(p.width, p.height, ratio) && items.push({ thumb: p.src.medium, url: p.src.original, w: p.width, h: p.height }));
    (pix?.hits || []).forEach(p => ratioOk(p.imageWidth, p.imageHeight, ratio) && items.push({ thumb: p.webformatURL, url: p.largeImageURL, w: p.imageWidth, h: p.imageHeight }));
    return res.json({ items });
  }

  const jobs = [
    PEXELS_KEY ? safe(fetch(`https://api.pexels.com/videos/search?query=${qs}&per_page=15${orient ? '&orientation=' + orient : ''}`, { headers: { Authorization: PEXELS_KEY } }).then(r => r.json())) : null,
    PIXABAY_KEY ? safe(fetch(`https://pixabay.com/api/videos/?key=${PIXABAY_KEY}&q=${qs}&per_page=15`).then(r => r.json())) : null,
  ];
  const [pex, pix] = await Promise.all(jobs);
  (pex?.videos || []).forEach(v => {
    const f = [...v.video_files].filter(x => x.file_type === 'video/mp4').sort((a, b) => b.width - a.width)[0];
    if (f && ratioOk(f.width, f.height, ratio)) items.push({ thumb: v.image, preview: f.link, url: f.link, w: f.width, h: f.height });
  });
  (pix?.hits || []).forEach(v => {
    const f = v.videos.large?.url ? v.videos.large : v.videos.medium;
    if (f && ratioOk(f.width, f.height, ratio)) items.push({ thumb: `https://i.vimeocdn.com/video/${v.picture_id}_640x360.jpg`, preview: v.videos.tiny?.url || f.url, url: f.url, w: f.width, h: f.height });
  });
  const links = `More from <a href="https://mixkit.co/free-stock-video/${qs}/" target="_blank" rel="noopener">Mixkit</a> and <a href="https://coverr.co/s?q=${qs}" target="_blank" rel="noopener">Coverr</a>.`;
  res.json({ items, links });
};
