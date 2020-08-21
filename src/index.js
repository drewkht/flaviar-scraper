const fs = require('fs');

const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

const Constants = require('./constants');

require('dotenv').config();

// Set environment variable defaults
const LOCAL_MODE = process.env.LOCAL_MODE || false;
const STORE_HTML = process.env.STORE_HTML || true;
const NUM_BOTTLES = process.env.NUM_BOTTLES || 5;
const WRITE_TO_JSON = process.env.WRITE_TO_JSON || false;
const USE_CACHE = process.env.USE_CACHE || true;

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
  });

  const page = await browser.newPage();

  try {
    const mainHtmlPath = `${__dirname}/../data/bottles.html`;
    const mainHtmlFileExists = fs.existsSync(
      `${__dirname}/../data/bottles.html`
    );

    if (mainHtmlFileExists) {
      if (LOCAL_MODE || USE_CACHE) {
        console.log(`Loading cached main HTML file from ${mainHtmlPath}...`);
        await page.goto(`file://${mainHtmlPath}`);
      } else {
        console.log(`Loading main HTML from ${Constants.LOGIN_URL}...`);
        await page.goto(Constants.LOGIN_URL);
        await page.click(Constants.LOGIN_USERNAME_SELECTOR);
        await page.keyboard.type(process.env.USERNAME);
        await page.click(Constants.LOGIN_PASSWORD_SELECTOR);
        await page.keyboard.type(process.env.PASSWORD);
        await page.click(Constants.LOGIN_SUBMIT_BUTTON_SELECTOR);
        await page.waitForNavigation();
      }
    } else {
      console.error(
        `Attempting to load ${mainHtmlPath} from cache but file does not exist. Exiting...`
      );
      return;
    }

    const mainPageHtml = await page.content();

    if (!LOCAL_MODE && STORE_HTML && (!mainHtmlFileExists || !USE_CACHE)) {
      console.log(
        `${
          mainHtmlFileExists ? 'Updating cache' : 'Creating new cache'
        } of main page HTML at ${mainHtmlPath}...`
      );
      fs.writeFile(mainHtmlPath, mainPageHtml, (err) => {
        if (err) console.log(err);
      });
    }

    const $ = cheerio.load(mainPageHtml);

    // Get reference to all HTML elements representing bottles using selector that uniquely represents them
    const bottlesElements = $(`div.col-lg-3 > a`);

    // Create array of basic data for all bottles
    const initialBottlesArray =
      bottlesElements?.get()?.map((bottle) => {
        const b = $(bottle);
        return {
          href: 'https://flaviar.com'.concat(b.attr().href),
          brand: b.find('div.name')?.text()?.trim(),
          name: b
            .find('div.edition')
            ?.text()
            ?.trim()
            .replace(/[\n,]/g, '')
            .replace(/&amp;/g, '&')
            .replace(/ +/, ' '),
          category: b.find('div.type')?.text(),
          rating: Number(b.find('span.valueRating')?.text()?.trim()) ?? 0,
          price: Number(
            b
              .find('div.price')
              ?.text()
              ?.trim()
              .replace(/(\$|,)/g, '')
          ),
        };
      }) ?? [];

    if (
      WRITE_TO_JSON &&
      !fs.existsSync(`${__dirname}/../data/bottlesArray.json`)
    ) {
      fs.writeFileSync(
        './bottlesArray.json',
        JSON.stringify(initialBottlesArray, null, '\t')
      );
    }

    const bottlesArray = NUM_BOTTLES
      ? initialBottlesArray.slice(0, Number(NUM_BOTTLES))
      : initialBottlesArray;

    console.log(
      `Basic data scrape complete for ${initialBottlesArray.length} bottles`
    );
    console.log(
      `Beginning detailed scrape of ${bottlesArray.length} bottle${
        bottlesArray.length === 1 ? '' : 's'
      }...`
    );

    const bottles = [];
    for await (let bottle of bottlesArray) {
      const page = await browser.newPage();

      const bottleName = bottle.name
        .replace(/[ \\/:"*?<>|]/g, '-')
        .toLowerCase();
      const fileName = `${__dirname}/../data/${bottleName}.html`;
      const fileExists = fs.existsSync(fileName);

      if (!fileExists && LOCAL_MODE) {
        console.log(
          `Running in local mode but ${fileName} doesn't exist; skipping...`
        );
        await page.close();
        continue;
      }

      if (USE_CACHE && fileExists) {
        console.log(`Scraping bottle data from cached HTML at ${fileName}...`);
        await page.goto(`file://${fileName}`);
      } else {
        console.log(
          `Running in online mode${
            USE_CACHE ? ' and no cache exists for bottle' : ' with cache off'
          }, scraping bottle data from ${bottle.href}...`
        );
        await page.goto(bottle.href);
      }

      const html = await page.content();

      if (!LOCAL_MODE && STORE_HTML && (!fileExists || !USE_CACHE)) {
        console.log(
          `${
            fileExists ? 'Updating cache' : 'Creating new cache'
          } of bottle page HTML at ${fileName}...`
        );
        fs.writeFile(fileName, html, (err) => {
          if (err) console.log(err);
        });
      }

      const $ = cheerio.load(html);

      const style = $.root()
        .find('div.title:contains(Style)')
        ?.next()
        ?.text()
        ?.trim();

      const region = $.root()
        .find('div.title:contains(Region)')
        ?.next()
        ?.text()
        ?.trim();

      const country = $.root()
        .find('div.title:contains(Country)')
        ?.next()
        ?.text()
        ?.trim();

      const alcoholPercent = $.root()
        .find('div.title:contains(Alcohol)')
        ?.next()
        ?.text()
        ?.trim();

      const volume = $.root()
        .find('.vol-alc')
        ?.text()
        ?.match(/(?<=\().*(?=,)/)?.[0]
        ?.trim();

      let distillery = $.root()
        .find('div.title:contains(Distillery)')
        ?.next()
        ?.text();

      distillery = distillery.trim();
      distillery = distillery.replace(/(?:\n|\\n) *>*/g, '');

      const age = $.root()
        .find('div.title:contains(Age)')
        ?.next()
        ?.text()
        ?.trim();

      const ratingData = JSON.parse(
        $.root().find('script:contains(aggregateRating)')?.html()
      );

      const aggregateRating = ratingData?.aggregateRating ?? undefined;
      const reviews = ratingData?.review?.filter((r) => r.reviewRating) ?? [];

      const totalRatings = aggregateRating?.ratingCount || 0;
      const reviewRatings = aggregateRating?.reviewCount || 0;
      const nonReviewRatings = totalRatings - reviewRatings;

      let numBadReviews = 0;
      const avgReviewRatingValue = Number(
        (
          reviews.reduce((sum, review) => {
            if (!review.reviewRating) {
              numBadReviews = numBadReviews + 1;
              console.warn(
                `Bad review value: ${JSON.stringify(review, null, '\t')}`
              );
            }
            return sum + Number(review.reviewRating?.ratingValue ?? 0);
          }, 0) /
          (reviews.length - numBadReviews)
        ).toPrecision(3)
      );

      const flavors = $.root()
        .find('div.flavour.lazy')
        ?.get()
        ?.map((div) => {
          const flavorTiers = {
            '50%': 'primary',
            '32.5%': 'secondary',
            '21.125%': 'tertiary',
          };

          let tier =
            flavorTiers[
              $(div)
                .attr('style')
                .match(/(?<=width: )[0-9.%]{3,}/)[0]
            ];

          let flavor = $(div).text().trim();

          return {
            tier,
            flavor,
          };
        });

      const flavorSpiral = {
        primary: [],
        secondary: [],
        tertiary: [],
      };

      flavors.map((flavor) => flavorSpiral[flavor.tier].push(flavor.flavor));

      const tastingNotes = $.root()
        .find('#tasting-notes')
        ?.text()
        ?.replace(/ {2,}/g, ' ')
        .replace(/\./g, '');

      const appearance = tastingNotes
        .match(
          /(?<=Appearance.*\/.*Color)[\s\S.]*(?=Smell.*\/.*Nose.*\/.*Aroma)|(?<=Appearance.*\/.*Color)[\s\S.]*(?=Nose.*\/.*Aroma.*\/.*Smell)/
        )?.[0]
        ?.trim();

      const smell = tastingNotes
        .match(
          /(?<=Smell.*\/.*Nose.*\/.*Aroma)[\s\S.]*(?=Flavor.*\/.*Taste.*\/.*Palate)|(?<=Nose.*\/.*Aroma.*\/.*Smell)[\s\S.]*(?=Flavor.*\/.*Taste.*\/.*Palate)/
        )?.[0]
        ?.trim();

      const flavor = tastingNotes
        .match(/(?<=Flavor.*\/.*Taste.*\/.*Palate)[\s\S]*(?=Finish)/)?.[0]
        ?.trim()
        .replace(/(?:\\n|\n)/g, '');

      const finish = tastingNotes.match(/(?<=Finish)[\s\S]*/)?.[0]?.trim();

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
        totalRatings,
        reviewRatings,
        nonReviewRatings,
        avgReviewRatingValue,
        flavorSpiral,
        tastingNotes: {
          appearance,
          flavor,
          smell,
          finish,
        },
      });
    }

    fs.writeFile(
      './output.json',
      JSON.stringify(bottles, null, '\t'),
      (err) => {
        if (err) console.log(err);
        else
          console.log(
            `Successfully wrote ${bottles.length} bottles to output.json`
          );
      }
    );
  } catch (err) {
    console.log(err);
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
  }
})();
