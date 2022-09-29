export const data = [
  {
    suk: "100316373",
    suk2: "100316373_15503068",
    minprice: 10000,
    model: "Рация WLN KD-C1",
    brand: "WLN",
    actualprice: 14200,
    //Добавить еще авейлибилити???
    availability: { $: { available: "yes", storeId: "PP1" } },
    maxprice: 15000,
    url: "https://kaspi.kz/shop/p/-100316373/?c=710000000#!/sellers/100316373",
  },
];

const getProductsURL = async (articule) => {
  await searchPage.goto("https://kaspi.kz/shop/search/?text=" + articule, {
    waitUntil: "load",
    timeout: 0,
  });
  await searchPage.setCookie({
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
  await searchPage.reload();
  await searchPage.screenshot({ path: "e.png" });
  const aElement = await searchPage.evaluate(
    () => document.querySelector(".item-card__name-link").href
  );
  return aElement;
};
