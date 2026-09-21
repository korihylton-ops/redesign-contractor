// Generates examples/starter/config.json: a FICTIONAL plumber ("Harbour Plumbing Co") used to demo and test the engine.
// Real projects get their config.json written by the skill from the scraped site. Every value below is sample data.
const fs = require('fs');
const path = require('path');

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const regionsDef = {
  'inner-west': { label: 'Inner West', names: ['Ashfield', 'Burwood', 'Concord', 'Croydon', 'Drummoyne', 'Five Dock', 'Haberfield', 'Leichhardt', 'Lilyfield', 'Marrickville', 'Newtown', 'Petersham', 'Stanmore', 'Strathfield', 'Summer Hill'] },
  'lower-north-shore': { label: 'Lower North Shore', names: ['Artarmon', 'Chatswood', 'Crows Nest', 'Lane Cove', 'Mosman', 'Neutral Bay', 'North Sydney', 'St Leonards', 'Willoughby'] },
  'eastern-suburbs': { label: 'Eastern Suburbs', names: ['Bondi', 'Bronte', 'Coogee', 'Randwick', 'Paddington', 'Woollahra', 'Double Bay', 'Bellevue Hill'] }
};
const regions = {}, suburbs = [];
Object.entries(regionsDef).forEach(([k, r]) => { regions[k] = { label: r.label }; r.names.forEach((n) => suburbs.push({ slug: slug(n), name: n, region: k })); });

const svc = (name, o) => Object.assign({ slug: slug(name) + '-sydney', name, option: name }, o);
const services = [
  svc('Emergency plumber', { emergency: true, h1: 'Emergency plumber in Sydney, 24/7', intro: 'Burst pipe, blocked drain, no hot water or a leak that will not stop. Call any time and a licensed plumber is on the way.', price: 'From $220 call-out', priceNote: 'Sample pricing, replace with real', points: ['Fast response day and night', 'Upfront price before work starts', 'Vans stocked with common parts', 'Most faults fixed on the first visit'], image: 'work-01.svg' }),
  svc('Blocked drains', { h1: 'Blocked drain clearing in Sydney', intro: 'Slow drains, gurgling pipes and overflowing gullies cleared fast, with a camera inspection when needed.', price: 'From $180', priceNote: 'Sample pricing', points: ['High-pressure jet clearing', 'CCTV camera inspection', 'Kitchen, bathroom and stormwater drains', 'Written quote first'], image: 'work-02.svg' }),
  svc('Hot water systems', { h1: 'Hot water system repair and replacement', intro: 'Electric, gas, solar and heat pump systems repaired or replaced, with same-day replacement often possible.', price: 'From $1,450 installed', priceNote: 'Sample pricing', points: ['All major brands', 'Old unit removed', 'Compliance certificate provided', 'Same-day replacement where possible'], image: 'work-03.svg' }),
  svc('Leaking taps and toilets', { h1: 'Tap, toilet and leak repairs', intro: 'Dripping taps, running toilets and hidden leaks found and fixed before they cost you more.', price: 'From $150', priceNote: 'Sample pricing', points: ['Leak detection', 'Tap and mixer replacement', 'Cistern and flush repairs', 'Water-saving upgrades'], image: 'work-04.svg' }),
  svc('Gas fitting', { h1: 'Gas fitting and gas leak repairs', intro: 'Licensed gas fitters for cooktops, heaters, hot water and new connections, with compliance certificates.', price: 'Fixed quote', priceNote: 'After a quick look', points: ['Cooktop and heater connections', 'Gas leak detection', 'Compliance certificates', 'New gas line installs'], image: 'work-05.svg' }),
  svc('Bathroom renovations', { h1: 'Bathroom renovation plumbing', intro: 'Rough-in and fit-off plumbing for bathroom renovations, coordinated with your builder and other trades.', price: 'Fixed quote', priceNote: 'Written and itemised', points: ['Rough-in and fit-off', 'Shower, bath and vanity connections', 'Waterproofing coordination', 'Certification on completion'], image: 'work-06.svg' }),
  svc('Roof and gutter plumbing', { h1: 'Roof, gutter and downpipe plumbing', intro: 'Leaking roofs, damaged gutters and downpipes repaired or replaced to keep water where it belongs.', price: 'Fixed quote', priceNote: 'After inspection', points: ['Gutter repair and replacement', 'Downpipe and stormwater', 'Roof leak repairs', 'Gutter guard fitting'], image: 'work-07.svg' }),
  svc('Commercial plumbing', { h1: 'Commercial plumbing in Sydney', intro: 'Maintenance and call-out plumbing for shops, offices, restaurants and strata buildings.', price: 'Hourly or contract', priceNote: 'Maintenance plans available', points: ['Planned maintenance', 'After-hours call-outs', 'Backflow testing', 'Strata and property managers'], image: 'work-08.svg' })
];
const extraServices = [
  svc('Water pressure problems', { h1: 'Low water pressure repairs', intro: 'Low or fluctuating pressure diagnosed and fixed, from blocked fittings to failing regulators.', points: ['Pressure testing', 'Regulator replacement', 'Pipe inspection', 'Written findings'], image: 'work-09.svg' }),
  svc('Backflow prevention', { h1: 'Backflow prevention testing', intro: 'Annual backflow device testing and certification for homes and businesses.', points: ['Annual testing', 'Device replacement', 'Certificates for council', 'Reminders sent'], image: 'work-10.svg' }),
  svc('Pipe relining', { h1: 'Pipe relining and repair', intro: 'Repair damaged drains without digging up your garden or driveway.', points: ['No-dig repairs', 'Root intrusion fixes', 'Camera inspection first', 'Long-life lining'], image: 'work-11.svg' }),
  svc('Kitchen plumbing', { h1: 'Kitchen plumbing and appliance connections', intro: 'Sinks, dishwashers, filters and mixers installed and connected properly.', points: ['Sink and mixer installs', 'Dishwasher connections', 'Water filter fitting', 'Neat, tested work'], image: 'work-12.svg' })
];

const cfg = {
  site: { siteUrl: 'https://example.com', locale: 'en-AU', areaLabel: 'Sydney and the Inner West', sourceUrl: 'https://example.com' },
  trade: { noun: 'plumber', nounPlural: 'plumbers', schemaType: 'Plumber', slugPrefix: 'plumber-', selector: 'panel', selectorHeading: 'Pick a service to see the job and the price', selectorLede: 'Everything we fix, in one place. Choose a service to see what is included and what it costs.', emergencyLabel: 'Emergency plumber' },
  business: {
    name: 'Harbour Plumbing Co', legalName: 'Harbour Plumbing Co Pty Ltd', phone: '0400 000 000', email: 'hello@example.com', abn: '00 000 000 000',
    address: { street: '1 Sample Street', suburb: 'Leichhardt', state: 'NSW', postcode: '2040', country: 'AU' },
    licences: [{ label: 'NSW Plumbing Licence', number: '000000C', short: 'Plumbing Licence', detail: 'Sample number, replace' }],
    insurance: '$20M public liability insurance', rating: '4.9', reviewCount: 212, standardRate: 165, afterHoursRate: 240, firstJobDiscount: 25,
    yearsExperience: 12, customersServed: 8000, people: { owner: 'Sample Owner' }, hoursText: 'Emergency response 24/7. Standard hours 7am to 5pm, Monday to Saturday.', open247: true,
    social: { facebook: 'https://facebook.com/', instagram: 'https://instagram.com/' }
  },
  brand: { primary: '#1f7ae0', ink: '#0d1b2a', hazard: '#ff9f1c', surface: '#f5f8fc', fonts: { displayFamily: 'Manrope', displayCss: 'Manrope:wght@600;700;800', bodyFamily: 'Inter', bodyCss: 'Inter:wght@400;500;600;700' } },
  images: { logo: 'logo.svg', hero: 'hero.svg', heroAlt: 'A Harbour Plumbing Co van outside a Sydney home', about: 'about.svg', aboutAlt: 'The Harbour Plumbing Co team', expand: 'expand.svg', expandAlt: 'A plumber at work', og: 'hero.svg' },
  copy: {
    meta: { homeTitle: 'Plumber Sydney | Harbour Plumbing Co, Same-Day and 24/7', homeDescription: 'Licensed Sydney plumbers for blocked drains, hot water, leaks and gas fitting. Same-day service, upfront pricing. Call {{phone}}.' },
    hero: { lines: ['Licensed plumbers', 'across Sydney,', 'fixed the first time.'], lede: '{{name}} is a local team based in {{city}}. Same-day service, 24/7 emergency response and upfront pricing with no surprises.' },
    services: { help: 'Not sure which one you need? Describe the problem and we will tell you.' },
    why: { heading: 'Why Sydney homeowners choose {{name}}', lede: 'Sample copy. The skill replaces this with text drawn from the client website.' },
    process: { heading: 'From first call to fixed', lede: 'Simple, written and fixed. This is how every job runs.' },
    pricing: { heading: 'Prices you can read before you call', lede: 'All prices include GST. Most jobs are quoted as a fixed price in writing before we start.', note: 'Typical ranges for standard conditions. Access and parts can change the final price, and we confirm it in writing first.' },
    expand: { heading: 'Every job tested and certified', body: 'Licensed, insured and guaranteed.' },
    about: { heading: 'Locally owned, and you speak to the people doing the work', paras: ['{{name}} is based in {{city}}. When you call, you reach the team on the tools.', 'We work in {{area}} every day, so we know the common problems and fix them quickly.'] },
    reviews: { lede: 'Written by customers across {{area}}.' },
    work: { lede: 'Real jobs from our own crew.' },
    areas: { lede: 'Based in {{city}}, covering {{area}}. Find your suburb below.' },
    suburb: { intro: 'Licensed local {{nounPlural}} for {{suburb}}, based just up the road. Same-day service and upfront pricing.', introOutside: 'We service {{suburb}} for larger jobs and scheduled work. Call {{phone}} to check availability.' },
    quote: { lede: 'Tell us what you need and we will call you back. If it cannot wait, call or text now.' },
    longform: { heading: 'The full guide' }
  },
  stats: [{ n: 8000, suffix: '+', label: 'Customers served' }, { n: 12, suffix: '+', label: 'Years of experience' }, { n: 4.9, decimals: 1, suffix: '', label: 'Google rating' }, { n: 212, suffix: '', label: 'Google reviews' }, { n: suburbs.length, suffix: '', label: 'Suburbs served' }],
  bento: [
    { t: '${{discount}} Off Your First Job', d: 'A welcome discount on your first plumbing job with us.', wide: true, accent: true },
    { t: 'Upfront Pricing', d: 'A written price before we start. No hidden fees.' }, { t: '{{customers}}+ Customers', d: 'Trusted by thousands of local households.' },
    { t: '{{years}}+ Years', d: 'A decade of experience on every job.' }, { t: '{{rating}} Stars', d: 'Rated by real customers on Google.' },
    { t: 'Licensed and Insured', d: 'Fully licensed, insured and certified work.', wide: true }, { t: '24/7 Emergency Service', d: 'Available around the clock for urgent jobs.', hazard: true, wide: true },
    { t: 'Local Expertise', d: 'We know {{area}} and its plumbing.', wide: true }
  ],
  steps: [{ t: 'Call, text or send the form', d: 'Same-day service and 24/7 emergency response.' }, { t: 'Get a written fixed price', d: 'We explain the work clearly and quote before we start.' }, { t: 'Licensed work, done properly', d: 'Completed to standard by licensed, insured plumbers.' }, { t: 'Certified and guaranteed', d: 'Compliance certificate on completion.' }],
  promise: { title: '${{discount}} off your first job', body: 'Just mention it when you book.', bullets: ['No callout fee on standard jobs', 'Written fixed-price quotes', 'Workmanship guarantee', 'Card, EFT and direct deposit accepted'], cta: 'Book a first job' },
  services, extraServices, regions, suburbs,
  regionPages: [{ slug: 'sydney', name: 'Sydney' }, { slug: 'inner-west-sydney', name: 'the Inner West' }],
  reviews: Array.from({ length: 6 }, (_, i) => ({ name: 'Sample Customer ' + String.fromCharCode(65 + i), text: 'Sample review. Replace this with a real customer review from the client website.' })),
  faqs: [
    { q: 'How much does a plumber cost in Sydney?', a: 'Our standard rate is ${{standardRate}} per hour. Most jobs are quoted as a fixed price in writing before we start.' },
    { q: 'Do you charge a call-out fee?', a: 'Not on standard jobs. You pay for the work at the rate or fixed price we agreed.' },
    { q: 'Can you come out today?', a: 'Often, yes. We offer same-day service and 24/7 emergency response. Call {{phone}}.' },
    { q: 'Are you licensed and insured?', a: 'Yes. We hold a NSW plumbing licence and public liability insurance.' },
    { q: 'Do you fix blocked drains?', a: 'Yes, including high-pressure clearing and camera inspection.' },
    { q: 'Can you replace my hot water system?', a: 'Yes. We replace electric, gas, solar and heat pump systems, often the same day.' },
    { q: 'Do you offer a warranty?', a: 'Yes, all workmanship is guaranteed.' },
    { q: 'Where do you work?', a: 'We are based in {{city}} and cover {{area}}.' },
    { q: 'How do I pay?', a: 'Card, EFT and direct deposit are accepted.' },
    { q: 'Is there a discount for first-time customers?', a: 'Yes, ${{discount}} off your first job.' }
  ],
  priceSheet: [
    { item: 'Standard plumbing work', price: '${{standardRate}} per hour', note: 'Sample pricing' }, { item: 'After hours and emergency', price: '${{afterHoursRate}} per hour', note: '24/7' },
    { item: 'Blocked drain clearing', price: 'From $180', note: 'Fixed price' }, { item: 'Hot water replacement', price: 'From $1,450', note: 'Installed' },
    { item: 'Tap or toilet repair', price: 'From $150', note: 'Fixed price' }, { item: 'Gas fitting and bathrooms', price: 'Fixed quote', note: 'After a quick look' }
  ],
  gallery: Array.from({ length: 12 }, (_, i) => ({ src: 'work-' + String(i + 1).padStart(2, '0') + '.svg', alt: 'Sample completed plumbing job ' + (i + 1) })),
  offers: [{ id: 'priority', title: 'Priority booking', body: 'We put your job at the front of the queue and aim to attend as soon as we can.', active: true }, { id: 'inspection', title: 'Plumbing health check add-on', body: 'Add a licensed check of taps, pipes and hot water to your visit so problems are found early.', active: true }],
  chat: { facts: [] }
};
// Tokens like ${{discount}} render as "$25" ("$" then the token).
fs.writeFileSync(path.join(__dirname, 'config.json'), JSON.stringify(cfg, null, 2));
console.log('starter config:', cfg.services.length, 'featured services,', cfg.extraServices.length, 'extra,', cfg.suburbs.length, 'suburbs');
