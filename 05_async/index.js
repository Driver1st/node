import axios from "axios";

const args = process.argv.slice(2);

if (args.length === 0) {
  console.warn("Please provide at least one search query.");
  process.exit(1);
}

const BASE_URL = "https://www.swapi.tech/api/people";

const fetchPeople = async (query) => {
  const encodedQuery = encodeURIComponent(query);
  try {
    const response = await axios.get(`${BASE_URL}?search=${encodedQuery}`);
    return response.data.results || [];
  } catch (error) {
    console.error(`Error while searching for "${query}":`, error.message);
    return [];
  }
};

const fetchPersonDetails = async (url) => {
  try {
    const response = await axios.get(url);
    return response.data.result.properties;
  } catch (error) {
    console.error(`Error fetching details from ${url}:`, error.message);
    return null;
  }
};

const main = async () => {
  const searchResults = await Promise.all(args.map(fetchPeople));

  const allPersonSummaries = [];
  searchResults.forEach((results, index) => {
    if (results.length === 0) {
      console.warn(`No results found for '${args[index]}'`);
    } else {
      allPersonSummaries.push(...results);
    }
  });

  if (allPersonSummaries.length === 0) return;

  const personDetailsList = await Promise.all(allPersonSummaries.map((summary) => fetchPersonDetails(summary.url)));

  const validPeople = personDetailsList.filter((p) => p !== null);

  const uniquePeopleMap = new Map();
  validPeople.forEach((person) => {
    if (!uniquePeopleMap.has(person.name)) {
      uniquePeopleMap.set(person.name, person);
    }
  });

  const uniquePeople = Array.from(uniquePeopleMap.values());
  uniquePeople.sort((a, b) => a.name.localeCompare(b.name));

  console.log(`\nTotal results: ${uniquePeople.length}.`);
  console.log(`All: ${uniquePeople.map((p) => p.name).join(", ")}.`);

  const peopleWithValidHeights = uniquePeople.filter((p) => !isNaN(parseInt(p.height)));

  if (peopleWithValidHeights.length > 0) {
    const min = peopleWithValidHeights.reduce((min, p) => (+p.height < +min.height ? p : min));
    const max = peopleWithValidHeights.reduce((max, p) => (+p.height > +max.height ? p : max));

    console.log(`Min height: ${min.name}, ${min.height} cm.`);
    console.log(`Max height: ${max.name}, ${max.height} cm.`);
  }
};

main();
