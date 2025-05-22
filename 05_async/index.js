import axios from "axios";

const args = process.argv.slice(2);

if (args.length === 0) {
  console.warn("Please provide at least one search query.");
  process.exit(1);
}

const BASE_URL = "https://www.swapi.tech/";

const fetchPeople = async (query) => {
  const encodedQuery = encodeURIComponent(query);
  try {
    const response = await axios.get(`${BASE_URL}${encodedQuery}`);
    return response.data.results || [];
  } catch (error) {
    console.error(`Error while searching for "${query}":`, error.message);
    return [];
  }
};

const main = async () => {
  const promises = args.map((query) => fetchPeople(query));
  const results = await Promise.all(promises);

  const allPeople = [];
  results.forEach((people, index) => {
    if (people.length === 0) {
      console.warn(`No results found for '${args[index]}'`);
    } else {
      allPeople.push(...people);
    }
  });

  if (allPeople.length === 0) return;

  const uniquePeopleMap = new Map();
  allPeople.forEach((person) => {
    if (!uniquePeopleMap.has(person.name)) {
      uniquePeopleMap.set(person.name, person);
    }
  });

  const uniquePeople = Array.from(uniquePeopleMap.values());

  uniquePeople.sort((a, b) => a.name.localeCompare(b.name));

  console.log(`\nTotal results: ${uniquePeople.length}.`);
  console.log(`All: ${uniquePeople.map((p) => p.name).join(", ")}.`);

  const withValidHeights = uniquePeople.filter((p) => !isNaN(parseInt(p.height)));

  if (withValidHeights.length > 0) {
    const min = withValidHeights.reduce((min, p) => (+p.height < +min.height ? p : min), withValidHeights[0]);
    const max = withValidHeights.reduce((max, p) => (+p.height > +max.height ? p : max), withValidHeights[0]);

    console.log(`Min height: ${min.name}, ${min.height} cm.`);
    console.log(`Max height: ${max.name}, ${max.height} cm.`);
  }
};

main();
