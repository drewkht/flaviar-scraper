const fs = require('fs');

let html = fs.readFileSync('bottles.html').toString();
let parser = new DOMParser();
let parsedHtml = parser.parseFromString(html, 'text/html');

let items = [
  ...parsedHtml.getElementsByClassName('about flex flex--space-between'),
];

let itemMap = items.map((item) => {
  let type = item.querySelector('div.type').innerHTML.trim();
  let name = item.querySelector('div.name').innerHTML.trim();
  let edition = item
    .querySelector('div.edition')
    .innerHTML.trim()
    .replace(/[\n,]/g, '')
    .replace(/&amp;/g, '&')
    .replace(/ +/, ' ');
  let rating = item.querySelector('span.valueRating')?.innerHTML?.trim() ?? '0';
  let price =
    item
      .querySelector('div.price')
      ?.innerHTML?.trim()
      .replace(/(\$|,)/g, '') ?? '0';

  return {
    type,
    name,
    edition,
    rating,
    price,
    value: Number(rating) / Number(price),
  };
});

function filterEdition({ edition }) {
  const filter = ['(1L Bottle)', '(375ml)', '(1L)', '(1.75l)', '(200ml)'];
  return filter.reduce((found, test) => {
    if (!found) return false;
    return !edition.toLowerCase().includes(test.toLowerCase());
  }, true);
}

let itemMapFiltered = itemMap.filter(filterEdition);
let itemMapArray = itemMapFiltered.map((item) => Object.values(item));

let json = JSON.stringify(itemMapFiltered, null, '\t');
let csv = itemMapArray.map((item) => item.join(',')).join('\n');
csv = 'type,name,edition,rating,price,value'.concat('\n', csv);

fs.writeFileSync('./output.json', json);
fs.writeFileSync('/mnt/c/Users/drewi/Desktop/Flaviar_Bottles.csv', csv);
