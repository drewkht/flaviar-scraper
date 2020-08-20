const fs = require('fs');

const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

const Constants = require('./constants');

require('dotenv').config();

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
  });
  const page = await browser.newPage();
  try {
    await page.goto(Constants.LOGIN_URL);
    await page.click(Constants.LOGIN_USERNAME_SELECTOR);
    await page.keyboard.type(process.env.USERNAME);
    await page.click(Constants.LOGIN_PASSWORD_SELECTOR);
    await page.keyboard.type(process.env.PASSWORD);
    await page.click(Constants.LOGIN_SUBMIT_BUTTON_SELECTOR);
    await page.waitForNavigation();

    let $ = cheerio.load(await page.content());

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

    bottlesArray = bottlesArray.reverse().slice(0, 3);

    let bottles = [];
    for await (let bottle of bottlesArray) {
      let page = await browser.newPage();
      await page.goto(bottle.href);
      let $ = cheerio.load(await page.content());

      let style = $.root()
        .find('div.title:contains(Style)')
        .next()
        .text()
        .trim();

      let region = $.root()
        .find('div.title:contains(Region)')
        .next()
        .text()
        .trim();

      let country = $.root()
        .find('div.title:contains(Country)')
        .next()
        .text()
        .trim();

      let alcoholPercent = $.root()
        .find('div.title:contains(Alcohol)')
        .next()
        .text()
        .trim();

      let volume = $.root()
        .find('.vol-alc')
        .text()
        .match(/(?<=\().*(?=,)/)[0]
        .trim();

      let distillery = $.root()
        .find('div.title:contains(Distillery)')
        .next()
        .text()
        .trim();

      let age = $.root().find('div.title:contains(Age)').next().text().trim();

      let ratingData =
        JSON.parse($.root().find('script:contains(aggregateRating)')?.html())
          ?.aggregateRating ?? null;

      let totalVotes = ratingData?.ratingCount || 0;
      let reviews = ratingData?.reviewCount || 0;
      let ratings = totalVotes - reviews;

      let flavorSpiral = $.root()
        .find('div.flavour.lazy')
        .get()
        .map((div) => ({
          tier: $(div)
            .attr('style')
            .match(/(?<=width: )[0-9.%]{3,}/)[0],
          flavor: $(div).text().trim(),
        }));

      let tastingNotes = $.root()
        .find('#tasting-notes')
        .text()
        .replace(/ {2,}/g, ' ')
        .replace(/\./g, '');

      let appearance = tastingNotes.match(
        /(?<=Appearance \/ Color)[\s\S]*(?=Smell \/ Nose \/ Aroma)|(?<=Appearance \/ Color)[\s\S]*(?=Nose \/ Aroma \/ Smell)/
      );

      if (Array.isArray(appearance) && appearance.length)
        appearance[0].trim().replace('\n', '');

      let smell = tastingNotes.match(
        /(?<=Smell \/ Nose \/ Aroma)[\s\S]*(?=Flavor \/ Taste \/ Palate)|(?<=Nose \/ Aroma \/ Smell)[\s\S]*(?=Flavor \/ Taste \/ Palate)/
      );

      if (Array.isArray(smell) && smell.length)
        smell[0].trim().replace('\n', '');

      let flavor = tastingNotes.match(
        /(?<=Flavor \/ Taste \/ Palate)[\s\S]*(?=Finish)/
      );

      if (Array.isArray(flavor) && flavor.length)
        flavor[0].trim().replace('\n', '');

      let finish = tastingNotes.match(/(?<=Finish)[\s\S]*/);

      if (Array.isArray(finish) && finish.length)
        finish[0].trim().replace('\n', '');

      await page.close();
      bottles.push({
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
      });
      console.log(bottles.length);
    }
    fs.writeFileSync('./output.json', JSON.stringify(bottles, null, '\t'));
  } catch (err) {
    console.log(err);
  } finally {
    await page.close();
    await browser.close();
  }
})();
