export const propertyLocations = [
  {
    id: "ibadan",
    name: "Ibadan",
    region: "Oyo State",
    state: "Oyo",
    searchTerms: ["ibadan"],
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Cocoa_House%2C_Dugbe%2C_Ibadan.jpg/960px-Cocoa_House%2C_Dugbe%2C_Ibadan.jpg",
    imageAlt: "Cocoa House in Dugbe, Ibadan",
    imageCredit: "Ourlib / Wikimedia Commons · CC0",
    imageCreditUrl:
      "https://commons.wikimedia.org/wiki/File:Cocoa_House,_Dugbe,_Ibadan.jpg",
  },
  {
    id: "kogi",
    name: "Kogi",
    region: "Kogi State",
    state: "Kogi",
    searchTerms: ["kogi"],
    image:
      "https://upload.wikimedia.org/wikipedia/commons/4/48/Ankpa_local_government_Aerial_view.jpg",
    imageAlt: "Aerial view of Ankpa Local Government Area in Kogi State",
    imageCredit: "Ebiojo / Wikimedia Commons · CC BY-SA 4.0",
    imageCreditUrl:
      "https://commons.wikimedia.org/wiki/File:Ankpa_local_government_Aerial_view.jpg",
  },
  {
    id: "ado-ekiti",
    name: "Ado-Ekiti",
    region: "Ekiti State",
    state: "Ekiti",
    searchTerms: ["ado-ekiti", "ado ekiti"],
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Academic_Building%2CEkiti_State_University..jpg/960px-Academic_Building%2CEkiti_State_University..jpg",
    imageAlt: "Academic building at Ekiti State University in Ado-Ekiti",
    imageCredit: "Ruth Balogun / Wikimedia Commons · CC BY-SA 3.0",
    imageCreditUrl:
      "https://commons.wikimedia.org/wiki/File:Academic_Building,Ekiti_State_University..jpg",
  },
  {
    id: "lagos",
    name: "Lagos",
    region: "Lagos State",
    state: "Lagos",
    searchTerms: ["lagos"],
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/1004_Building_in_Lagos_Nigeria_-_0606.jpg/960px-1004_Building_in_Lagos_Nigeria_-_0606.jpg",
    imageAlt: "1004 housing estate towers in Lagos",
    imageCredit: "Olasunkanmiariyo / Wikimedia Commons · CC BY-SA 4.0",
    imageCreditUrl:
      "https://commons.wikimedia.org/wiki/File:1004_Building_in_Lagos_Nigeria_-_0606.jpg",
  },
  {
    id: "abuja",
    name: "Abuja",
    region: "Federal Capital Territory",
    state: "FCT",
    searchTerms: ["abuja", "fct", "federal capital territory"],
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/National_Assembly_Building_with_Mace%2C_Abuja%2C_Nigeria.jpg/960px-National_Assembly_Building_with_Mace%2C_Abuja%2C_Nigeria.jpg",
    imageAlt: "National Assembly building in Abuja",
    imageCredit: "Kabusa16 / Wikimedia Commons · CC BY-SA 4.0",
    imageCreditUrl:
      "https://commons.wikimedia.org/wiki/File:National_Assembly_Building_with_Mace,_Abuja,_Nigeria.jpg",
  },
];

function normalizeLocation(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function getPropertyLocationSummaries(records = []) {
  return propertyLocations.map((location) => {
    const searchTerms = location.searchTerms.map(normalizeLocation);
    const count = records.reduce((total, record) => {
      const haystack = normalizeLocation(
        `${record.city || ""} ${record.state || ""}`,
      );
      const recordCount = Number(record.count) || 1;
      return searchTerms.some((term) => haystack.includes(term))
        ? total + recordCount
        : total;
    }, 0);

    return { ...location, count };
  });
}
