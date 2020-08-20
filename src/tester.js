const fs = require('fs');
const path = require('path');

const cheerio = require('cheerio');

const html = fs.readFileSync(path.resolve(`data/bottles.html`)).toString();
let $ = cheerio.load(html);

// Get reference to all HTML elements representing bottles
const bottlesElements = $(`div.col-lg-3 > a`);

// Create array of basic data for all bottles
let bottlesArray = bottlesElements.get().map((bottle) => {
  let b = $(bottle);
  return {
    href: 'https://flaviar.com'.concat(b.attr().href),
    brand: b.find('div.name').text().trim(),
    name: b
      .find('div.edition')
      .text()
      .trim()
      .replace(/[\n,]/g, '')
      .replace(/&amp;/g, '&')
      .replace(/ +/, ' '),
    category: b.find('div.type').text(),
    rating: Number(b.find('span.valueRating')?.text().trim()) ?? 0,
    price: Number(
      b
        .find('div.price')
        .text()
        .trim()
        .replace(/(\$|,)/g, '')
    ),
  };
});

/**
 * @type {Array<Bottle>} bottles
 */
let bottles = bottlesArray.map((bottle) => {
  // navigate to bottle.href
  // load cheerio with page HTML
  const $$ = cheerio.load(
    fs.readFileSync(path.resolve(`data/bottle.html`)).toString()
  );

  let style = $$.root().find('div.title:contains(Style)').next().text().trim();

  let region = $$.root()
    .find('div.title:contains(Region)')
    .next()
    .text()
    .trim();

  let country = $$.root()
    .find('div.title:contains(Country)')
    .next()
    .text()
    .trim();

  let alcoholPercent = $$.root()
    .find('div.title:contains(Alcohol)')
    .next()
    .text()
    .trim();

  let volume = $$.root()
    .find('.vol-alc')
    .text()
    .match(/(?<=\().*(?=,)/)[0]
    .trim();

  let distillery = $$.root()
    .find('div.title:contains(Distillery)')
    .next()
    .text()
    .trim();

  let age = $$.root().find('div.title:contains(Age)').next().text().trim();

  let { ratingCount: totalVotes, reviewCount: reviews } = JSON.parse(
    $$.root().find('script:contains(aggregateRating)').html()
  ).aggregateRating;

  let ratings = totalVotes - reviews;

  let flavorSpiral = $$.root()
    .find('div.flavour.lazy')
    .get()
    .map((div) => ({
      tier: $$(div)
        .attr('style')
        .match(/(?<=width: )[0-9.%]{3,}/)[0],
      flavor: $$(div).text().trim(),
    }));

  let tastingNotes = $$.root()
    .find('#tasting-notes')
    .text()
    .replace(/ {2,}/g, ' ')
    .replace(/\./g, '');

  let appearance = tastingNotes
    .match(/(?<=Appearance \/ Color)[\s\S]*(?=Smell \/ Nose \/ Aroma)/)[0]
    .trim()
    .replace('\n', '');

  let smell = tastingNotes
    .match(/(?<=Smell \/ Nose \/ Aroma)[\s\S]*(?=Flavor \/ Taste \/ Palate)/)[0]
    .trim()
    .replace('\n', '');

  let flavor = tastingNotes
    .match(/(?<=Flavor \/ Taste \/ Palate)[\s\S]*(?=Finish)/)[0]
    .trim()
    .replace('\n', '');

  let finish = tastingNotes
    .match(/(?<=Finish)[\s\S]*/)[0]
    .trim()
    .replace('\n', '');

  return {
    ...bottle,
    style,
    region,
    country,
    distillery,
    alcoholPercent,
    volume,
    age,
    totalVotes,
    reviews,
    ratings,
    flavorSpiral,
    tastingNotes: {
      appearance,
      flavor,
      smell,
      finish,
    },
  };
});

/**
 * Object representing all the data on one bottle in Flaviar's web store
 * @typedef {Object} Bottle
 * @property {string} href - URL of bottle page (e.g. /oban/oban-14-year-old)
 * @property {string} brand - Brand name, same as distillery probably (e.g. Oban)
 * @property {string} name - Name of this specific bottle (e.g. Oban 14 Year Old)
 * @property {string} category - Liquor category (e.g. Scotch)
 * @property {string} style - Liquor subcategory (e.g. Single Malt Scotch Whisky)
 * @property {string} region - Specific part of country in which liquor is made (e.g. Highland or South Carolina)
 * @property {string} country - Country of origin (e.g. United Kingdom, Scotland)
 * @property {string} distillery - Name of distillery (e.g. Oban)
 * @property {string} alcoholPercent - % Alcohol by volume (e.g. 43%)
 * @property {string} volume - Volume of bottle (e.g. 0.75l or 750ml)
 * @property {string} age - Age statement, if any (e.g. 14 year old)
 * @property {number} price - Bottle price (e.g. 74.99)
 * @property {number} rating - Average user rating of bottle out of 10 (e.g. 8.3)
 * @property {number} totalVotes - Total # of ratings + reviews combined (e.g. 855)
 * @property {number} reviews - # of ratings that include a written review (e.g. 205)
 * @property {number} ratings - # of ratings with no written review; totalVotes - reviews (e.g. 855 - 205 = 650)
 * @property {FlavorSpiral} flavorSpiral - Data representation of the Flavor Spiral graphic for this bottle
 * @property {TastingNotes} tastingNotes - Data representing the various tasting notes given by Flaviar for this bottle
 */

/**
 * Array of Flavor objects that represents the various flavors and strengths of flavors given by a Flavor Spiral graphic on a bottle page
 * @typedef {Array<Flavor>} FlavorSpiral
 */

/**
 * Object representing one flavor and its strength in a Flavor Spiral
 * @typedef {Object} Flavor
 * @property {string} tier - Tier of flavor "strength" this flavor is, based on the size of the picture in the flavor spiral graphic (e.g. 50%, 23.5%, etc.)
 * @property {string} flavor - Name of flavor (e.g. smoky, citrus)
 */

/**
 * @typedef {Object} TastingNotes
 * @property {string} appearance - e.g. golden amber
 * @property {string} smell - e.g. Peat and sea salt, swirling in a fruited caramel body
 * @property {string} flavor - e.g. Citrus explodes out and is complemented with nutty undertones and dashes of vanilla
 * @property {string} finish - e.g. Smoky peat remains with a slight sweetness
 */
