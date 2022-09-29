import { waitTillHTMLRendered } from "./Service.js";
import { data as offers2 } from "./backup.js";
import conn from "./db.js";
import puppeteer from "puppeteer";
import fs from "fs/promises";
import xml2js from "xml2js";

/*************************START CONFIG***************************/
//Editable
const damp = 1;
const myCity = "710000000"; //Astana
const myStoreName = "HomeTechnologies";
const myStoreId = "15503068";
const updateEveryXMinutes = 30;
const tablename = "pricelist";
const XMLFilePathHome = `./${tablename}.xml`;
const XMLFilePath = `/home/apps/jmmanager/jmmanager-server/public/${tablename}.xml`;
const cookiesPath = `./cookies/offers/cookies${tablename}.json`;
const availabaleStorages = [1];
//Custom
const devices = puppeteer.devices;
const iPhone = devices["iPhone XR"];
/**************************END CONFIG****************************/

/**************************START SCRAPING****************************/
const updatePrices = async () => {
  const offers = (await conn.query("SELECT * FROM " + tablename))[0];

  const newOffers = [];

  const browser = await puppeteer.launch({
    args: ["--no-sandbox"],
  });

  /****************START GET THE LOWEST PRICE ***********************/
  const getTheLowestPrice = async (id, minPrice, maxPrice, url) => {
    const tmpage = await browser.newPage();
    await tmpage.emulate(iPhone);

    const cookiesString = await fs.readFile(cookiesPath);
    const oldCookies = JSON.parse(cookiesString);
    if (oldCookies) {
      await tmpage.setCookie(...oldCookies);
    }
    await tmpage.setCookie({
      domain: "kaspi.kz",
      expirationDate: 5000000000,
      hostOnly: true,
      httpOnly: false,
      name: "kaspi.storefront.cookie.city",
      path: "/",
      sameSite: "unspecified",
      secure: false,
      session: false,
      storeId: "0",
      value: myCity,
      id: 28,
    });

    let price = 0;
    let responseFailed = true;

    tmpage.on("response", async (response) => {
      if (response.url().endsWith("/offer-view/offers/" + id)) {
        const concur = await response.json();
        console.log("SUK=" + id + " : Scrape succeed! " + response.url());
        succeededScrapes++;
        responseFailed = false;
        // console.log(concur);
        if (concur.offers[0]) {
          if (concur.offers[0].price > maxPrice) {
            price = maxPrice;
          } else if (concur.offers[0].price > minPrice) {
            if (concur.offers[0].merchantId === myStoreId) {
              price = concur.offers[0].price;
            } else {
              if (concur.offers[0].price - minPrice < damp) {
                price = minPrice;
              } else {
                price = concur.offers[0].price - damp;
              }
            }
          } else if (concur.offers[0].price === minPrice) {
            price = concur.offers[0].price;
          } else if (concur.offers[0].price < minPrice) {
            for (let offer of concur.offers) {
              if (offer.kaspiDelivery === false) {
                if (offer.price > minPrice) {
                  if (offer.merchantId === myStoreId) {
                    price = offer.price;
                  } else {
                    if (offer.price - minPrice < damp) {
                      price = minPrice;
                    } else {
                      price = offer.price - damp;
                    }
                  }
                } else if (offer.price === minPrice) {
                  price = minPrice;
                } else {
                  price = minPrice;
                }
                return;
              }
              price = minPrice;
            }
          }
        } else {
          price = maxPrice;
        }
      }
    });
    try {
      await tmpage.goto(url, {
        waitUntil: "load",
        timeout: 30000,
      });
    } catch (e) {
      console.log("SUK=" + id + ": " + e.originalMessage);
    }
    await waitTillHTMLRendered(tmpage);

    const cookies = await tmpage.cookies();
    await fs.writeFile(cookiesPath, JSON.stringify(cookies, null, 2));
    await tmpage.screenshot({ path: "img/screenshots/offers/" + itr + ".png" });
    if (responseFailed)
      console.log("SUK=" + id + " : Scrape failed with code: NOT FOUND");
    await tmpage.close();

    return price;
  };
  /****************END GET THE LOWEST PRICE ***********************/

  let itr = 0;
  let total = offers.length;
  let succeededScrapes = 0;

  for (let offer of offers) {
    itr++;
    const newPrice = await getTheLowestPrice(
      offer.suk,
      offer.minprice,
      offer.maxprice,
      offer.url
    );

    newOffers.push({
      id: offer.id,
      actualPrice: newPrice === 0 ? offer.minprice : newPrice,
      suk2: offer.suk2,
      model: offer.model,
      availability: offer.availability,
      availability2: offer.availability2,
      availability3: offer.availability3,
      availability4: offer.availability4,
      availability5: offer.availability5,
      brand: offer.brand,
    });
  }

  //START Update Database
  for (let offer of newOffers) {
    if (offer.id) {
      await conn.query(
        `UPDATE ${tablename} SET actualprice = ${offer.actualPrice} WHERE id = ${offer.id}`
      );
    }
  }
  //END Update Database

  console.log(
    new Date().toLocaleTimeString() +
      `: Succeeded ${succeededScrapes} scrapes of ${total}.`
  );

  updateXML(newOffers);

  setTimeout(() => {
    updatePrices();
  }, updateEveryXMinutes * 60 * 1000);
};

try {
  updatePrices();
} catch (e) {
  console.log(e);
}
/**************************END SCRAPING****************************/

/*************************START XML EDIT***************************/
const updateXML = async (newOffers = []) => {
  let XML = 0;
  const parser = new xml2js.Parser();
  const data = await fs.readFile(XMLFilePath);
  parser.parseString(data, function (err, result) {
    XML = result;
  });
  let iter = 0;
  XML.kaspi_catalog.company = myStoreName;
  XML.kaspi_catalog.merchantid = myStoreId;
  XML.kaspi_catalog.offers[0].offer = [];
  //Проверить надо если добавлю еще авейлибилити будет ли ошибка?
  for (let offer of newOffers) {
    const availability = [];
    for (let storage of availabaleStorages) {
      switch (storage) {
        case 1:
          availability.push(offer.availability);
          break;
        case 2:
          availability.push(offer.availability2);
          break;
        case 3:
          availability.push(offer.availability3);
          break;
        case 4:
          availability.push(offer.availability4);
          break;
        case 5:
          availability.push(offer.availability5);
          break;
      }
    }
    XML.kaspi_catalog.offers[0].offer[iter] = {
      $: { sku: offer.suk2 },
      model: [offer.model],
      brand: [offer.brand],
      availabilities: [
        {
          availability,
        },
      ],
      price: [offer.actualPrice + ""],
    };
    iter++;
  }
  const builder = new xml2js.Builder();
  const xml = builder.buildObject(XML);
  await fs.writeFile(XMLFilePath, xml);
  console.log("XML updated successfully!");
};
/**************************END XML EDIT****************************/
